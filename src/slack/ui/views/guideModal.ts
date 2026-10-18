import type { ModalView } from '@slack/web-api';

export function buildGuideModalView(): ModalView {
  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: 'Pollito Quick Guide',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Got It',
      emoji: true,
    },
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'How Pollito Works',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*1. Launch in Channel or Huddle Thread*\nOpen the interactive poll builder with `/pollito`, pass options inline for an instant poll, or use `/pollito huddle` to post directly inside an active Slack Huddle thread.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*2. Double-Urn Secret Ballots & Quorum Auto-Closing*\nAnonymous polls separate voter participation records from ballot choices so individual selections cannot be traced. Set a quorum threshold (minimum 51%) to close the poll automatically once enough channel members vote, or choose "No Quorum Required" for casual polls.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*3. Creator Nudges & Role-Scoped Analytics*\nOnly the poll creator can send private DM reminders to non-voters (available in channels up to 50 members with a 4-hour cooldown). Creators see full results for their own polls, while Workspace Admins and Bot Managers can inspect workspace-wide analytics.',
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Slash Commands Reference',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            '• `/pollito` — Open the interactive poll builder for the current channel',
            '• `/pollito "Question" "Option 1" "Option 2"` — Launch an instant poll in the channel',
            '• `/pollito huddle` — Open the poll builder targeted to the active Huddle thread in this channel',
            '• `/pollito huddle "Question" "Option 1" "Option 2"` — Launch an instant poll inside the active Huddle thread',
            '• `/pollito close [poll-id]` — Close an active poll you created',
            '• `/pollito nudge [poll-id]` — Send private DM reminders to non-voters (channels up to 50 members)',
            '• `/pollito report` — View your poll results and analytics report',
          ].join('\n'),
        },
      },
    ],
  };
}
