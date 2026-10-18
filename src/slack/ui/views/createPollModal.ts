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
  forwardToChannelOnHuddleEnd?: boolean;
  availableTemplates?: Array<{ id: string; name: string; isShared?: boolean }>;
  createTemplateMode?: boolean;
  isShared?: boolean;
}

export function buildCreatePollModalView(
  channelIdOrPreset: string | CreatePollModalPreset = ''
): ModalView {
  const preset: CreatePollModalPreset =
    typeof channelIdOrPreset === 'string'
      ? { channelId: channelIdOrPreset }
      : channelIdOrPreset;

  const channelId = preset.channelId ?? '';
  const isEditingTemplate = Boolean(preset.editTemplateId);
  const isCreatingTemplate = Boolean(preset.createTemplateMode);
  const isHuddleMode = Boolean(preset.huddleMode || preset.threadTs);

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

  const forwardOnHuddleEndOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: '*Remind in Channel When Huddle Ends*\nPost a "Remember to vote" link in the main channel if the poll is still active when the Huddle ends.',
    },
    value: 'forward_on_huddle_end',
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
  if (preset.forwardToChannelOnHuddleEnd ?? (Boolean(preset.huddleMode) && !isEditingTemplate)) {
    initialSettingsOptions.push(forwardOnHuddleEndOption);
  }

  const saveAsTemplateOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: '*Save as reusable template*\nStore this question, options, and quorum setup in your Templates menu.',
    },
    value: 'save_as_template',
  };

  const shareTemplateOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: '*Share with workspace as Quick Template*\nMake this template visible on App Home and accessible for all teammates to launch in one click.',
    },
    value: 'is_shared',
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

  return {
    type: 'modal',
    callback_id: isEditingTemplate
      ? 'edit_template_modal_submit'
      : isCreatingTemplate
        ? 'create_template_modal_submit'
        : 'create_poll_modal_submit',
    private_metadata: JSON.stringify({
      channelId,
      ...(preset.threadTs ? { threadTs: preset.threadTs } : {}),
      ...(preset.huddleMode ? { huddleMode: true } : {}),
      ...(preset.editTemplateId ? { editTemplateId: preset.editTemplateId } : {}),
      ...(isCreatingTemplate ? { createTemplateMode: true } : {}),
      ...(preset.isShared !== undefined ? { isShared: preset.isShared } : {}),
    }),
    title: {
      type: 'plain_text',
      text: isEditingTemplate
        ? 'Edit Poll Template'
        : isCreatingTemplate
          ? preset.isShared
            ? 'New Workspace Template'
            : 'New Poll Template'
          : isHuddleMode
            ? 'Create a Huddle Poll'
            : 'Create a Poll',
      emoji: true,
    },
    submit: {
      type: 'plain_text',
      text: isEditingTemplate
        ? 'Save Template'
        : isCreatingTemplate
          ? 'Create Template'
          : 'Launch Poll',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
      emoji: true,
    },
    blocks: [
      ...(isHuddleMode
        ? [
            {
              type: 'section' as const,
              block_id: 'huddle_target_banner',
              text: {
                type: 'mrkdwn' as const,
                text: preset.threadTs
                  ? `🎧 *Target: Active Huddle Thread*${channelId ? ` in <#${channelId}>` : ''}\nThis poll will be posted directly inside the live Huddle thread.`
                  : `🎧 *Target: Huddle Thread*${channelId ? ` in <#${channelId}>` : ''}\nPollito will auto-detect the active Huddle on launch, or you can paste the Huddle message link below.`,
              },
            },
          ]
        : []),
      {
        type: 'input',
        block_id: 'channel_block',
        optional: isEditingTemplate || isCreatingTemplate || isHuddleMode,
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
          text: isCreatingTemplate ? 'Default Channel (Optional)' : 'Channel',
          emoji: true,
        },
      },
      ...(isHuddleMode
        ? [
            {
              type: 'input' as const,
              block_id: 'huddle_thread_block',
              optional: true,
              element: {
                type: 'plain_text_input' as const,
                action_id: 'huddle_thread_input',
                placeholder: {
                  type: 'plain_text' as const,
                  text: 'Leave blank to auto-detect, or paste Huddle message link / thread ts',
                },
                ...(preset.threadTs ? { initial_value: preset.threadTs } : {}),
              },
              label: {
                type: 'plain_text' as const,
                text: 'Huddle Thread Link or Timestamp (Optional)',
              },
            },
          ]
        : []),
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
          options: [
            anonymousOption,
            multipleChoiceOption,
            noQuorumOption,
            forwardOnHuddleEndOption,
          ],
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
      ...(isCreatingTemplate || isEditingTemplate
        ? [
            {
              type: 'input' as const,
              block_id: 'template_name_block',
              element: {
                type: 'plain_text_input' as const,
                action_id: 'template_name_input',
                max_length: 75,
                ...(preset.templateName
                  ? { initial_value: preset.templateName.slice(0, 75) }
                  : {}),
                placeholder: {
                  type: 'plain_text' as const,
                  text: 'e.g. Daily Standup Blockers',
                },
              },
              label: {
                type: 'plain_text' as const,
                text: 'Template Name',
              },
            },
            {
              type: 'input' as const,
              block_id: 'template_share_block',
              optional: true,
              element: {
                type: 'checkboxes' as const,
                action_id: 'template_share_checkbox',
                options: [shareTemplateOption],
                ...(preset.isShared ? { initial_options: [shareTemplateOption] } : {}),
              },
              label: {
                type: 'plain_text' as const,
                text: 'Workspace Availability',
              },
            },
          ]
        : [
            {
              type: 'input' as const,
              block_id: 'save_template_block',
              optional: true,
              element: {
                type: 'checkboxes' as const,
                action_id: 'save_template_checkbox',
                options: [saveAsTemplateOption],
                ...(initialSaveTemplateOptions.length > 0
                  ? { initial_options: initialSaveTemplateOptions }
                  : {}),
              },
              label: {
                type: 'plain_text' as const,
                text: 'Reusable Template',
              },
            },
            {
              type: 'input' as const,
              block_id: 'template_name_block',
              optional: true,
              element: {
                type: 'plain_text_input' as const,
                action_id: 'template_name_input',
                max_length: 75,
                ...(preset.templateName
                  ? { initial_value: preset.templateName.slice(0, 75) }
                  : {}),
                placeholder: {
                  type: 'plain_text' as const,
                  text: 'Optional template name (defaults to question)',
                },
              },
              label: {
                type: 'plain_text' as const,
                text: 'Template Name',
              },
            },
          ]),
    ],
  };
}
