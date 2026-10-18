import type { App, ViewSubmitAction } from '@slack/bolt';
import { PollService } from '../../services/pollService.js';
import { buildPollMessageBlocks } from '../ui/views/pollMessage.js';

export function registerViewHandlers(app: App) {
  app.view('create_poll_modal_submit', async ({ ack, view, body, client }) => {
    const values = view.state.values;

    const question = values.question_block?.question_input?.value?.trim();
    const opt1 = values.option_1_block?.option_1_input?.value?.trim();
    const opt2 = values.option_2_block?.option_2_input?.value?.trim();
    const opt3 = values.option_3_block?.option_3_input?.value?.trim();
    const opt4 = values.option_4_block?.option_4_input?.value?.trim();

    if (!question || !opt1 || !opt2) {
      await ack({
        response_action: 'errors',
        errors: {
          question_block: 'Please provide a poll question',
          option_1_block: 'At least two options are required',
        },
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

    // Parse channel ID from metadata
    let channelId = '';
    try {
      const meta = JSON.parse(view.private_metadata || '{}') as { channelId?: string };
      channelId = meta.channelId || '';
    } catch {
      channelId = '';
    }

    if (!channelId) {
      // If modal was triggered without channel context (e.g. from App Home), default to direct channel or error
      return;
    }

    // Measure channel members for quorum calculation
    let memberCount = 0;
    try {
      const res = await client.conversations.members({ channel: channelId });
      memberCount = res.members?.length ?? 0;
    } catch {
      memberCount = 10;
    }

    // 1. Post placeholder message to reserve messageTs
    const placeholder = await client.chat.postMessage({
      channel: channelId,
      text: `🐣 Launching poll: ${question}...`,
    });

    if (!placeholder.ts) return;

    // 2. Persist in database
    const poll = await PollService.createPoll({
      workspaceId: body.team?.id ?? '',
      channelId,
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

    // 3. Render pure Block Kit card
    const blocks = buildPollMessageBlocks({
      ...poll,
      participations: [],
    });

    await client.chat.update({
      channel: channelId,
      ts: placeholder.ts,
      text: `Poll: ${question}`,
      blocks,
    });
  });
}
