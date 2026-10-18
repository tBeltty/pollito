import type { ModalView } from '@slack/web-api';

export function buildCreatePollModalView(channelId: string): ModalView {
  return {
    type: 'modal',
    callback_id: 'create_poll_modal_submit',
    private_metadata: JSON.stringify({ channelId }),
    title: {
      type: 'plain_text',
      text: 'Create a Poll',
      emoji: true,
    },
    submit: {
      type: 'plain_text',
      text: 'Launch Poll',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
      emoji: true,
    },
    blocks: [
      {
        type: 'input',
        block_id: 'channel_block',
        element: {
          type: 'conversations_select',
          action_id: 'channel_select',
          placeholder: {
            type: 'plain_text',
            text: 'Choose channel',
            emoji: true,
          },
          filter: {
            include: ['public', 'private'],
            exclude_bot_users: true,
          },
          ...(channelId ? { initial_conversation: channelId } : {}),
        },
        label: {
          type: 'plain_text',
          text: 'Channel',
          emoji: true,
        },
      },
      {
        type: 'input',
        block_id: 'question_block',
        element: {
          type: 'plain_text_input',
          action_id: 'question_input',
          placeholder: {
            type: 'plain_text',
            text: 'e.g. Which sprint retrospective date works best?',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Poll Question',
        },
      },
      {
        type: 'input',
        block_id: 'option_1_block',
        element: {
          type: 'plain_text_input',
          action_id: 'option_1_input',
          placeholder: {
            type: 'plain_text',
            text: 'First option',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Option 1',
        },
      },
      {
        type: 'input',
        block_id: 'option_2_block',
        element: {
          type: 'plain_text_input',
          action_id: 'option_2_input',
          placeholder: {
            type: 'plain_text',
            text: 'Second option',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Option 2',
        },
      },
      {
        type: 'input',
        block_id: 'option_3_block',
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: 'option_3_input',
          placeholder: {
            type: 'plain_text',
            text: 'Third option (optional)',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Option 3',
        },
      },
      {
        type: 'input',
        block_id: 'option_4_block',
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: 'option_4_input',
          placeholder: {
            type: 'plain_text',
            text: 'Fourth option (optional)',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Option 4',
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'input',
        block_id: 'settings_block',
        optional: true,
        element: {
          type: 'checkboxes',
          action_id: 'anonymous_checkbox',
          options: [
            {
              text: {
                type: 'mrkdwn',
                text: '*Anonymous Ballot*\nHide voter names. Leave unchecked for a public poll where votes are visible to the team.',
              },
              value: 'is_anonymous',
            },
          ],
        },
        label: {
          type: 'plain_text',
          text: 'Privacy Settings',
        },
      },
      {
        type: 'input',
        block_id: 'quorum_block',
        element: {
          type: 'plain_text_input',
          action_id: 'quorum_input',
          initial_value: '70',
          placeholder: {
            type: 'plain_text',
            text: '70',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Target Quorum Percentage (%)',
        },
        hint: {
          type: 'plain_text',
          text: 'The poll auto-closes once this share of channel members casts a ballot.',
        },
      },
      {
        type: 'input',
        block_id: 'duration_block',
        optional: true,
        element: {
          type: 'static_select',
          action_id: 'duration_select',
          placeholder: {
            type: 'plain_text',
            text: 'Select closing duration',
            emoji: true,
          },
          initial_option: {
            text: {
              type: 'plain_text',
              text: 'No time limit (Manual / Quorum only)',
              emoji: true,
            },
            value: 'none',
          },
          options: [
            {
              text: {
                type: 'plain_text',
                text: 'No time limit (Manual / Quorum only)',
                emoji: true,
              },
              value: 'none',
            },
            {
              text: {
                type: 'plain_text',
                text: '15 minutes (Quick Standup)',
                emoji: true,
              },
              value: '15m',
            },
            {
              text: {
                type: 'plain_text',
                text: '1 hour',
                emoji: true,
              },
              value: '1h',
            },
            {
              text: {
                type: 'plain_text',
                text: '4 hours',
                emoji: true,
              },
              value: '4h',
            },
            {
              text: {
                type: 'plain_text',
                text: '24 hours (Asynchronous / Next day)',
                emoji: true,
              },
              value: '24h',
            },
            {
              text: {
                type: 'plain_text',
                text: '3 days (72 hours)',
                emoji: true,
              },
              value: '72h',
            },
          ],
        },
        label: {
          type: 'plain_text',
          text: 'Poll Duration / Deadline',
          emoji: true,
        },
        hint: {
          type: 'plain_text',
          text: 'Automatically closes the vote when this time expires, even if quorum has not been reached.',
        },
      },
    ],
  };
}
