import crypto from 'node:crypto';
import { prisma } from '../db/prisma.js';

export interface CreatePollParams {
  workspaceId: string;
  channelId: string;
  messageTs: string;
  creatorId: string;
  question: string;
  options: string[];
  isAnonymous?: boolean;
  quorumType?: 'PERCENTAGE' | 'COUNT' | 'NONE';
  quorumTarget?: number;
  eligibleVoterCount?: number;
  closesAt?: Date | null;
}

export interface VoteParams {
  pollId: string;
  voterId: string;
  optionId: string;
  workspaceSalt: string;
}

export class PollService {
  /**
   * Hashes a voter identity for an anonymous poll using HMAC-SHA256.
   * Completely irreversible without the workspace private salt.
   */
  static generateVoterToken(voterId: string, pollId: string, workspaceSalt: string): string {
    return crypto
      .createHmac('sha256', workspaceSalt)
      .update(`${voterId}:${pollId}`)
      .digest('hex');
  }

  /**
   * Creates a new poll record with its indexed options.
   */
  static async createPoll(params: CreatePollParams) {
    const {
      workspaceId,
      channelId,
      messageTs,
      creatorId,
      question,
      options,
      isAnonymous = false,
      quorumType = 'PERCENTAGE',
      quorumTarget = 70,
      eligibleVoterCount = 0,
      closesAt = null,
    } = params;

    if (!workspaceId) {
      throw new Error('Workspace ID is missing.');
    }

    // Ensure workspace and settings record exists to satisfy foreign key constraint
    await prisma.workspace.upsert({
      where: { id: workspaceId },
      update: {},
      create: {
        id: workspaceId,
        teamName: 'Workspace',
        botToken: 'bot_token_managed',
        settings: {
          create: {
            anonymousSalt: crypto.randomBytes(32).toString('hex'),
          },
        },
      },
    });

    return prisma.poll.create({
      data: {
        workspaceId,
        channelId,
        messageTs,
        creatorId,
        question,
        isAnonymous,
        quorumType,
        quorumTarget,
        eligibleVoterCount,
        closesAt,
        status: 'ACTIVE',
        options: {
          create: options.map((text, index) => ({
            index,
            text,
            voteCount: 0,
          })),
        },
      },
      include: {
        options: {
          orderBy: { index: 'asc' },
        },
      },
    });
  }

  /**
   * Casts a ballot with strict double-urn cryptographic isolation.
   */
  static async castVote(params: VoteParams) {
    const { pollId, voterId, optionId, workspaceSalt } = params;

    return prisma.$transaction(async (tx) => {
      // 1. Fetch current poll status
      const poll = await tx.poll.findUnique({
        where: { id: pollId },
        include: { options: true, participations: true },
      });

      if (!poll) {
        throw new Error('Poll not found');
      }

      if (poll.status !== 'ACTIVE' || (poll.closesAt && poll.closesAt <= new Date())) {
        throw new Error('This poll is closed and no longer accepting votes');
      }

      // 2. Prevent duplicate voting
      const existingParticipation = await tx.pollParticipation.findUnique({
        where: {
          pollId_voterId: {
            pollId,
            voterId,
          },
        },
      });

      if (existingParticipation) {
        throw new Error('You have already voted in this poll');
      }

      // 3. Record ballot
      if (poll.isAnonymous) {
        const voterToken = this.generateVoterToken(voterId, pollId, workspaceSalt);
        await tx.anonymousBallot.create({
          data: {
            pollId,
            voterToken,
            optionId,
          },
        });
      } else {
        await tx.publicVote.create({
          data: {
            pollId,
            voterId,
            optionId,
          },
        });
      }

      // 4. Record participation (separate from ballot option)
      await tx.pollParticipation.create({
        data: {
          pollId,
          voterId,
          hasVoted: true,
        },
      });

      // 5. Increment option counter
      await tx.pollOption.update({
        where: { id: optionId },
        data: {
          voteCount: { increment: 1 },
        },
      });

      // 6. Check quorum completion
      const totalVotes = poll.participations.length + 1;
      let quorumReached = false;

      if (poll.quorumType === 'PERCENTAGE' && poll.eligibleVoterCount > 0) {
        const currentPct = Math.round((totalVotes / poll.eligibleVoterCount) * 100);
        if (currentPct >= poll.quorumTarget) {
          quorumReached = true;
        }
      } else if (poll.quorumType === 'COUNT' && totalVotes >= poll.quorumTarget) {
        quorumReached = true;
      }

      // 7. Update status if quorum reached
      const updatedPoll = await tx.poll.update({
        where: { id: pollId },
        data: {
          status: quorumReached ? 'QUORUM_REACHED' : 'ACTIVE',
          closedAt: quorumReached ? new Date() : null,
        },
        include: {
          options: {
            orderBy: { index: 'asc' },
          },
          participations: true,
          publicVotes: true,
        },
      });

      return {
        poll: updatedPoll,
        quorumReached,
        totalVotes,
      };
    });
  }

  /**
   * Closes an active poll (either manually by the creator, or automatically by the timer worker).
   */
  static async closePoll(
    pollId: string,
    actorUserId?: string,
    closingStatus: 'CLOSED' | 'TIME_EXPIRED' | 'QUORUM_REACHED' = 'CLOSED'
  ) {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    if (actorUserId && actorUserId !== 'SYSTEM_TIMER' && poll.creatorId !== actorUserId) {
      throw new Error('Only the poll creator can manually close this poll');
    }

    return prisma.poll.update({
      where: { id: pollId },
      data: {
        status: closingStatus,
        closedAt: new Date(),
      },
      include: {
        options: {
          orderBy: { index: 'asc' },
        },
        participations: true,
        publicVotes: true,
      },
    });
  }

  /**
   * Fetches all active polls that have passed their scheduled closesAt deadline.
   */
  static async getExpiredActivePolls(now = new Date()) {
    return prisma.poll.findMany({
      where: {
        status: 'ACTIVE',
        closesAt: {
          not: null,
          lte: now,
        },
      },
      include: {
        workspace: true,
        options: {
          orderBy: { index: 'asc' },
        },
        participations: true,
        publicVotes: true,
      },
    });
  }
}
