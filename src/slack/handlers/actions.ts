import type { App, BlockAction } from '@slack/bolt';
import { PollService } from '../../services/pollService.js';
import { UpdateQueue } from '../../services/updateQueue.js';
import {
  buildCreatePollModalView,
  type CreatePollModalPreset,
} from '../ui/views/createPollModal.js';
import {
  buildCsvExportModalView,
  buildPollsCsvReport,
  buildManageHistoryModalView,
} from '../ui/views/appHome.js';
import {
  buildAnalyticsModalView,
  buildPollDetailModalView,
} from '../ui/views/analyticsModal.js';
import { buildTemplatesModalView } from '../ui/views/templatesModal.js';
import { buildGuideModalView } from '../ui/views/guideModal.js';
import { buildSettingsModalView } from '../ui/views/settingsModal.js';
import { publishHomeTab } from './events.js';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import {
  formatPollClosureSummary,
  getEligibleChannelMembers,
} from '../utils/channelMembers.js';

const APP_HOME_TEMPLATES: Record<string, CreatePollModalPreset> = {
  standup: {
    question: 'Do we have any blockers for today’s standup?',
    options: ['All clear — on track', 'Minor blocker — need sync', 'Blocked — need review'],
    isAnonymous: false,
    allowMultipleVotes: false,
    quorumType: 'PERCENTAGE',
    quorumTarget: 80,
    duration: '15m',
  },
  retro: {
    question: 'Which sprint retrospective slot works best?',
    options: ['Thursday 14:00 UTC', 'Thursday 16:00 UTC', 'Friday 14:00 UTC', 'Friday 16:00 UTC'],
    isAnonymous: false,
    allowMultipleVotes: true,
    quorumType: 'PERCENTAGE',
    quorumTarget: 75,
    duration: '24h',
  },
  rfc: {
    question: 'How should we proceed with the proposed Architecture RFC?',
    options: [
      'Approve as proposed',
      'Approve with minor revisions',
      'Needs deeper architecture review',
      'Abstain',
    ],
    isAnonymous: true,
    allowMultipleVotes: false,
    quorumType: 'PERCENTAGE',
    quorumTarget: 70,
    duration: '72h',
  },
  lunch: {
    question: 'Where should the team go for lunch this Friday?',
    options: ['Tacos', 'Ramen', 'Wood-fired Pizza', 'Mediterranean'],
    isAnonymous: true,
    allowMultipleVotes: true,
    quorumType: 'NONE',
    quorumTarget: 51,
    duration: '4h',
  },
};

export function registerActionHandlers(app: App) {
  // Handle option vote buttons (matches vote_option_*)
  app.action(/^vote_option_/, async ({ action, ack, body, client }) => {
    await ack();

    const blockAction = body as BlockAction;
    const buttonValue = (action as { value?: string }).value;
    if (!buttonValue) return;

    try {
      const { pollId, optionId } = JSON.parse(buttonValue) as {
        pollId: string;
        optionId: string;
      };

      const voterId = blockAction.user.id;
      const channelId = blockAction.channel?.id;
      const messageTs = blockAction.message?.ts;

      if (!channelId || !messageTs) return;

      // Fetch workspace settings or fallback to env salt
      const workspace = await prisma.workspace.findUnique({
        where: { id: blockAction.team?.id ?? '' },
        include: { settings: true },
      });

      const workspaceSalt = workspace?.settings?.anonymousSalt ?? env.APP_SECRET_SALT;

      const result = await PollService.castVote({
        pollId,
        voterId,
        optionId,
        workspaceSalt,
      });

      if (result.quorumReached) {
        await UpdateQueue.flushNow(pollId, channelId, messageTs, client);
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: result.poll.threadTs || messageTs,
          text: formatPollClosureSummary(result.poll, 'QUORUM_REACHED'),
        });
      } else {
        UpdateQueue.scheduleUpdate(pollId, channelId, messageTs, client);
      }

      // Ephemeral confirmation
      const noticeText = result.poll.isAnonymous
        ? 'Your anonymous vote has been recorded.'
        : 'Your vote has been recorded.';

      await client.chat.postEphemeral({
        channel: channelId,
        user: voterId,
        text: noticeText,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while voting.';

      if (blockAction.channel?.id) {
        try {
          await client.chat.postEphemeral({
            channel: blockAction.channel.id,
            user: blockAction.user.id,
            text: errorMessage,
          });
        } catch {
          // Ignore ephemeral failures
        }
      }
    }
  });

  // Handle manual poll closure from UI button (matches poll_close_click)
  app.action(/^poll_close_click/, async ({ action, ack, body, client }) => {
    await ack();

    const blockAction = body as BlockAction;
    const rawVal = (action as { value?: string }).value;
    if (!rawVal) return;

    let pollId = rawVal;
    try {
      const parsed = JSON.parse(rawVal);
      if (typeof parsed === 'object' && parsed !== null && parsed.pollId) {
        pollId = parsed.pollId;
      }
    } catch {
      // plain string ID
    }

    try {
      const workspaceId = blockAction.team?.id ?? '';
      const isManager = await PollService.isUserWorkspaceManager(
        client,
        blockAction.user.id,
        workspaceId
      );
      const closedPoll = await PollService.closePoll(
        pollId,
        blockAction.user.id,
        'CLOSED',
        isManager
      );
      await UpdateQueue.flushNow(closedPoll.id, closedPoll.channelId, closedPoll.messageTs, client);
      await client.chat.postMessage({
        channel: closedPoll.channelId,
        thread_ts: closedPoll.threadTs || closedPoll.messageTs,
        text: formatPollClosureSummary(closedPoll, 'CLOSED'),
      });

      if ((blockAction as any).view?.type === 'home') {
        try {
          await publishHomeTab(client, blockAction.user.id, workspaceId);
        } catch (publishErr) {
          console.error('Failed to update App Home after poll closure:', publishErr);
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while closing the poll.';

      if (blockAction.channel?.id) {
        try {
          await client.chat.postEphemeral({
            channel: blockAction.channel.id,
            user: blockAction.user.id,
            text: errorMessage,
          });
        } catch {
          // ignore
        }
      } else {
        try {
          await client.chat.postMessage({
            channel: blockAction.user.id,
            text: errorMessage,
          });
        } catch {
          // ignore
        }
      }
    }
  });

  // Handle poll deletion from App Home button (matches poll_delete_click)
  app.action(/^poll_delete_click/, async ({ action, ack, body, client }) => {
    await ack();

    const blockAction = body as BlockAction;
    const rawVal = (action as { value?: string }).value;
    if (!rawVal) return;

    let pollId = rawVal;
    try {
      const parsed = JSON.parse(rawVal);
      if (typeof parsed === 'object' && parsed !== null && parsed.pollId) {
        pollId = parsed.pollId;
      }
    } catch {
      // plain string ID
    }

    const userId = blockAction.user.id;
    const workspaceId = blockAction.team?.id ?? '';

    try {
      const isManager = await PollService.isUserWorkspaceManager(
        client,
        userId,
        workspaceId
      );
      const deleted = await PollService.deletePoll(pollId, userId, isManager);

      try {
        await client.chat?.delete?.({
          channel: deleted.channelId,
          ts: deleted.messageTs,
        });
      } catch {
        // ignore message deletion failures
      }

      await publishHomeTab(client, userId, workspaceId);
    } catch (error) {
      console.error('Failed to delete poll:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Could not delete poll.';
      try {
        await client.chat?.postEphemeral?.({
          channel: (blockAction.channel as any)?.id || userId,
          user: userId,
          text: errorMessage,
        });
      } catch {
        // ignore
      }
    }
  });

  // Handle Manage History modal from App Home button
  app.action('app_home_manage_history_click', async ({ ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const workspaceId = blockAction.team?.id ?? '';
    const userId = blockAction.user.id;

    try {
      const viewer = await PollService.getReportViewer(client, userId, workspaceId);
      const polls = await PollService.getAuthorizedPolls(workspaceId, viewer, 50);
      if (polls.length === 0) return;

      await client.views.open({
        trigger_id: blockAction.trigger_id,
        view: buildManageHistoryModalView(polls),
      });
    } catch (error) {
      console.error('Failed to open manage history modal:', error);
    }
  });

  // Handle Clear Closed Polls from App Home button
  app.action('app_home_clear_closed_click', async ({ ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const workspaceId = blockAction.team?.id ?? '';
    const userId = blockAction.user.id;

    try {
      const isManager = await PollService.isUserWorkspaceManager(client, userId, workspaceId);
      const { deletedPolls } = await PollService.clearClosedPolls(workspaceId, userId, isManager);

      for (const p of deletedPolls) {
        try {
          await client.chat?.delete?.({ channel: p.channelId, ts: p.messageTs });
        } catch {
          // ignore failures deleting already removed or old messages
        }
      }

      await publishHomeTab(client, userId, workspaceId);
    } catch (error) {
      console.error('Failed to clear closed polls:', error);
    }
  });

  // Handle Jump to Poll link button click acknowledgment
  app.action('huddle_reminder_jump_link', async ({ ack }) => {
    await ack();
  });

  // Handle Smart Nudge button click (matches poll_nudge_click)
  app.action(/^poll_nudge_click/, async ({ action, ack, body, client }) => {
    await ack();

    const blockAction = body as BlockAction;
    const rawVal = (action as { value?: string }).value;
    if (!rawVal) return;

    let pollId = rawVal;
    try {
      const parsed = JSON.parse(rawVal);
      if (typeof parsed === 'object' && parsed !== null && parsed.pollId) {
        pollId = parsed.pollId;
      }
    } catch {
      // plain string ID
    }

    try {
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
      });

      if (!poll) {
        throw new Error('Poll not found');
      }

      if (poll.status !== 'ACTIVE') {
        throw new Error('This poll is closed and no longer accepting votes');
      }

      if (poll.creatorId !== blockAction.user.id) {
        throw new Error('Only the poll creator can send nudges for this poll');
      }

      const settings = await PollService.getWorkspaceSettings(poll.workspaceId);
      if (!settings.allowVoterChoiceNudges) {
        throw new Error('Smart Nudges are disabled in this workspace.');
      }

      const members = await getEligibleChannelMembers(client, poll.channelId);
      const channelMemberCount = members.length > 0 ? members.length : poll.eligibleVoterCount;
      if (channelMemberCount > settings.maxNudgeChannelMembers) {
        throw new Error(
          `Smart Nudges are disabled for channels with more than ${settings.maxNudgeChannelMembers} members.`
        );
      }

      const recentNudge = await prisma.nudgeLog.findFirst({
        where: {
          pollId,
          sentAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
        },
      });

      if (recentNudge) {
        throw new Error('A reminder was already sent within the last 4 hours');
      }

      const nonVoters = await PollService.getNonVoters(pollId, members);
      const recipients = nonVoters.slice(0, settings.maxNudgeChannelMembers);

      let sentCount = 0;
      for (const recipientId of recipients) {
        try {
          await client.chat.postMessage({
            channel: recipientId,
            text: `👋 Friendly reminder from <@${poll.creatorId}>: Your vote is still needed on *${poll.question}* in <#${poll.channelId}>.`,
          });
          await prisma.nudgeLog.create({
            data: {
              pollId,
              recipientId,
            },
          });
          sentCount++;
        } catch (err) {
          console.error(`Failed to nudge user ${recipientId}:`, err);
        }
      }

      const confirmationText =
        sentCount === 0
          ? 'No pending votes found. Everyone has already cast their ballot!'
          : `📬 Sent private reminders to ${sentCount} ${sentCount === 1 ? 'teammate' : 'teammates'}.`;

      if (blockAction.channel?.id) {
        try {
          await client.chat.postEphemeral({
            channel: blockAction.channel.id,
            user: blockAction.user.id,
            text: confirmationText,
          });
        } catch {
          // ignore
        }
      } else {
        try {
          await client.chat.postMessage({
            channel: blockAction.user.id,
            text: confirmationText,
          });
        } catch {
          // ignore
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while sending reminders.';

      if (blockAction.channel?.id) {
        try {
          await client.chat.postEphemeral({
            channel: blockAction.channel.id,
            user: blockAction.user.id,
            text: errorMessage,
          });
        } catch {
          // ignore
        }
      } else {
        try {
          await client.chat.postMessage({
            channel: blockAction.user.id,
            text: errorMessage,
          });
        } catch {
          // ignore
        }
      }
    }
  });

  // Handle "Launch New Poll" from App Home
  app.action('app_home_launch_poll_click', async ({ ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const workspaceId = blockAction.team?.id ?? '';
    const userId = blockAction.user.id;

    try {
      const [settings, templates] = await Promise.all([
        PollService.getWorkspaceSettings(workspaceId),
        PollService.listTemplates(workspaceId, userId),
      ]);

      await client.views.open({
        trigger_id: blockAction.trigger_id,
        view: buildCreatePollModalView({
          channelId: '',
          isAnonymous: settings.defaultAnonymous,
          quorumType: (settings.defaultQuorumType as 'PERCENTAGE' | 'NONE') || 'PERCENTAGE',
          quorumTarget: settings.defaultQuorumPct,
          availableTemplates: templates.map((t: any) => ({
            id: t.id,
            name: t.name,
            isShared: t.isShared,
          })),
        }),
      });
    } catch (error) {
      console.error('Failed to open create poll modal from App Home:', error);
    }
  });

  // Handle Quick Template buttons from App Home or Templates Modal (matches app_home_template_*)
  app.action(/^app_home_template_/, async ({ action, ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const actionObj = action as { action_id?: string; value?: string };
    const templateKey =
      actionObj.value ??
      actionObj.action_id?.replace(/^app_home_template_/, '') ??
      'standup';
    const preset = APP_HOME_TEMPLATES[templateKey] ?? APP_HOME_TEMPLATES.standup;

    try {
      const viewObj = (blockAction as any).view;
      if (viewObj?.type === 'modal' && viewObj?.id) {
        await client.views.update({
          view_id: viewObj.id,
          view: buildCreatePollModalView(preset),
        });
      } else {
        await client.views.open({
          trigger_id: blockAction.trigger_id,
          view: buildCreatePollModalView(preset),
        });
      }
    } catch (error) {
      console.error('Failed to open template modal from App Home:', error);
    }
  });

  // Handle Analytics Modal button from App Home
  app.action('open_analytics_modal', async ({ ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const workspaceId = blockAction.team?.id ?? '';
    const userId = blockAction.user.id;

    try {
      const viewer = await PollService.getReportViewer(client, userId, workspaceId);
      const stats = await PollService.getPollAnalyticsStats(workspaceId, viewer, 30);
      await client.views.open({
        trigger_id: blockAction.trigger_id,
        view: buildAnalyticsModalView(stats, 30),
      });
    } catch (error) {
      console.error('Failed to open analytics modal:', error);
    }
  });

  // Handle Poll Detailed Results button (matches poll_view_results_click)
  app.action(/^poll_view_results_click/, async ({ action, ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const rawVal = (action as { value?: string }).value;
    if (!rawVal) return;

    let pollId = rawVal;
    try {
      const parsed = JSON.parse(rawVal);
      if (typeof parsed === 'object' && parsed !== null && parsed.pollId) {
        pollId = parsed.pollId;
      }
    } catch {
      // plain string ID
    }

    const userId = blockAction.user.id;
    const workspaceId = blockAction.team?.id ?? '';

    try {
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          options: { orderBy: { index: 'asc' } },
          participations: true,
          publicVotes: true,
        },
      });

      if (!poll) {
        throw new Error('Poll not found.');
      }

      const viewer = await PollService.getReportViewer(
        client,
        userId,
        workspaceId || poll.workspaceId
      );
      if (poll.creatorId !== userId && !viewer.isManager) {
        throw new Error(
          'Only the poll creator or a workspace admin can view detailed results for this poll.'
        );
      }

      await client.views.open({
        trigger_id: blockAction.trigger_id,
        view: buildPollDetailModalView(poll),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Could not open poll details.';
      if (blockAction.channel?.id) {
        try {
          await client.chat.postEphemeral({
            channel: blockAction.channel.id,
            user: userId,
            text: errorMessage,
          });
        } catch {
          // ignore
        }
      } else {
        try {
          await client.chat.postMessage({
            channel: userId,
            text: errorMessage,
          });
        } catch {
          // ignore
        }
      }
    }
  });

  // Handle "Export CSV" button from App Home or Analytics Modal
  app.action('app_home_export_csv_click', async ({ ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const workspaceId = blockAction.team?.id ?? '';
    const userId = blockAction.user.id;

    try {
      const viewer = await PollService.getReportViewer(client, userId, workspaceId);
      const polls = await PollService.getAuthorizedPolls(workspaceId, viewer, 50);
      const csvContent = buildPollsCsvReport(polls);
      const view = buildCsvExportModalView({ csvContent, polls });

      if (
        (blockAction as any).view?.type === 'modal' &&
        typeof (client.views as any).push === 'function'
      ) {
        try {
          await client.views.push({
            trigger_id: blockAction.trigger_id,
            view,
          });
          return;
        } catch {
          // fallback to views.open
        }
      }

      await client.views.open({
        trigger_id: blockAction.trigger_id,
        view,
      });
    } catch (error) {
      console.error('Failed to open CSV export modal from App Home:', error);
    }
  });

  // Handle "Apply Filters" in CSV Export Modal
  app.action('csv_apply_filters_click', async ({ ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const workspaceId = blockAction.team?.id ?? '';
    const userId = blockAction.user.id;
    const viewObj = (blockAction as any).view;
    if (!viewObj?.id) return;

    try {
      const values = viewObj.state?.values ?? {};
      const startDate =
        values.csv_start_date_block?.csv_start_date_select?.selected_date ?? undefined;
      const endDate =
        values.csv_end_date_block?.csv_end_date_select?.selected_date ?? undefined;
      const statusFilter =
        values.csv_status_filter_block?.csv_status_filter_select?.selected_option?.value ??
        'ALL';
      const selectedPollIds = (
        values.csv_polls_select_block?.csv_polls_multi_select?.selected_options ?? []
      ).map((o: any) => o.value);

      const viewer = await PollService.getReportViewer(client, userId, workspaceId);
      const allPolls = await PollService.getAuthorizedPolls(workspaceId, viewer, 50);
      const filtered = PollService.filterPollsForCsv(allPolls, {
        startDate,
        endDate,
        statusFilter,
        selectedPollIds,
      });

      const csvContent = buildPollsCsvReport(filtered);
      await client.views.update({
        view_id: viewObj.id,
        view: buildCsvExportModalView({
          csvContent,
          polls: allPolls,
          filters: {
            startDate,
            endDate,
            status: statusFilter as any,
            selectedPollIds,
          },
        }),
      });
    } catch (error) {
      console.error('Failed to apply CSV filters:', error);
    }
  });

  // Handle Templates Modal actions
  app.action('open_templates_modal', async ({ ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const workspaceId = blockAction.team?.id ?? '';
    const userId = blockAction.user.id;

    try {
      const [templates, isManager] = await Promise.all([
        PollService.listTemplates(workspaceId, userId),
        PollService.isUserWorkspaceManager(client, userId, workspaceId),
      ]);

      await client.views.open({
        trigger_id: blockAction.trigger_id,
        view: buildTemplatesModalView(templates as any, userId, { tab: 'mine', isManager }),
      });
    } catch (error) {
      console.error('Failed to open templates modal:', error);
    }
  });

  app.action('templates_tab_mine', async ({ ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const workspaceId = blockAction.team?.id ?? '';
    const userId = blockAction.user.id;
    const viewId = (blockAction as any).view?.id;
    if (!viewId) return;

    try {
      const [templates, isManager] = await Promise.all([
        PollService.listTemplates(workspaceId, userId),
        PollService.isUserWorkspaceManager(client, userId, workspaceId),
      ]);
      await client.views.update({
        view_id: viewId,
        view: buildTemplatesModalView(templates as any, userId, { tab: 'mine', isManager }),
      });
    } catch (error) {
      console.error('Failed to switch templates tab to mine:', error);
    }
  });

  app.action('templates_tab_workspace', async ({ ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const workspaceId = blockAction.team?.id ?? '';
    const userId = blockAction.user.id;
    const viewId = (blockAction as any).view?.id;
    if (!viewId) return;

    try {
      const [templates, isManager] = await Promise.all([
        PollService.listTemplates(workspaceId, userId),
        PollService.isUserWorkspaceManager(client, userId, workspaceId),
      ]);
      await client.views.update({
        view_id: viewId,
        view: buildTemplatesModalView(templates as any, userId, {
          tab: 'workspace',
          isManager,
        }),
      });
    } catch (error) {
      console.error('Failed to switch templates tab to workspace:', error);
    }
  });

  app.action('template_row_menu', async ({ action, ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const workspaceId = blockAction.team?.id ?? '';
    const userId = blockAction.user.id;
    const viewId = (blockAction as any).view?.id;
    const selectedValue = (action as any).selected_option?.value as string | undefined;
    if (!selectedValue) return;

    const [verb, templateId] = selectedValue.split(':');
    if (!verb || !templateId) return;

    try {
      if (verb === 'launch' || verb === 'edit') {
        const tpl = await PollService.getTemplate(templateId, workspaceId, userId);
        if (!tpl) return;
        const modalView = buildCreatePollModalView({
          channelId: tpl.channelId ?? undefined,
          question: tpl.question,
          options: tpl.options,
          isAnonymous: tpl.isAnonymous,
          allowMultipleVotes: tpl.allowMultipleVotes,
          quorumType: (tpl.quorumType as 'PERCENTAGE' | 'NONE') || 'PERCENTAGE',
          quorumTarget: tpl.quorumTarget,
          duration: tpl.duration as any,
          ...(verb === 'edit'
            ? { templateName: tpl.name, editTemplateId: tpl.id }
            : {}),
        });
        if (viewId) {
          await client.views.update({ view_id: viewId, view: modalView });
        } else if (blockAction.trigger_id) {
          await client.views.open({ trigger_id: blockAction.trigger_id, view: modalView });
        }
        return;
      }

      const isManager = await PollService.isUserWorkspaceManager(client, userId, workspaceId);
      let nextTab: 'mine' | 'workspace' = 'mine';
      let confirmDeleteId: string | undefined;

      if (verb === 'share' || verb === 'unshare') {
        await PollService.setTemplateShared(templateId, workspaceId, userId, verb === 'share');
      } else if (verb === 'duplicate') {
        await PollService.duplicateTemplate(templateId, workspaceId, userId);
        nextTab = 'mine';
      } else if (verb === 'delete') {
        confirmDeleteId = templateId;
      } else if (verb === 'unpublish' && isManager) {
        await PollService.unpublishTemplate(templateId, workspaceId);
        nextTab = 'workspace';
      }

      if (viewId) {
        const templates = await PollService.listTemplates(workspaceId, userId);
        await client.views.update({
          view_id: viewId,
          view: buildTemplatesModalView(templates as any, userId, {
            tab: nextTab,
            isManager,
            confirmDeleteId,
          }),
        });
      }
    } catch (error) {
      console.error('Failed to process template_row_menu action:', error);
    }
  });

  app.action('confirm_delete_template', async ({ action, ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const workspaceId = blockAction.team?.id ?? '';
    const userId = blockAction.user.id;
    const viewId = (blockAction as any).view?.id;
    const templateId = (action as { value?: string }).value;
    if (!templateId || !viewId) return;

    try {
      const isManager = await PollService.isUserWorkspaceManager(client, userId, workspaceId);
      await PollService.deleteTemplate(templateId, workspaceId, userId, isManager);
      const templates = await PollService.listTemplates(workspaceId, userId);
      await client.views.update({
        view_id: viewId,
        view: buildTemplatesModalView(templates as any, userId, { tab: 'mine', isManager }),
      });
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  });

  app.action('cancel_delete_template', async ({ ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const workspaceId = blockAction.team?.id ?? '';
    const userId = blockAction.user.id;
    const viewId = (blockAction as any).view?.id;
    if (!viewId) return;

    try {
      const [templates, isManager] = await Promise.all([
        PollService.listTemplates(workspaceId, userId),
        PollService.isUserWorkspaceManager(client, userId, workspaceId),
      ]);
      await client.views.update({
        view_id: viewId,
        view: buildTemplatesModalView(templates as any, userId, { tab: 'mine', isManager }),
      });
    } catch (error) {
      console.error('Failed to cancel template deletion:', error);
    }
  });

  // Handle Guide & Documentation Modal
  const handleOpenGuide = async ({ ack, body, client }: any) => {
    await ack();
    const blockAction = body as BlockAction | undefined;
    if (!blockAction?.trigger_id) return;
    try {
      await client.views.open({
        trigger_id: blockAction.trigger_id,
        view: buildGuideModalView(),
      });
    } catch (error) {
      console.error('Failed to open guide modal:', error);
    }
  };

  app.action('open_guide_modal', handleOpenGuide);
  app.action('app_home_docs_click', handleOpenGuide);

  // Handle Settings Modal
  app.action('open_settings_modal', async ({ ack, body, client }) => {
    await ack();
    const blockAction = body as BlockAction;
    const workspaceId = blockAction.team?.id ?? '';
    const userId = blockAction.user.id;

    try {
      const [settings, canEdit] = await Promise.all([
        PollService.getWorkspaceSettings(workspaceId),
        PollService.isUserWorkspaceManager(client, userId, workspaceId),
      ]);

      await client.views.open({
        trigger_id: blockAction.trigger_id,
        view: buildSettingsModalView({
          workspaceId,
          canEdit,
          allowMultipleActivePolls: settings.allowMultipleActivePolls,
          defaultAnonymous: settings.defaultAnonymous,
          defaultQuorumPct: settings.defaultQuorumPct,
          allowVoterChoiceNudges: settings.allowVoterChoiceNudges,
          maxNudgeChannelMembers: settings.maxNudgeChannelMembers,
          managerUserIds: settings.managerUserIds,
        }),
      });
    } catch (error) {
      console.error('Failed to open settings modal:', error);
    }
  });
}
