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
                text: '*Anonymous Ballot*\nKeep voter choices confidential with double-urn cryptographic tokens.',
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
    ],
  };
}
