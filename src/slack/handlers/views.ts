import type { App } from '@slack/bolt';
import { z } from 'zod';
import { PollService } from '../../services/pollService.js';
import { buildPollMessageBlocks } from '../ui/views/pollMessage.js';
import { getEligibleChannelMembers } from '../utils/channelMembers.js';

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
    .number({ invalid_type_error: 'Quorum target must be an integer between 10 and 100' })
    .int('Quorum target must be an integer between 10 and 100')
    .min(10, 'Quorum target must be between 10 and 100')
    .max(100, 'Quorum target must be between 10 and 100'),
});

export function registerViewHandlers(app: App) {
  app.view('create_poll_modal_submit', async ({ ack, view, body, client }) => {
    const values = view.state.values;

    // Parse channel ID from channel selector or fallback to metadata
    let channelIdFromMeta = '';
    try {
      const meta = JSON.parse(view.private_metadata || '{}') as { channelId?: string };
      channelIdFromMeta = meta.channelId || '';
    } catch {
      channelIdFromMeta = '';
    }

    const selectedChannel =
      values.channel_block?.channel_select?.selected_conversation ||
      channelIdFromMeta;

    const question = values.question_block?.question_input?.value?.trim() ?? '';
    const opt1 = values.option_1_block?.option_1_input?.value?.trim() ?? '';
    const opt2 = values.option_2_block?.option_2_input?.value?.trim() ?? '';
    const opt3 = values.option_3_block?.option_3_input?.value?.trim();
    const opt4 = values.option_4_block?.option_4_input?.value?.trim();

    const rawQuorum = values.quorum_block?.quorum_input?.value?.trim() ?? '70';
    const parsedQuorum = rawQuorum === '' ? NaN : Number(rawQuorum);

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

    await ack();

    const validated = validationResult.data;
    const options = [validated.opt1, validated.opt2, validated.opt3, validated.opt4].filter(
      (opt): opt is string => Boolean(opt && opt.trim().length > 0)
    );

    const selectedOptions = values.settings_block?.anonymous_checkbox?.selected_options ?? [];
    const isAnonymous = selectedOptions.some((o: any) => o.value === 'is_anonymous');
    const allowMultipleVotes = selectedOptions.some((o: any) => o.value === 'allow_multiple_votes');

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

      // 3. Post placeholder message to reserve messageTs
      const placeholder = await client.chat.postMessage({
        channel: validated.selectedChannel,
        text: `Launching poll: ${validated.question}...`,
      });

      if (!placeholder.ts) {
        throw new Error('Failed to reserve message timestamp in channel.');
      }

      const workspaceId =
        body.team?.id ||
        (body as any).view?.team_id ||
        (body as any).user?.team_id ||
        '';

      // 4. Persist in database
      const poll = await PollService.createPoll({
        workspaceId,
        channelId: validated.selectedChannel,
        messageTs: placeholder.ts,
        creatorId: body.user.id,
        question: validated.question,
        options,
        isAnonymous,
        allowMultipleVotes,
        quorumType: 'PERCENTAGE',
        quorumTarget: validated.quorumTarget,
        eligibleVoterCount: memberCount,
        closesAt,
      });

      // 5. Render pure Block Kit card
      const blocks = buildPollMessageBlocks({
        ...poll,
        participations: [],
      });

      await client.chat.update({
        channel: validated.selectedChannel,
        ts: placeholder.ts,
        text: `Poll: ${validated.question}`,
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
}
