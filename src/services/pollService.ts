import crypto from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import {
  deriveDoubleUrnVoterToken,
  ENV_MANAGED_TOKEN,
  decryptToken,
} from '../utils/crypto.js';

export const DEFAULT_MAX_NUDGE_MEMBERS = 50;
export const MIN_QUORUM_PERCENTAGE = 51;

export interface CreatePollParams {
  workspaceId: string;
  channelId: string;
  messageTs: string;
  threadTs?: string | null;
  creatorId: string;
  question: string;
  options: string[];
  isAnonymous?: boolean;
  allowMultipleVotes?: boolean;
  quorumType?: 'PERCENTAGE' | 'COUNT' | 'NONE';
  quorumTarget?: number;
  eligibleVoterCount?: number;
  closesAt?: Date | null;
  enforceChannelConcurrency?: boolean;
  forwardToChannelOnHuddleEnd?: boolean;
}

export interface VoteParams {
  pollId: string;
  voterId: string;
  optionId: string;
  workspaceSalt: string;
}

export interface WorkspaceSettingsData {
  defaultAnonymous: boolean;
  defaultQuorumType: 'PERCENTAGE' | 'NONE';
  defaultQuorumPct: number;
  allowVoterChoiceNudges: boolean;
  maxNudgeChannelMembers: number;
  allowMultipleActivePolls: boolean;
  managerUserIds: string[];
}

export interface ReportViewer {
  userId: string;
  isManager: boolean;
}

export interface CsvFilterOptions {
  startDate?: string;
  endDate?: string;
  statusFilter?: 'ALL' | 'QUORUM_REACHED' | 'CLOSED' | 'ACTIVE';
  selectedPollIds?: string[];
}

export interface PollTemplateData {
  id: string;
  workspaceId: string;
  ownerUserId: string;
  name: string;
  channelId: string;
  question: string;
  options: string[];
  isAnonymous: boolean;
  allowMultipleVotes: boolean;
  quorumType: 'PERCENTAGE' | 'NONE';
  quorumTarget: number;
  duration: string;
  forwardToChannelOnHuddleEnd: boolean;
  isShared: boolean;
}

export interface SavePollTemplateParams {
  workspaceId: string;
  ownerUserId: string;
  name: string;
  channelId?: string;
  question: string;
  options: string[];
  isAnonymous?: boolean;
  allowMultipleVotes?: boolean;
  quorumType?: 'PERCENTAGE' | 'NONE';
  quorumTarget?: number;
  duration?: string;
  forwardToChannelOnHuddleEnd?: boolean;
  isShared?: boolean;
}

function isTransientSqliteLockError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string };
  if (err.code === 'P2034') return true;
  const msg = err.message ?? '';
  return msg.includes('SQLITE_BUSY') || msg.includes('database is locked');
}

function mapTemplateRecord(record: {
  id: string;
  workspaceId: string;
  ownerUserId: string;
  name: string;
  channelId: string;
  question: string;
  optionsJson: string;
  isAnonymous: boolean;
  allowMultipleVotes: boolean;
  quorumType: string;
  quorumTarget: number;
  duration: string;
  forwardToChannelOnHuddleEnd?: boolean;
  isShared: boolean;
}): PollTemplateData {
  let parsedOptions: string[] = [];
  try {
    const raw = JSON.parse(record.optionsJson);
    if (Array.isArray(raw)) {
      parsedOptions = raw.map((item) => String(item));
    }
  } catch {
    parsedOptions = [];
  }

  return {
    id: record.id,
    workspaceId: record.workspaceId,
    ownerUserId: record.ownerUserId,
    name: record.name,
    channelId: record.channelId,
    question: record.question,
    options: parsedOptions,
    isAnonymous: record.isAnonymous,
    allowMultipleVotes: record.allowMultipleVotes,
    quorumType: record.quorumType === 'NONE' ? 'NONE' : 'PERCENTAGE',
    quorumTarget:
      record.quorumType === 'NONE'
        ? record.quorumTarget
        : Math.max(MIN_QUORUM_PERCENTAGE, Math.min(100, record.quorumTarget)),
    duration: record.duration || 'none',
    forwardToChannelOnHuddleEnd: record.forwardToChannelOnHuddleEnd ?? false,
    isShared: record.isShared,
  };
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
   * Returns the currently active poll in a channel, if any.
   */
  static async getActivePollInChannel(workspaceId: string, channelId: string) {
    return prisma.poll.findFirst({
      where: {
        workspaceId,
        channelId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Verifies that a new poll can be launched in the target channel according to workspace concurrency policy.
   */
  static async assertCanCreatePollInChannel(
    workspaceId: string,
    channelId: string
  ): Promise<void> {
    if (!workspaceId || !channelId) return;
    const settings = await this.getWorkspaceSettings(workspaceId);
    if (!settings.allowMultipleActivePolls) {
      const existingActive = await this.getActivePollInChannel(
        workspaceId,
        channelId
      );
      if (existingActive) {
        throw new Error(
          'An active poll is already running in this channel. Close it first or select another channel.'
        );
      }
    }
  }

  /**
   * Reads normalized workspace settings with safe defaults and minimum quorum bounds (>= 51%).
   */
  static async getWorkspaceSettings(
    workspaceId: string
  ): Promise<WorkspaceSettingsData> {
    if (!workspaceId) {
      return {
        defaultAnonymous: false,
        defaultQuorumType: 'PERCENTAGE',
        defaultQuorumPct: 70,
        allowVoterChoiceNudges: true,
        maxNudgeChannelMembers: DEFAULT_MAX_NUDGE_MEMBERS,
        allowMultipleActivePolls: false,
        managerUserIds: [],
      };
    }

    const record = await prisma.workspaceSettings.findUnique({
      where: { workspaceId },
    });

    const managerUserIds = (record?.managerUserIds ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      defaultAnonymous: record?.defaultAnonymous ?? false,
      defaultQuorumType:
        record?.defaultQuorumType === 'NONE' ? 'NONE' : 'PERCENTAGE',
      defaultQuorumPct: Math.max(
        MIN_QUORUM_PERCENTAGE,
        Math.min(100, record?.defaultQuorumPct ?? 70)
      ),
      allowVoterChoiceNudges: record?.allowVoterChoiceNudges ?? true,
      maxNudgeChannelMembers:
        record?.maxNudgeChannelMembers && record.maxNudgeChannelMembers > 0
          ? record.maxNudgeChannelMembers
          : DEFAULT_MAX_NUDGE_MEMBERS,
      allowMultipleActivePolls: record?.allowMultipleActivePolls ?? false,
      managerUserIds,
    };
  }

  /**
   * Upserts workspace governance and default poll settings.
   */
  static async updateWorkspaceSettings(
    workspaceId: string,
    input: Partial<WorkspaceSettingsData>
  ): Promise<WorkspaceSettingsData> {
    if (!workspaceId) {
      throw new Error('Workspace ID is missing.');
    }

    await prisma.workspace.upsert({
      where: { id: workspaceId },
      update: {},
      create: {
        id: workspaceId,
        teamName: 'Workspace',
        botToken: ENV_MANAGED_TOKEN,
      },
    });

    const updateData: Record<string, unknown> = {};
    if (typeof input.defaultAnonymous === 'boolean') {
      updateData.defaultAnonymous = input.defaultAnonymous;
    }
    if (
      input.defaultQuorumType === 'PERCENTAGE' ||
      input.defaultQuorumType === 'NONE'
    ) {
      updateData.defaultQuorumType = input.defaultQuorumType;
    }
    if (typeof input.defaultQuorumPct === 'number') {
      updateData.defaultQuorumPct = Math.max(
        MIN_QUORUM_PERCENTAGE,
        Math.min(100, Math.round(input.defaultQuorumPct))
      );
    }
    if (typeof input.allowVoterChoiceNudges === 'boolean') {
      updateData.allowVoterChoiceNudges = input.allowVoterChoiceNudges;
    }
    if (typeof input.maxNudgeChannelMembers === 'number') {
      updateData.maxNudgeChannelMembers = Math.max(
        1,
        Math.round(input.maxNudgeChannelMembers)
      );
    }
    if (typeof input.allowMultipleActivePolls === 'boolean') {
      updateData.allowMultipleActivePolls = input.allowMultipleActivePolls;
    }
    if (Array.isArray(input.managerUserIds)) {
      const cleaned = Array.from(
        new Set(input.managerUserIds.map((u) => u.trim()).filter(Boolean))
      );
      updateData.managerUserIds = cleaned.join(',');
    }

    await prisma.workspaceSettings.upsert({
      where: { workspaceId },
      update: updateData,
      create: {
        workspaceId,
        anonymousSalt: crypto.randomBytes(32).toString('hex'),
        ...updateData,
      },
    });

    return this.getWorkspaceSettings(workspaceId);
  }

  /**
   * Determines whether a Slack user has Workspace Manager privileges:
   * 1. Delegated Bot Manager in WorkspaceSettings.managerUserIds
   * 2. App installer (Workspace.installedByUserId)
   * 3. Slack Workspace Admin / Owner / Primary Owner via users.info
   */
  static async isUserWorkspaceManager(
    client: any,
    userId: string,
    workspaceId: string
  ): Promise<boolean> {
    if (!userId || !workspaceId) {
      return false;
    }

    const settings = await this.getWorkspaceSettings(workspaceId);
    if (settings.managerUserIds.includes(userId)) {
      return true;
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { installedByUserId: true },
    });
    if (workspace?.installedByUserId && workspace.installedByUserId === userId) {
      return true;
    }

    try {
      const res = await client?.users?.info?.({ user: userId });
      if (
        res?.user?.is_admin ||
        res?.user?.is_owner ||
        res?.user?.is_primary_owner
      ) {
        return true;
      }
    } catch {
      // Fallback to false if Slack API call is unavailable
    }

    return false;
  }

  /**
   * Builds a ReportViewer descriptor for role-based analytics and export scoping.
   */
  static async getReportViewer(
    client: any,
    userId: string,
    workspaceId: string
  ): Promise<ReportViewer> {
    const isManager = await this.isUserWorkspaceManager(
      client,
      userId,
      workspaceId
    );
    return { userId, isManager };
  }

  /**
   * Creates a new poll record with its indexed options.
   */
  static async createPoll(params: CreatePollParams) {
    const {
      workspaceId,
      channelId,
      messageTs,
      threadTs = null,
      creatorId,
      question,
      options,
      isAnonymous = false,
      allowMultipleVotes = false,
      quorumType = 'PERCENTAGE',
      quorumTarget = 70,
      eligibleVoterCount = 0,
      closesAt = null,
      enforceChannelConcurrency = false,
      forwardToChannelOnHuddleEnd = false,
    } = params;

    if (!workspaceId) {
      throw new Error('Workspace ID is missing.');
    }

    if (enforceChannelConcurrency) {
      await this.assertCanCreatePollInChannel(workspaceId, channelId);
    }

    const normalizedQuorumTarget =
      quorumType === 'PERCENTAGE'
        ? Math.max(MIN_QUORUM_PERCENTAGE, Math.min(100, quorumTarget))
        : quorumTarget;

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
        threadTs,
        creatorId,
        question,
        isAnonymous,
        allowMultipleVotes,
        quorumType,
        quorumTarget: normalizedQuorumTarget,
        eligibleVoterCount,
        closesAt,
        forwardToChannelOnHuddleEnd: Boolean(forwardToChannelOnHuddleEnd),
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
          // 50% is NEVER quorum: PERCENTAGE quorum requires strictly > 50% (at least half + 1)
          const totalVotes = existingParticipation
            ? poll.participations.length
            : poll.participations.length + 1;
          let quorumReached = false;

          if (poll.quorumType === 'PERCENTAGE' && poll.eligibleVoterCount > 0) {
            const effectiveTargetPct = Math.max(
              MIN_QUORUM_PERCENTAGE,
              poll.quorumTarget
            );
            const minMajorityVotes = Math.floor(poll.eligibleVoterCount / 2) + 1;
            const targetVotes = Math.ceil(
              (poll.eligibleVoterCount * effectiveTargetPct) / 100
            );
            const requiredVotes = Math.max(minMajorityVotes, targetVotes);
            if (totalVotes >= requiredVotes) {
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
   * Closes an active poll (manually by the creator or a Workspace Manager, or automatically by the timer worker).
   */
  static async closePoll(
    pollId: string,
    actorUserId?: string,
    closingStatus: 'CLOSED' | 'TIME_EXPIRED' | 'QUORUM_REACHED' = 'CLOSED',
    isManager = false
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
      poll.creatorId !== actorUserId &&
      !isManager
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

  /**
   * Returns polls visible to the given ReportViewer (all workspace polls for managers, or personal polls for standard members).
   */
  static async getAuthorizedPolls(
    workspaceId: string,
    viewer: ReportViewer,
    limit = 50
  ) {
    const whereClause = viewer.isManager
      ? { workspaceId }
      : { workspaceId, creatorId: viewer.userId };

    return prisma.poll.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      ...(limit > 0 ? { take: limit } : {}),
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
   * Computes aggregated analytics metrics for the App Home dashboard and reports.
   */
  static async getPollAnalyticsStats(
    workspaceId: string,
    viewer: ReportViewer,
    days = 30
  ) {
    const allAuthorized = await this.getAuthorizedPolls(
      workspaceId,
      viewer,
      200
    );

    const cutoff =
      days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;
    const polls = cutoff
      ? allAuthorized.filter((p) => new Date(p.createdAt) >= cutoff)
      : allAuthorized;

    const totalPolls = polls.length;
    const totalActive = polls.filter((p) => p.status === 'ACTIVE').length;
    const totalClosed = polls.filter((p) => p.status !== 'ACTIVE').length;
    const totalQuorumsReached = polls.filter(
      (p) => p.status === 'QUORUM_REACHED'
    ).length;

    const quorumEnabledPolls = polls.filter((p) => p.quorumType !== 'NONE');
    const quorumComplianceRate =
      quorumEnabledPolls.length > 0
        ? Math.round(
            (quorumEnabledPolls.filter((p) => p.status === 'QUORUM_REACHED')
              .length /
              quorumEnabledPolls.length) *
              100
          )
        : 100;

    const pollsWithEligible = polls.filter((p) => p.eligibleVoterCount > 0);
    const avgParticipationPct =
      pollsWithEligible.length > 0
        ? Math.round(
            pollsWithEligible.reduce((acc, p) => {
              const pct = Math.min(
                100,
                Math.round(
                  ((p.participations?.length ?? 0) / p.eligibleVoterCount) * 100
                )
              );
              return acc + pct;
            }, 0) / pollsWithEligible.length
          )
        : 0;

    const totalBallotsCast = polls.reduce(
      (sum, p) =>
        sum +
        (p.options ?? []).reduce(
          (optSum, o) => optSum + (o.voteCount ?? 0),
          0
        ),
      0
    );

    const publicPollsCount = polls.filter((p) => !p.isAnonymous).length;
    const anonymousPollsCount = polls.filter((p) => p.isAnonymous).length;

    return {
      scope: viewer.isManager ? ('workspace' as const) : ('personal' as const),
      totalPolls,
      totalActive,
      totalClosed,
      totalQuorumsReached,
      quorumComplianceRate,
      avgParticipationPct,
      totalBallotsCast,
      publicPollsCount,
      anonymousPollsCount,
      polls,
    };
  }

  /**
   * Pure deterministic filter for customizable CSV exports.
   */
  static filterPollsForCsv<T extends Record<string, any>>(
    polls: T[],
    filters: CsvFilterOptions = {}
  ): T[] {
    let result = [...polls];

    if (filters.startDate && filters.startDate.trim()) {
      const start = new Date(`${filters.startDate.trim()}T00:00:00.000Z`);
      if (!Number.isNaN(start.getTime())) {
        result = result.filter((p) => new Date(p.createdAt) >= start);
      }
    }

    if (filters.endDate && filters.endDate.trim()) {
      const end = new Date(`${filters.endDate.trim()}T23:59:59.999Z`);
      if (!Number.isNaN(end.getTime())) {
        result = result.filter((p) => new Date(p.createdAt) <= end);
      }
    }

    if (filters.statusFilter === 'QUORUM_REACHED') {
      result = result.filter((p) => p.status === 'QUORUM_REACHED');
    } else if (filters.statusFilter === 'CLOSED') {
      result = result.filter((p) =>
        ['CLOSED', 'TIME_EXPIRED', 'QUORUM_REACHED'].includes(p.status)
      );
    } else if (filters.statusFilter === 'ACTIVE') {
      result = result.filter((p) => p.status === 'ACTIVE');
    }

    if (filters.selectedPollIds && filters.selectedPollIds.length > 0) {
      const selectedSet = new Set(filters.selectedPollIds);
      result = result.filter((p) => selectedSet.has(p.id));
    }

    return result;
  }

  /**
   * Saves (creates or updates by name) a PollTemplate for a user in a workspace.
   */
  static async saveTemplate(
    params: SavePollTemplateParams
  ): Promise<PollTemplateData> {
    const {
      workspaceId,
      ownerUserId,
      name,
      channelId = '',
      question,
      options,
      isAnonymous = false,
      allowMultipleVotes = false,
      quorumType = 'PERCENTAGE',
      quorumTarget = 70,
      duration = 'none',
      isShared = false,
    } = params;

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Template name is required.');
    }

    const normalizedQuorumType = quorumType === 'NONE' ? 'NONE' : 'PERCENTAGE';
    const normalizedQuorumTarget =
      normalizedQuorumType === 'PERCENTAGE'
        ? Math.max(MIN_QUORUM_PERCENTAGE, Math.min(100, quorumTarget))
        : quorumTarget;

    const record = await prisma.pollTemplate.upsert({
      where: {
        workspaceId_ownerUserId_name: {
          workspaceId,
          ownerUserId,
          name: trimmedName,
        },
      },
      update: {
        channelId,
        question,
        optionsJson: JSON.stringify(options),
        isAnonymous,
        allowMultipleVotes,
        quorumType: normalizedQuorumType,
        quorumTarget: normalizedQuorumTarget,
        duration,
        forwardToChannelOnHuddleEnd: Boolean(params.forwardToChannelOnHuddleEnd),
        isShared,
      },
      create: {
        workspaceId,
        ownerUserId,
        name: trimmedName,
        channelId,
        question,
        optionsJson: JSON.stringify(options),
        isAnonymous,
        allowMultipleVotes,
        quorumType: normalizedQuorumType,
        quorumTarget: normalizedQuorumTarget,
        duration,
        forwardToChannelOnHuddleEnd: Boolean(params.forwardToChannelOnHuddleEnd),
        isShared,
      },
    });

    return mapTemplateRecord(record);
  }

  /**
   * Updates an existing PollTemplate owned by the user.
   */
  static async updateTemplate(
    id: string,
    workspaceId: string,
    ownerUserId: string,
    updates: Partial<Omit<SavePollTemplateParams, 'workspaceId' | 'ownerUserId'>>
  ): Promise<PollTemplateData> {
    const existing = await prisma.pollTemplate.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new Error('Template not found.');
    }

    if (existing.ownerUserId !== ownerUserId) {
      throw new Error('Only the template owner can edit this template.');
    }

    const nextQuorumType =
      updates.quorumType !== undefined
        ? updates.quorumType === 'NONE'
          ? 'NONE'
          : 'PERCENTAGE'
        : existing.quorumType;

    const rawTarget =
      updates.quorumTarget !== undefined
        ? updates.quorumTarget
        : existing.quorumTarget;

    const nextQuorumTarget =
      nextQuorumType === 'PERCENTAGE'
        ? Math.max(MIN_QUORUM_PERCENTAGE, Math.min(100, rawTarget))
        : rawTarget;

    const updated = await prisma.pollTemplate.update({
      where: { id },
      data: {
        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
        ...(updates.channelId !== undefined
          ? { channelId: updates.channelId }
          : {}),
        ...(updates.question !== undefined ? { question: updates.question } : {}),
        ...(updates.options !== undefined
          ? { optionsJson: JSON.stringify(updates.options) }
          : {}),
        ...(updates.isAnonymous !== undefined
          ? { isAnonymous: updates.isAnonymous }
          : {}),
        ...(updates.allowMultipleVotes !== undefined
          ? { allowMultipleVotes: updates.allowMultipleVotes }
          : {}),
        quorumType: nextQuorumType,
        quorumTarget: nextQuorumTarget,
        ...(updates.duration !== undefined ? { duration: updates.duration } : {}),
        ...(updates.forwardToChannelOnHuddleEnd !== undefined
          ? { forwardToChannelOnHuddleEnd: updates.forwardToChannelOnHuddleEnd }
          : {}),
        ...(updates.isShared !== undefined ? { isShared: updates.isShared } : {}),
      },
    });

    return mapTemplateRecord(updated);
  }

  /**
   * Lists all templates accessible to a viewer in a workspace (owned by the viewer or shared with the workspace).
   */
  static async listTemplates(
    workspaceId: string,
    viewerUserId: string
  ): Promise<PollTemplateData[]> {
    const records = await prisma.pollTemplate.findMany({
      where: {
        workspaceId,
        OR: [{ ownerUserId: viewerUserId }, { isShared: true }],
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return records.map(mapTemplateRecord);
  }

  /**
   * Fetches a single template by ID if owned by the viewer or shared in the workspace.
   */
  static async getTemplate(
    id: string,
    workspaceId: string,
    viewerUserId?: string
  ): Promise<PollTemplateData | null> {
    const record = await prisma.pollTemplate.findFirst({
      where: { id, workspaceId },
    });

    if (!record) {
      return null;
    }

    if (
      viewerUserId &&
      record.ownerUserId !== viewerUserId &&
      !record.isShared
    ) {
      return null;
    }

    return mapTemplateRecord(record);
  }

  /**
   * Deletes a template owned by the user (or by a Workspace Manager).
   */
  static async deleteTemplate(
    id: string,
    workspaceId: string,
    ownerUserId: string,
    isManager = false
  ): Promise<void> {
    const record = await prisma.pollTemplate.findFirst({
      where: { id, workspaceId },
    });

    if (!record) {
      throw new Error('Template not found.');
    }

    if (record.ownerUserId !== ownerUserId && !isManager) {
      throw new Error('Only the template owner can delete this template.');
    }

    await prisma.pollTemplate.delete({
      where: { id },
    });
  }

  /**
   * Toggles whether a user's template is shared with the entire workspace.
   */
  static async setTemplateShared(
    id: string,
    workspaceId: string,
    ownerUserId: string,
    isShared: boolean
  ): Promise<PollTemplateData> {
    const record = await prisma.pollTemplate.findFirst({
      where: { id, workspaceId },
    });

    if (!record) {
      throw new Error('Template not found.');
    }

    if (record.ownerUserId !== ownerUserId) {
      throw new Error(
        'Only the template owner can change sharing permissions.'
      );
    }

    const updated = await prisma.pollTemplate.update({
      where: { id },
      data: { isShared },
    });

    return mapTemplateRecord(updated);
  }

  /**
   * Duplicates an accessible template into the target user's personal templates.
   */
  static async duplicateTemplate(
    id: string,
    workspaceId: string,
    userId: string
  ): Promise<PollTemplateData> {
    const source = await this.getTemplate(id, workspaceId, userId);
    if (!source) {
      throw new Error('Template not found or not accessible.');
    }

    const baseName = `${source.name} (Copy)`;
    let candidateName = baseName;
    let suffix = 2;

    while (
      await prisma.pollTemplate.findUnique({
        where: {
          workspaceId_ownerUserId_name: {
            workspaceId,
            ownerUserId: userId,
            name: candidateName,
          },
        },
      })
    ) {
      candidateName = `${baseName} ${suffix}`;
      suffix++;
    }

    return this.saveTemplate({
      workspaceId,
      ownerUserId: userId,
      name: candidateName,
      channelId: source.channelId,
      question: source.question,
      options: source.options,
      isAnonymous: source.isAnonymous,
      allowMultipleVotes: source.allowMultipleVotes,
      quorumType: source.quorumType,
      quorumTarget: source.quorumTarget,
      duration: source.duration,
      isShared: false,
    });
  }

  /**
   * Unpublishes a shared template from the workspace catalog (used by Workspace Managers).
   */
  static async unpublishTemplate(
    id: string,
    workspaceId: string
  ): Promise<PollTemplateData> {
    const record = await prisma.pollTemplate.findFirst({
      where: { id, workspaceId },
    });

    if (!record) {
      throw new Error('Template not found.');
    }

    const updated = await prisma.pollTemplate.update({
      where: { id },
      data: { isShared: false },
    });

    return mapTemplateRecord(updated);
  }

  /**
   * Deletes a poll if the caller is the creator or a Workspace Manager.
   */
  static async deletePoll(
    pollId: string,
    userId: string,
    isManager = false
  ): Promise<{ id: string; channelId: string; messageTs: string; workspaceId: string }> {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
        channelId: true,
        messageTs: true,
        workspaceId: true,
        creatorId: true,
      },
    });

    if (!poll) {
      throw new Error('Poll not found.');
    }

    if (poll.creatorId !== userId && !isManager) {
      throw new Error(
        'Only the poll creator or a workspace admin can delete this poll.'
      );
    }

    await prisma.poll.delete({ where: { id: pollId } });
    return poll;
  }

  /**
   * Deletes multiple polls in bulk that the user is authorized to manage.
   */
  static async deletePollsBulk(
    pollIds: string[],
    workspaceId: string,
    userId: string,
    isManager = false
  ): Promise<{
    deletedCount: number;
    deletedPolls: Array<{ id: string; channelId: string; messageTs: string }>;
  }> {
    if (!pollIds.length) {
      return { deletedCount: 0, deletedPolls: [] };
    }

    const where: any = {
      id: { in: pollIds },
      workspaceId,
    };
    if (!isManager) {
      where.creatorId = userId;
    }

    const polls = await prisma.poll.findMany({
      where,
      select: { id: true, channelId: true, messageTs: true },
    });

    const allowedIds = polls.map((p) => p.id);
    if (!allowedIds.length) {
      return { deletedCount: 0, deletedPolls: [] };
    }

    await prisma.poll.deleteMany({
      where: { id: { in: allowedIds } },
    });

    return { deletedCount: allowedIds.length, deletedPolls: polls };
  }

  /**
   * Clears all closed/finished polls that the user is authorized to manage.
   */
  static async clearClosedPolls(
    workspaceId: string,
    userId: string,
    isManager = false
  ): Promise<{
    deletedCount: number;
    deletedPolls: { id: string; channelId: string; messageTs: string }[];
  }> {
    const where: any = {
      workspaceId,
      status: { in: ['CLOSED', 'QUORUM_REACHED', 'TIME_EXPIRED'] },
    };
    if (!isManager) {
      where.creatorId = userId;
    }

    const polls = await prisma.poll.findMany({
      where,
      select: { id: true, channelId: true, messageTs: true },
    });

    const res = await prisma.poll.deleteMany({ where });
    return { deletedCount: res.count, deletedPolls: polls };
  }

  /**
   * Finds all active Huddle polls waiting for a "Remember to vote" reminder once their Huddle ends.
   */
  static async getActiveHuddlePollsPendingReminder(channelId?: string) {
    return prisma.poll.findMany({
      where: {
        status: 'ACTIVE',
        threadTs: { not: null },
        forwardToChannelOnHuddleEnd: true,
        huddleEndReminderSent: false,
        ...(channelId ? { channelId } : {}),
      },
      include: {
        workspace: { select: { botToken: true } },
        options: { orderBy: { index: 'asc' } },
        participations: { select: { voterId: true } },
      },
    });
  }

  /**
   * Atomically claims the Huddle-end reminder for a poll to prevent duplicate messages.
   */
  static async claimHuddleEndReminder(pollId: string): Promise<boolean> {
    const res = await prisma.poll.updateMany({
      where: {
        id: pollId,
        huddleEndReminderSent: false,
      },
      data: {
        huddleEndReminderSent: true,
      },
    });
    return res.count > 0;
  }
}
