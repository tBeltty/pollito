import crypto from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import {
  deriveDoubleUrnVoterToken,
  ENV_MANAGED_TOKEN,
  decryptToken,
} from '../utils/crypto.js';

export interface CreatePollParams {
  workspaceId: string;
  channelId: string;
  messageTs: string;
  creatorId: string;
  question: string;
  options: string[];
  isAnonymous?: boolean;
  allowMultipleVotes?: boolean;
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

function isTransientSqliteLockError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string };
  if (err.code === 'P2034') return true;
  const msg = err.message ?? '';
  return msg.includes('SQLITE_BUSY') || msg.includes('database is locked');
}

export class PollService {
  /**
   * Hashes a voter identity for an anonymous poll using HKDF-SHA256 + HMAC-SHA256.
   * Requires both the server master secret and the workspace salt.
   */
  static generateVoterToken(
    voterId: string,
    pollId: string,
    workspaceSalt: string,
    masterSecret = env.APP_SECRET_SALT
  ): string {
    return deriveDoubleUrnVoterToken(voterId, pollId, workspaceSalt, masterSecret);
  }

  /**
   * Resolves a decrypted workspace bot token or falls back to env.SLACK_BOT_TOKEN.
   */
  static async resolveWorkspaceBotToken(workspaceId: string): Promise<string> {
    if (!workspaceId) {
      return env.SLACK_BOT_TOKEN;
    }
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { botToken: true },
    });
    return (
      decryptToken(workspace?.botToken ?? '', env.APP_SECRET_SALT) ??
      env.SLACK_BOT_TOKEN
    );
  }

  /**
   * Returns eligible channel member IDs who have not yet cast a ballot in the given poll.
   */
  static async getNonVoters(
    pollId: string,
    eligibleChannelMemberIds: string[]
  ): Promise<string[]> {
    const participations = await prisma.pollParticipation.findMany({
      where: { pollId },
      select: { voterId: true },
    });
    const votedSet = new Set(participations.map((p) => p.voterId));
    return eligibleChannelMemberIds.filter((uid) => !votedSet.has(uid));
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
      allowMultipleVotes = false,
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
        botToken: ENV_MANAGED_TOKEN,
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
        allowMultipleVotes,
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
   * Casts a ballot with strict double-urn cryptographic isolation and SQLite lock retry.
   */
  static async castVote(params: VoteParams) {
    const { pollId, voterId, optionId, workspaceSalt } = params;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          // 1. Fetch current poll status
          const poll = await tx.poll.findUnique({
            where: { id: pollId },
            include: { options: true, participations: true },
          });

          if (!poll) {
            throw new Error('Poll not found');
          }

          if (
            poll.status !== 'ACTIVE' ||
            (poll.closesAt && poll.closesAt <= new Date())
          ) {
            throw new Error('This poll is closed and no longer accepting votes');
          }

          if (!poll.options.some((o) => o.id === optionId)) {
            throw new Error('Invalid poll option');
          }

          // 2. Check existing participation
          const existingParticipation = await tx.pollParticipation.findUnique({
            where: {
              pollId_voterId: {
                pollId,
                voterId,
              },
            },
          });

          if (!poll.allowMultipleVotes && existingParticipation) {
            throw new Error('You have already voted in this poll');
          }

          // 3. Record ballot (checking duplicate option vote in multi-choice mode)
          if (poll.isAnonymous) {
            const voterToken = this.generateVoterToken(
              voterId,
              pollId,
              workspaceSalt
            );

            if (poll.allowMultipleVotes) {
              const existingOptionBallot = await tx.anonymousBallot.findUnique({
                where: {
                  pollId_voterToken_optionId: {
                    pollId,
                    voterToken,
                    optionId,
                  },
                },
              });
              if (existingOptionBallot) {
                throw new Error('You have already voted for this option');
              }
            }

            await tx.anonymousBallot.create({
              data: {
                pollId,
                voterToken,
                optionId,
              },
            });
          } else {
            if (poll.allowMultipleVotes) {
              const existingPublicVote = await tx.publicVote.findUnique({
                where: {
                  pollId_voterId_optionId: {
                    pollId,
                    voterId,
                    optionId,
                  },
                },
              });
              if (existingPublicVote) {
                throw new Error('You have already voted for this option');
              }
            }

            await tx.publicVote.create({
              data: {
                pollId,
                voterId,
                optionId,
              },
            });
          }

          // 4. Record unique voter participation (separate from ballot option)
          if (!existingParticipation) {
            await tx.pollParticipation.create({
              data: {
                pollId,
                voterId,
                hasVoted: true,
              },
            });
          }

          // 5. Increment option counter
          await tx.pollOption.update({
            where: { id: optionId },
            data: {
              voteCount: { increment: 1 },
            },
          });

          // 6. Check quorum completion based on unique participants
          const totalVotes = existingParticipation
            ? poll.participations.length
            : poll.participations.length + 1;
          let quorumReached = false;

          if (poll.quorumType === 'PERCENTAGE' && poll.eligibleVoterCount > 0) {
            const currentPct = Math.round(
              (totalVotes / poll.eligibleVoterCount) * 100
            );
            if (currentPct >= poll.quorumTarget) {
              quorumReached = true;
            }
          } else if (
            poll.quorumType === 'COUNT' &&
            totalVotes >= poll.quorumTarget
          ) {
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
      } catch (error) {
        if (attempt < maxAttempts && isTransientSqliteLockError(error)) {
          const delayMs = 50 * attempt;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        throw error;
      }
    }

    throw new Error('Failed to cast vote after maximum retry attempts');
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

    if (
      actorUserId &&
      actorUserId !== 'SYSTEM_TIMER' &&
      poll.creatorId !== actorUserId
    ) {
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
