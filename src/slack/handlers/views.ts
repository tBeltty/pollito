import type { App, ViewSubmitAction } from '@slack/bolt';
import { PollService } from '../../services/pollService.js';
import { buildPollMessageBlocks } from '../ui/views/pollMessage.js';

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

    const question = values.question_block?.question_input?.value?.trim();
    const opt1 = values.option_1_block?.option_1_input?.value?.trim();
    const opt2 = values.option_2_block?.option_2_input?.value?.trim();
    const opt3 = values.option_3_block?.option_3_input?.value?.trim();
    const opt4 = values.option_4_block?.option_4_input?.value?.trim();

    const errors: Record<string, string> = {};
    if (!selectedChannel) {
      errors.channel_block = 'Please select a channel for this poll';
    }
    if (!question) {
      errors.question_block = 'Please provide a poll question';
    }
    if (!opt1 || !opt2) {
      errors.option_1_block = 'At least two options are required';
    }

    if (Object.keys(errors).length > 0 || !selectedChannel || !question) {
      await ack({
        response_action: 'errors',
        errors,
      });
      return;
    }

    const options = [opt1, opt2, opt3, opt4].filter(Boolean) as string[];

    const isAnonymous =
      (values.settings_block?.anonymous_checkbox?.selected_options?.length ?? 0) > 0;

    const rawQuorum = values.quorum_block?.quorum_input?.value?.trim() ?? '70';
    const quorumTarget = Math.max(10, Math.min(100, parseInt(rawQuorum, 10) || 70));

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

    await ack();

    try {
      // 1. Attempt to auto-join if it's a public channel
      try {
        await client.conversations.join({ channel: selectedChannel });
      } catch {
        // Safe to ignore if already in channel or private channel
      }

      // 2. Measure channel members for quorum calculation
      let memberCount = 10;
      try {
        const res = await client.conversations.members({ channel: selectedChannel });
        memberCount = res.members?.length ?? 10;
      } catch {
        memberCount = 10;
      }

      // 3. Post placeholder message to reserve messageTs
      const placeholder = await client.chat.postMessage({
        channel: selectedChannel,
        text: `🐣 Launching poll: ${question}...`,
      });

      if (!placeholder.ts) {
        throw new Error('Failed to reserve message timestamp in channel.');
      }

      // 4. Persist in database
      const poll = await PollService.createPoll({
        workspaceId: body.team?.id ?? '',
        channelId: selectedChannel,
        messageTs: placeholder.ts,
        creatorId: body.user.id,
        question,
        options,
        isAnonymous,
        quorumType: 'PERCENTAGE',
        quorumTarget,
        eligibleVoterCount: memberCount,
        closesAt,
      });

      // 5. Render pure Block Kit card
      const blocks = buildPollMessageBlocks({
        ...poll,
        participations: [],
      });

      await client.chat.update({
        channel: selectedChannel,
        ts: placeholder.ts,
        text: `Poll: ${question}`,
        blocks,
      });
    } catch (error: any) {
      console.error('Failed to create poll from modal:', error);
      const isNotInChannel =
        error?.data?.error === 'not_in_channel' ||
        error?.message?.includes('not_in_channel');

      const notice = isNotInChannel
        ? `⚠️ Pollito is not in <#${selectedChannel}>. Please invite the bot by typing \`/invite @Pollito\` in that channel, then launch your poll.`
        : `⚠️ Could not create poll: ${error?.message || 'Unknown error'}.`;

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
