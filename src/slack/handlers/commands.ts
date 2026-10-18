import type { App } from '@slack/bolt';
import { buildCreatePollModalView } from '../ui/views/createPollModal.js';
import { PollService } from '../../services/pollService.js';
import { buildPollMessageBlocks } from '../ui/views/pollMessage.js';
import { prisma } from '../../db/prisma.js';

export function registerCommandHandlers(app: App) {
  app.command('/pollito', async ({ command, ack, client }) => {
    await ack();

    const text = command.text.trim();

    // 1. If text is empty, open creation modal
    if (!text) {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: buildCreatePollModalView(command.channel_id),
      });
      return;
    }

    // 2. Help command
    if (text.toLowerCase() === 'help') {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: '🐣 *Pollito Quick Help*\n\n• `/pollito` — Opens modal builder.\n• `/pollito "Question" "Option 1" "Option 2"` — Creates an instant poll.\n• Visit App Home to view analytics and recent results.',
      });
      return;
    }

    // 3. Quick poll syntax: /pollito "Question" "Option 1" "Option 2"
    const matches = [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

    if (matches.length >= 3) {
      const question = matches[0];
      const options = matches.slice(1, 7); // Up to 6 options

      // Fetch channel members for quorum calculation
      let memberCount = 0;
      try {
        const membersRes = await client.conversations.members({
          channel: command.channel_id,
        });
        memberCount = membersRes.members?.length ?? 0;
      } catch {
        // Fallback if bot cannot read channel members
        memberCount = 10;
      }

      // Initial placeholder message to reserve ts
      const placeholder = await client.chat.postMessage({
        channel: command.channel_id,
        text: `🐣 Creating poll: ${question}...`,
      });

      if (!placeholder.ts) return;

      const poll = await PollService.createPoll({
        workspaceId: command.team_id,
        channelId: command.channel_id,
        messageTs: placeholder.ts,
        creatorId: command.user_id,
        question,
        options,
        isAnonymous: false,
        quorumType: 'PERCENTAGE',
        quorumTarget: 70,
        eligibleVoterCount: memberCount,
      });

      const blocks = buildPollMessageBlocks({
        ...poll,
        participations: [],
      });

      await client.chat.update({
        channel: command.channel_id,
        ts: placeholder.ts,
        text: `Poll: ${question}`,
        blocks,
      });
      return;
    }

    // Fallback for unrecognized syntax: open modal
    await client.views.open({
      trigger_id: command.trigger_id,
      view: buildCreatePollModalView(command.channel_id),
    });
  });
}
