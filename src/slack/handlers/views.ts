import type { App } from '@slack/bolt';
import { z } from 'zod';
import { PollService } from '../../services/pollService.js';
import { buildPollMessageBlocks } from '../ui/views/pollMessage.js';
import { getEligibleChannelMembers } from '../utils/channelMembers.js';
import {
  findActiveHuddleThread,
  parseHuddleThreadInput,
} from '../utils/huddleDiscovery.js';
import { publishHomeTab } from './events.js';
import { normalizeLocale } from '../../i18n/index.js';
import { LocalizedError } from '../../i18n/errors.js';

export const createPollSubmissionSchema = z.object({
  selectedChannel: z.string().min(1, 'Please select a channel for this poll'),
  question: z
    .string()
    .min(1, 'Please provide a poll question')
    .max(150, 'Question must not exceed 150 characters'),
  opt1: z
    .string()
    .min(1, 'Option 1 is required')
    .max(200, 'Option 1 must not exceed 200 characters'),
  opt2: z
    .string()
    .min(1, 'Option 2 is required')
    .max(200, 'Option 2 must not exceed 200 characters'),
  opt3: z
    .string()
    .max(200, 'Option 3 must not exceed 200 characters')
    .optional(),
  opt4: z
    .string()
    .max(200, 'Option 4 must not exceed 200 characters')
    .optional(),
  quorumTarget: z
    .number({ invalid_type_error: 'Quorum target must be an integer between 51 and 100' })
    .int('Quorum target must be an integer between 51 and 100')
    .min(51, 'Quorum requires a strict majority (51% to 100%)')
    .max(100, 'Quorum target must be between 51 and 100')
    .optional(),
});

export function registerViewHandlers(app: App) {
  app.view('create_poll_modal_submit', async ({ ack, view, body, client }) => {
    const values = view.state.values;

    // Parse channel ID, threadTs, and huddleMode from metadata
    let channelIdFromMeta = '';
    let threadTsFromMeta: string | null = null;
    let huddleModeFromMeta = false;
    try {
      const meta = JSON.parse(view.private_metadata || '{}') as {
        channelId?: string;
        threadTs?: string | null;
        huddleMode?: boolean;
      };
      channelIdFromMeta = meta.channelId || '';
      threadTsFromMeta = meta.threadTs || null;
      huddleModeFromMeta = Boolean(meta.huddleMode || meta.threadTs);
    } catch {
      channelIdFromMeta = '';
      threadTsFromMeta = null;
      huddleModeFromMeta = false;
    }

    const selectedChannel =
      values.channel_block?.channel_select?.selected_conversation ||
      channelIdFromMeta;

    const question = values.question_block?.question_input?.value?.trim() ?? '';
    const opt1 = values.option_1_block?.option_1_input?.value?.trim() ?? '';
    const opt2 = values.option_2_block?.option_2_input?.value?.trim() ?? '';
    const opt3 = values.option_3_block?.option_3_input?.value?.trim();
    const opt4 = values.option_4_block?.option_4_input?.value?.trim();

    const selectedOptions = values.settings_block?.anonymous_checkbox?.selected_options ?? [];
    const isAnonymous = selectedOptions.some((o: any) => o.value === 'is_anonymous');
    const allowMultipleVotes = selectedOptions.some((o: any) => o.value === 'allow_multiple_votes');
    const noQuorumChecked = selectedOptions.some((o: any) => o.value === 'no_quorum');
    const forwardToChannelOnHuddleEnd = selectedOptions.some((o: any) => o.value === 'forward_on_huddle_end');

    const rawQuorum = values.quorum_block?.quorum_input?.value?.trim() ?? '';
    const quorumType: 'PERCENTAGE' | 'NONE' = noQuorumChecked ? 'NONE' : 'PERCENTAGE';
    const parsedQuorum = noQuorumChecked
      ? undefined
      : rawQuorum === ''
        ? 70
        : Number(rawQuorum);

    const validationResult = createPollSubmissionSchema.safeParse({
      selectedChannel,
      question,
      opt1,
      opt2,
      opt3: opt3 || undefined,
      opt4: opt4 || undefined,
      quorumTarget: parsedQuorum,
    });

    if (!validationResult.success) {
      const errors: Record<string, string> = {};
      for (const issue of validationResult.error.issues) {
        const field = issue.path[0];
        if (field === 'selectedChannel') {
          errors.channel_block = issue.message;
        } else if (field === 'question') {
          errors.question_block = issue.message;
        } else if (field === 'opt1') {
          errors.option_1_block = issue.message;
        } else if (field === 'opt2') {
          errors.option_2_block = issue.message;
        } else if (field === 'opt3') {
          errors.option_3_block = issue.message;
        } else if (field === 'opt4') {
          errors.option_4_block = issue.message;
        } else if (field === 'quorumTarget') {
          errors.quorum_block = issue.message;
        }
      }

      await ack({
        response_action: 'errors',
        errors,
      });
      return;
    }

    const validated = validationResult.data;
    const workspaceId =
      body.team?.id ||
      (body as any).view?.team_id ||
      (body as any).user?.team_id ||
      '';

    // Enforce Single Active Poll per Channel Policy before ack()
    if (workspaceId && validated.selectedChannel) {
      try {
        await PollService.assertCanCreatePollInChannel(workspaceId, validated.selectedChannel);
      } catch (err: any) {
        await ack({
          response_action: 'errors',
          errors: {
            channel_block:
              err?.message || 'An active poll is already running in this channel.',
          },
        });
        return;
      }
    }

    const customThreadRaw =
      values.huddle_thread_block?.huddle_thread_input?.value?.trim() ?? '';
    if (customThreadRaw) {
      const parsedCustomTs = parseHuddleThreadInput(customThreadRaw);
      if (!parsedCustomTs) {
        await ack({
          response_action: 'errors',
          errors: {
            huddle_thread_block:
              'Invalid Slack thread link or timestamp. Paste a Slack message URL (.../archives/C.../p1234567890123456) or thread_ts (1234567890.123456).',
          },
        });
        return;
      }
      threadTsFromMeta = parsedCustomTs;
    } else if (
      huddleModeFromMeta &&
      (!threadTsFromMeta ||
        (channelIdFromMeta && validated.selectedChannel !== channelIdFromMeta))
    ) {
      threadTsFromMeta = await findActiveHuddleThread(
        client,
        validated.selectedChannel
      );
      if (!threadTsFromMeta) {
        await ack({
          response_action: 'errors',
          errors: {
            huddle_thread_block:
              'No active Huddle was detected in this channel. Start a Huddle first, or paste the Huddle message link here.',
          },
        });
        return;
      }
    }

    await ack();

    const options = [validated.opt1, validated.opt2, validated.opt3, validated.opt4].filter(
      (opt): opt is string => Boolean(opt && opt.trim().length > 0)
    );

    const durationValue = values.duration_block?.duration_select?.selected_option?.value ?? 'none';
    let closesAt: Date | null = null;
    const now = Date.now();
    if (durationValue === '15m') {
      closesAt = new Date(now + 15 * 60 * 1000);
    } else if (durationValue === '1h') {
      closesAt = new Date(now + 60 * 60 * 1000);
    } else if (durationValue === '4h') {
      closesAt = new Date(now + 4 * 60 * 60 * 1000);
    } else if (durationValue === '24h') {
      closesAt = new Date(now + 24 * 60 * 60 * 1000);
    } else if (durationValue === '72h') {
      closesAt = new Date(now + 72 * 60 * 60 * 1000);
    } else if (durationValue === '7d') {
      closesAt = new Date(now + 7 * 24 * 60 * 60 * 1000);
    }

    // Optional template save
    const saveTemplateOptions =
      values.save_template_block?.save_template_checkbox?.selected_options ?? [];
    const saveAsTemplate = saveTemplateOptions.some(
      (o: any) => o.value === 'save_as_template' || o.value === 'is_shared'
    );
    const isShared = saveTemplateOptions.some((o: any) => o.value === 'is_shared');
    if (saveAsTemplate && workspaceId) {
      const templateName =
        values.template_name_block?.template_name_input?.value?.trim() ||
        validated.question.slice(0, 75);
      try {
        await PollService.saveTemplate({
          workspaceId,
          ownerUserId: body.user.id,
          name: templateName,
          channelId: validated.selectedChannel,
          question: validated.question,
          options,
          isAnonymous,
          allowMultipleVotes,
          quorumType,
          quorumTarget: validated.quorumTarget ?? 70,
          duration: durationValue,
          forwardToChannelOnHuddleEnd,
          isShared,
        });
        publishHomeTab(client, body.user.id, workspaceId).catch(() => {});
      } catch (tplErr) {
        console.error('Failed to save template during poll creation:', tplErr);
      }
    }

    try {
      // 1. Attempt to auto-join if it's a public channel
      try {
        await client.conversations.join({ channel: validated.selectedChannel });
      } catch {
        // Safe to ignore if already in channel or private channel
      }

      // 2. Measure channel members for quorum calculation (excluding bot)
      const members = await getEligibleChannelMembers(client, validated.selectedChannel);
      const memberCount = members.length > 0 ? members.length : 10;

      // 3. Post placeholder message to reserve messageTs (and thread_ts if inside a Huddle thread)
      const placeholder = await client.chat.postMessage({
        channel: validated.selectedChannel,
        text: `Launching poll: ${validated.question}...`,
        ...(threadTsFromMeta ? { thread_ts: threadTsFromMeta } : {}),
      });

      if (!placeholder.ts) {
        throw new LocalizedError('poll.create.reserveFailed');
      }

      // 4. Persist in database
      const { getRequestTranslator, getPollTranslator } = await import('../utils/locale.js');
      const creatorTranslator = await getRequestTranslator(client, {
        userId: body.user.id,
        workspaceId,
      });

      const poll = await PollService.createPoll({
        workspaceId,
        channelId: validated.selectedChannel,
        messageTs: placeholder.ts,
        threadTs: threadTsFromMeta,
        creatorId: body.user.id,
        question: validated.question,
        options,
        isAnonymous,
        allowMultipleVotes,
        quorumType,
        quorumTarget: validated.quorumTarget ?? 70,
        eligibleVoterCount: memberCount,
        closesAt,
        forwardToChannelOnHuddleEnd,
        locale: creatorTranslator.locale,
      });

      // 5. Render pure Block Kit card with workspace settings
      const settings = workspaceId
        ? await PollService.getWorkspaceSettings(workspaceId)
        : undefined;
      const pollTranslator = getPollTranslator(poll);
      const blocks = buildPollMessageBlocks(
        {
          ...poll,
          participations: [],
        },
        {
          maxNudgeChannelMembers: settings?.maxNudgeChannelMembers,
          allowVoterChoiceNudges: settings?.allowVoterChoiceNudges,
          translator: pollTranslator,
        }
      );

      await client.chat.update({
        channel: validated.selectedChannel,
        ts: placeholder.ts,
        text: pollTranslator.t('poll.fallback.active', { question: validated.question }),
        blocks,
      });
    } catch (error: any) {
      console.error('Failed to create poll from modal:', error);
      const isNotInChannel =
        error?.data?.error === 'not_in_channel' ||
        error?.message?.includes('not_in_channel');

      const notice = isNotInChannel
        ? `Pollito is not in <#${validated.selectedChannel}>. Please invite the bot by typing \`/invite @Pollito\` in that channel, then launch your poll.`
        : `Could not create poll: ${error?.message || 'Unknown error'}.`;

      try {
        await client.chat.postMessage({
          channel: body.user.id,
          text: notice,
        });
      } catch (dmErr) {
        console.error('Failed to send error notification to user DM:', dmErr);
      }
    }
  });

  app.view('edit_template_modal_submit', async ({ ack, view, body, client }) => {
    const values = view.state.values;
    let editTemplateId = '';
    let channelIdFromMeta = '';
    try {
      const meta = JSON.parse(view.private_metadata || '{}') as {
        editTemplateId?: string;
        channelId?: string;
      };
      editTemplateId = meta.editTemplateId || '';
      channelIdFromMeta = meta.channelId || '';
    } catch {
      editTemplateId = '';
    }

    const selectedChannel =
      values.channel_block?.channel_select?.selected_conversation ||
      channelIdFromMeta ||
      'C_TEMPLATE';
    const question = values.question_block?.question_input?.value?.trim() ?? '';
    const opt1 = values.option_1_block?.option_1_input?.value?.trim() ?? '';
    const opt2 = values.option_2_block?.option_2_input?.value?.trim() ?? '';
    const opt3 = values.option_3_block?.option_3_input?.value?.trim();
    const opt4 = values.option_4_block?.option_4_input?.value?.trim();

    const selectedOptions = values.settings_block?.anonymous_checkbox?.selected_options ?? [];
    const isAnonymous = selectedOptions.some((o: any) => o.value === 'is_anonymous');
    const allowMultipleVotes = selectedOptions.some((o: any) => o.value === 'allow_multiple_votes');
    const noQuorumChecked = selectedOptions.some((o: any) => o.value === 'no_quorum');
    const forwardToChannelOnHuddleEnd = selectedOptions.some((o: any) => o.value === 'forward_on_huddle_end');

    const shareSelected =
      values.template_share_block?.template_share_checkbox?.selected_options ?? [];
    const isShared = shareSelected.some((o: any) => o.value === 'is_shared');

    const rawQuorum = values.quorum_block?.quorum_input?.value?.trim() ?? '';
    const quorumType: 'PERCENTAGE' | 'NONE' = noQuorumChecked ? 'NONE' : 'PERCENTAGE';
    const parsedQuorum = noQuorumChecked
      ? undefined
      : rawQuorum === ''
        ? 70
        : Number(rawQuorum);

    const validationResult = createPollSubmissionSchema.safeParse({
      selectedChannel,
      question,
      opt1,
      opt2,
      opt3: opt3 || undefined,
      opt4: opt4 || undefined,
      quorumTarget: parsedQuorum,
    });

    if (!validationResult.success) {
      const errors: Record<string, string> = {};
      for (const issue of validationResult.error.issues) {
        const field = issue.path[0];
        if (field === 'question') errors.question_block = issue.message;
        else if (field === 'opt1') errors.option_1_block = issue.message;
        else if (field === 'opt2') errors.option_2_block = issue.message;
        else if (field === 'opt3') errors.option_3_block = issue.message;
        else if (field === 'opt4') errors.option_4_block = issue.message;
        else if (field === 'quorumTarget') errors.quorum_block = issue.message;
      }
      await ack({ response_action: 'errors', errors });
      return;
    }

    await ack();

    if (!editTemplateId) return;

    const validated = validationResult.data;
    const options = [validated.opt1, validated.opt2, validated.opt3, validated.opt4].filter(
      (opt): opt is string => Boolean(opt && opt.trim().length > 0)
    );
    const durationValue = values.duration_block?.duration_select?.selected_option?.value ?? 'none';
    const templateName =
      values.template_name_block?.template_name_input?.value?.trim() ||
      validated.question.slice(0, 75);
    const workspaceId =
      body.team?.id ||
      (body as any).view?.team_id ||
      (body as any).user?.team_id ||
      '';

    try {
      await PollService.updateTemplate(editTemplateId, workspaceId, body.user.id, {
        name: templateName,
        channelId:
          values.channel_block?.channel_select?.selected_conversation ||
          channelIdFromMeta ||
          undefined,
        question: validated.question,
        options,
        isAnonymous,
        allowMultipleVotes,
        quorumType,
        quorumTarget: validated.quorumTarget ?? 70,
        duration: durationValue,
        forwardToChannelOnHuddleEnd,
        ...(shareSelected.length > 0 ? { isShared } : {}),
      });

      await publishHomeTab(client, body.user.id, workspaceId);
    } catch (error) {
      console.error('Failed to update template from modal:', error);
    }
  });

  app.view('create_template_modal_submit', async ({ ack, view, body, client }) => {
    const values = view.state.values;

    let metadata: any = {};
    try {
      metadata = JSON.parse(view.private_metadata || '{}');
    } catch {
      // ignore
    }

    const templateName = values.template_name_block?.template_name_input?.value?.trim() || '';
    if (!templateName) {
      await ack({
        response_action: 'errors',
        errors: {
          template_name_block: 'Please provide a name for this template.',
        },
      });
      return;
    }

    const channelIdFromMeta = metadata.channelId || '';
    const selectedChannel =
      values.channel_block?.channel_select?.selected_conversation ||
      channelIdFromMeta ||
      'C_TEMPLATE';
    const question = values.question_block?.question_input?.value?.trim() ?? '';
    const opt1 = values.option_1_block?.option_1_input?.value?.trim() ?? '';
    const opt2 = values.option_2_block?.option_2_input?.value?.trim() ?? '';
    const opt3 = values.option_3_block?.option_3_input?.value?.trim();
    const opt4 = values.option_4_block?.option_4_input?.value?.trim();

    const selectedOptions = values.settings_block?.anonymous_checkbox?.selected_options ?? [];
    const isAnonymous = selectedOptions.some((o: any) => o.value === 'is_anonymous');
    const allowMultipleVotes = selectedOptions.some((o: any) => o.value === 'allow_multiple_votes');
    const noQuorumChecked = selectedOptions.some((o: any) => o.value === 'no_quorum');
    const forwardToChannelOnHuddleEnd = selectedOptions.some(
      (o: any) => o.value === 'forward_on_huddle_end'
    );

    const shareSelected =
      values.template_share_block?.template_share_checkbox?.selected_options ?? [];
    const isShared =
      shareSelected.length > 0
        ? shareSelected.some((o: any) => o.value === 'is_shared')
        : Boolean(metadata.isShared);

    const rawQuorum = values.quorum_block?.quorum_input?.value?.trim() ?? '';
    const quorumType: 'PERCENTAGE' | 'NONE' = noQuorumChecked ? 'NONE' : 'PERCENTAGE';
    const parsedQuorum = noQuorumChecked
      ? undefined
      : rawQuorum === ''
        ? 70
        : Number(rawQuorum);

    const validationResult = createPollSubmissionSchema.safeParse({
      selectedChannel,
      question,
      opt1,
      opt2,
      opt3: opt3 || undefined,
      opt4: opt4 || undefined,
      quorumTarget: parsedQuorum,
    });

    if (!validationResult.success) {
      const errors: Record<string, string> = {};
      for (const issue of validationResult.error.issues) {
        const field = issue.path[0];
        if (field === 'question') errors.question_block = issue.message;
        else if (field === 'opt1') errors.option_1_block = issue.message;
        else if (field === 'opt2') errors.option_2_block = issue.message;
        else if (field === 'opt3') errors.option_3_block = issue.message;
        else if (field === 'opt4') errors.option_4_block = issue.message;
        else if (field === 'quorumTarget') errors.quorum_block = issue.message;
      }
      await ack({ response_action: 'errors', errors });
      return;
    }

    await ack();

    const validated = validationResult.data;
    const options = [validated.opt1, validated.opt2, validated.opt3, validated.opt4].filter(
      (opt): opt is string => Boolean(opt && opt.trim().length > 0)
    );
    const durationValue = values.duration_block?.duration_select?.selected_option?.value ?? 'none';
    const workspaceId =
      body.team?.id ||
      (body as any).view?.team_id ||
      (body as any).user?.team_id ||
      '';

    try {
      await PollService.saveTemplate({
        workspaceId,
        ownerUserId: body.user.id,
        name: templateName,
        channelId:
          values.channel_block?.channel_select?.selected_conversation ||
          channelIdFromMeta ||
          undefined,
        question: validated.question,
        options,
        isAnonymous,
        allowMultipleVotes,
        quorumType,
        quorumTarget: validated.quorumTarget ?? 70,
        duration: durationValue,
        forwardToChannelOnHuddleEnd,
        isShared,
      });

      await publishHomeTab(client, body.user.id, workspaceId);
    } catch (error) {
      console.error('Failed to create template from modal:', error);
    }
  });

  app.view('submit_settings_modal', async ({ ack, view, body, client }) => {
    const workspaceId =
      body.team?.id ||
      (body as any).view?.team_id ||
      (body as any).user?.team_id ||
      '';

    const canEdit = await PollService.isUserWorkspaceManager(client, body.user.id, workspaceId);
    if (!canEdit) {
      await ack();
      return;
    }

    const values = view.state.values;
    const concurrencySelected =
      values.concurrency_settings_block?.concurrency_checkbox?.selected_options ?? [];
    const allowMultipleActivePolls = concurrencySelected.some(
      (o: any) => o.value === 'allow_multiple_active_polls'
    );

    const privacySelected =
      values.privacy_settings_block?.privacy_nudge_checkbox?.selected_options ?? [];
    const defaultAnonymous = privacySelected.some((o: any) => o.value === 'default_anonymous');
    const allowVoterChoiceNudges = privacySelected.some(
      (o: any) => o.value === 'allow_voter_choice_nudges'
    );

    const quorumOptionVal =
      values.default_quorum_block?.default_quorum_select?.selected_option?.value ?? '70';
    const defaultQuorumType: 'PERCENTAGE' | 'NONE' =
      quorumOptionVal === 'NONE' ? 'NONE' : 'PERCENTAGE';
    const defaultQuorumPct =
      quorumOptionVal === 'NONE' ? 70 : Math.max(51, Math.min(100, Number(quorumOptionVal) || 70));

    const rawMaxNudge =
      values.max_nudge_members_block?.max_nudge_members_input?.value?.trim() ?? '50';
    const parsedMaxNudge = Number(rawMaxNudge);
    if (
      !Number.isInteger(parsedMaxNudge) ||
      parsedMaxNudge < 5 ||
      parsedMaxNudge > 500
    ) {
      await ack({
        response_action: 'errors',
        errors: {
          max_nudge_members_block:
            'Maximum channel size for Smart Nudges must be an integer between 5 and 500.',
        },
      });
      return;
    }

    const managerUserIds =
      values.manager_settings_block?.manager_users_select?.selected_users ?? [];

    const selectedLocaleValue =
      values.workspace_locale_block?.workspace_locale_select?.selected_option?.value;
    const localeToSave =
      selectedLocaleValue === 'auto' ? null : normalizeLocale(selectedLocaleValue);

    await ack();

    try {
      await PollService.updateWorkspaceSettings(workspaceId, {
        allowMultipleActivePolls,
        defaultAnonymous,
        defaultQuorumType,
        defaultQuorumPct,
        allowVoterChoiceNudges,
        maxNudgeChannelMembers: parsedMaxNudge,
        managerUserIds,
        ...(selectedLocaleValue !== undefined ? { locale: localeToSave } : {}),
      });

      await publishHomeTab(client, body.user.id, workspaceId);
    } catch (error) {
      console.error('Failed to save workspace settings:', error);
    }
  });

  const handleBulkDeletePolls = async ({ ack, view, body, client }: any) => {
    const selected =
      view.state.values.delete_polls_select_block?.delete_polls_multi_select?.selected_options ?? [];
    const pollIds = selected.map((o: any) => o.value).filter(Boolean);

    if (pollIds.length === 0) {
      await ack({
        response_action: 'errors',
        errors: {
          delete_polls_select_block: 'Please select at least one poll to delete.',
        },
      });
      return;
    }

    await ack();

    const workspaceId =
      body.team?.id ||
      (body as any).view?.team_id ||
      (body as any).user?.team_id ||
      '';
    const userId = body.user.id;

    try {
      const isManager = await PollService.isUserWorkspaceManager(
        client,
        userId,
        workspaceId
      );
      await PollService.deletePollsBulk(
        pollIds,
        workspaceId,
        userId,
        isManager
      );

      await publishHomeTab(client, userId, workspaceId);
    } catch (error) {
      console.error('Failed to bulk delete polls:', error);
    }
  };

  app.view('manage_history_modal_submit', handleBulkDeletePolls);
  app.view('delete_polls_modal', handleBulkDeletePolls);
}
