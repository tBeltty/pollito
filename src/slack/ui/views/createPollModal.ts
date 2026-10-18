import type { ModalView, MrkdwnOption, PlainTextOption } from '@slack/web-api';

export interface CreatePollModalPreset {
  channelId?: string;
  threadTs?: string | null;
  huddleMode?: boolean;
  question?: string;
  options?: string[];
  isAnonymous?: boolean;
  allowMultipleVotes?: boolean;
  quorumType?: 'PERCENTAGE' | 'NONE';
  quorumTarget?: number;
  duration?: string;
  saveAsTemplate?: boolean;
  templateName?: string;
  editTemplateId?: string;
  availableTemplates?: Array<{ id: string; name: string; isShared?: boolean }>;
}

export interface BuiltInPollTemplate {
  name: string;
  question: string;
  options: string[];
  isAnonymous: boolean;
  allowMultipleVotes: boolean;
  quorumType: 'PERCENTAGE' | 'NONE';
  quorumTarget: number;
  duration: string;
}

export const BUILT_IN_POLL_TEMPLATES: Record<string, BuiltInPollTemplate> = {
  standup: {
    name: 'Standup Check',
    question: 'Do we have any blockers for today’s standup?',
    options: [
      'All clear — on track',
      'Minor blocker — need sync',
      'Blocked — need review',
    ],
    isAnonymous: false,
    allowMultipleVotes: false,
    quorumType: 'PERCENTAGE',
    quorumTarget: 80,
    duration: '15m',
  },
  retro: {
    name: 'Retro Date',
    question: 'Which sprint retrospective slot works best?',
    options: [
      'Thursday 14:00 UTC',
      'Thursday 16:00 UTC',
      'Friday 14:00 UTC',
      'Friday 16:00 UTC',
    ],
    isAnonymous: false,
    allowMultipleVotes: true,
    quorumType: 'PERCENTAGE',
    quorumTarget: 75,
    duration: '24h',
  },
  rfc: {
    name: 'Architecture RFC',
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
    name: 'Team Lunch',
    question: 'Where should the team go for lunch this Friday?',
    options: ['Tacos', 'Ramen', 'Wood-fired Pizza', 'Mediterranean'],
    isAnonymous: true,
    allowMultipleVotes: true,
    quorumType: 'NONE',
    quorumTarget: 51,
    duration: '4h',
  },
};

export function buildCreatePollModalView(
  channelIdOrPreset: string | CreatePollModalPreset = ''
): ModalView {
  const preset: CreatePollModalPreset =
    typeof channelIdOrPreset === 'string'
      ? { channelId: channelIdOrPreset }
      : channelIdOrPreset;

  const channelId = preset.channelId ?? '';
  const isEditingTemplate = Boolean(preset.editTemplateId);

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

  const noQuorumOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: '*No Quorum Required*\nRun without a participation threshold (closes manually or on deadline).',
    },
    value: 'no_quorum',
  };

  const initialSettingsOptions: MrkdwnOption[] = [];
  if (preset.isAnonymous) {
    initialSettingsOptions.push(anonymousOption);
  }
  if (preset.allowMultipleVotes) {
    initialSettingsOptions.push(multipleChoiceOption);
  }
  if (preset.quorumType === 'NONE') {
    initialSettingsOptions.push(noQuorumOption);
  }

  const saveAsTemplateOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: '*Save as reusable template*\nStore this question, options, and quorum setup in your Templates menu.',
    },
    value: 'save_as_template',
  };

  const initialSaveTemplateOptions: MrkdwnOption[] = [];
  if (preset.saveAsTemplate) {
    initialSaveTemplateOptions.push(saveAsTemplateOption);
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
        text: '24 hours (1 day)',
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
    {
      text: {
        type: 'plain_text',
        text: '1 week (7 days)',
        emoji: true,
      },
      value: '7d',
    },
  ];

  const selectedDurationOption =
    durationOptions.find((opt) => opt.value === preset.duration) ?? durationOptions[0];

  const clampedQuorumTarget = Math.max(51, preset?.quorumTarget ?? 70);
  const isHuddleMode = Boolean(preset.huddleMode || preset.threadTs);

  return {
    type: 'modal',
    callback_id: isEditingTemplate
      ? 'edit_template_modal_submit'
      : 'create_poll_modal_submit',
    private_metadata: JSON.stringify({
      channelId,
      ...(preset.threadTs ? { threadTs: preset.threadTs } : {}),
      ...(preset.huddleMode ? { huddleMode: true } : {}),
      ...(preset.editTemplateId ? { editTemplateId: preset.editTemplateId } : {}),
    }),
    title: {
      type: 'plain_text',
      text: isEditingTemplate
        ? 'Edit Poll Template'
        : isHuddleMode
          ? 'Create a Huddle Poll'
          : 'Create a Poll',
      emoji: true,
    },
    submit: {
      type: 'plain_text',
      text: isEditingTemplate ? 'Save Template' : 'Launch Poll',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
      emoji: true,
    },
    blocks: [
      ...(isHuddleMode && channelId
        ? [
            {
              type: 'section' as const,
              block_id: 'huddle_target_banner',
              text: {
                type: 'mrkdwn' as const,
                text: `🎧 *Target: Active Huddle Thread* in <#${channelId}>\nThis poll will be posted directly inside the live Huddle thread.`,
              },
            },
          ]
        : []),
      {
        type: 'input',
        block_id: 'channel_block',
        optional: isEditingTemplate || isHuddleMode,
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
          options: [anonymousOption, multipleChoiceOption, noQuorumOption],
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
        optional: true,
        element: {
          type: 'number_input',
          action_id: 'quorum_input',
          is_decimal_allowed: false,
          min_value: '51',
          max_value: '100',
          initial_value: String(clampedQuorumTarget),
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
          text: 'Minimum 51% (simple majority: half + 1). Leave blank or check "No Quorum Required" above for casual polls.',
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
      {
        type: 'divider',
      },
      {
        type: 'input',
        block_id: 'save_template_block',
        optional: true,
        element: {
          type: 'checkboxes',
          action_id: 'save_template_checkbox',
          options: [saveAsTemplateOption],
          ...(initialSaveTemplateOptions.length > 0
            ? { initial_options: initialSaveTemplateOptions }
            : {}),
        },
        label: {
          type: 'plain_text',
          text: 'Reusable Template',
        },
      },
      {
        type: 'input',
        block_id: 'template_name_block',
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: 'template_name_input',
          max_length: 75,
          ...(preset.templateName
            ? { initial_value: preset.templateName.slice(0, 75) }
            : {}),
          placeholder: {
            type: 'plain_text',
            text: 'Optional template name (defaults to question)',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Template Name',
        },
      },
    ],
  };
}
