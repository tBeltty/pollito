import type { ModalView,MrkdwnOption, PlainTextOption } from '@slack/web-api';

export interface CreatePollModalPreset {
  channelId?: string;
  question?: string;
  options?: string[];
  isAnonymous?: boolean;
  allowMultipleVotes?: boolean;
  quorumTarget?: number;
  duration?: string;
}

export function buildCreatePollModalView(
  channelIdOrPreset: string | CreatePollModalPreset = ''
): ModalView {
  const preset: CreatePollModalPreset =
    typeof channelIdOrPreset === 'string'
      ? { channelId: channelIdOrPreset }
      : channelIdOrPreset;

  const channelId = preset.channelId ?? '';

  const anonymousOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: '*Anonymous Voting (Double-Urn Secret Ballot)*',
    },
    value: 'is_anonymous',
  };

  const multipleChoiceOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: '*Multiple Choice*\nAllow teammates to select more than one option.',
    },
    value: 'allow_multiple_votes',
  };

  const initialSettingsOptions: MrkdwnOption[] = [];
  if (preset.isAnonymous) {
    initialSettingsOptions.push(anonymousOption);
  }
  if (preset.allowMultipleVotes) {
    initialSettingsOptions.push(multipleChoiceOption);
  }

  const durationOptions: PlainTextOption[] = [
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
  ];

  const selectedDurationOption =
    durationOptions.find((opt) => opt.value === preset.duration) ?? durationOptions[0];

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
          max_length: 150,
          ...(preset.question ? { initial_value: preset.question.slice(0, 150) } : {}),
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
          max_length: 200,
          ...(preset.options?.[0] ? { initial_value: preset.options[0].slice(0, 200) } : {}),
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
          max_length: 200,
          ...(preset.options?.[1] ? { initial_value: preset.options[1].slice(0, 200) } : {}),
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
          max_length: 200,
          ...(preset.options?.[2] ? { initial_value: preset.options[2].slice(0, 200) } : {}),
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
          max_length: 200,
          ...(preset.options?.[3] ? { initial_value: preset.options[3].slice(0, 200) } : {}),
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
          options: [anonymousOption, multipleChoiceOption],
          ...(initialSettingsOptions.length > 0
            ? { initial_options: initialSettingsOptions }
            : {}),
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
          type: 'number_input',
          action_id: 'quorum_input',
          is_decimal_allowed: false,
          min_value: '10',
          max_value: '100',
          initial_value: String(preset?.quorumTarget ?? 70),
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
          initial_option: selectedDurationOption,
          options: durationOptions,
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
