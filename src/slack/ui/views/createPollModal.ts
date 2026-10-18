import type { ModalView, MrkdwnOption, PlainTextOption } from '@slack/web-api';
import { defaultTranslator, type Translator } from '../../../i18n/index.js';

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
  translator?: Translator;
}

export function buildCreatePollModalView(
  channelIdOrPreset: string | CreatePollModalPreset = ''
): ModalView {
  const preset: CreatePollModalPreset =
    typeof channelIdOrPreset === 'string'
      ? { channelId: channelIdOrPreset }
      : channelIdOrPreset;

  const translator = preset.translator ?? defaultTranslator;
  const { t } = translator;

  const channelId = preset.channelId ?? '';
  const isEditingTemplate = Boolean(preset.editTemplateId);
  const isCreatingTemplate = Boolean(preset.createTemplateMode);
  const isHuddleMode = Boolean(preset.huddleMode || preset.threadTs);

  const anonymousOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: t('cp.settings.anonymous'),
    },
    value: 'is_anonymous',
  };

  const multipleChoiceOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: `${t('cp.settings.multiple')}\n${t('cp.settings.multipleHint')}`,
    },
    value: 'allow_multiple_votes',
  };

  const noQuorumOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: `${t('cp.settings.noQuorum')}\n${t('cp.settings.noQuorumHint')}`,
    },
    value: 'no_quorum',
  };

  const forwardOnHuddleEndOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: `${t('cp.settings.forwardHuddle')}\n${t('cp.settings.forwardHuddleHint')}`,
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
      text: `${t('cp.template.save')}\n${t('cp.template.saveHint')}`,
    },
    value: 'save_as_template',
  };

  const shareTemplateOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: `${t('cp.template.share')}\n${t('cp.template.shareHint')}`,
    },
    value: 'is_shared',
  };

  const initialSaveTemplateOptions: MrkdwnOption[] = [];
  if (preset.saveAsTemplate) {
    initialSaveTemplateOptions.push(saveAsTemplateOption);
  }
  if (preset.isShared) {
    initialSaveTemplateOptions.push(shareTemplateOption);
  }

  const durationOptions: PlainTextOption[] = [
    {
      text: {
        type: 'plain_text',
        text: t('cp.duration.none'),
        emoji: true,
      },
      value: 'none',
    },
    {
      text: {
        type: 'plain_text',
        text: t('cp.duration.15m'),
        emoji: true,
      },
      value: '15m',
    },
    {
      text: {
        type: 'plain_text',
        text: t('cp.duration.1h'),
        emoji: true,
      },
      value: '1h',
    },
    {
      text: {
        type: 'plain_text',
        text: t('cp.duration.4h'),
        emoji: true,
      },
      value: '4h',
    },
    {
      text: {
        type: 'plain_text',
        text: t('cp.duration.24h'),
        emoji: true,
      },
      value: '24h',
    },
    {
      text: {
        type: 'plain_text',
        text: t('cp.duration.72h'),
        emoji: true,
      },
      value: '72h',
    },
    {
      text: {
        type: 'plain_text',
        text: t('cp.duration.7d'),
        emoji: true,
      },
      value: '7d',
    },
  ];

  const selectedDurationOption =
    durationOptions.find((opt) => opt.value === preset.duration) ?? durationOptions[0];

  const clampedQuorumTarget = Math.max(51, preset?.quorumTarget ?? 70);

  const modalTitle = isEditingTemplate
    ? t('cp.title.editTemplate')
    : isCreatingTemplate
      ? preset.isShared
        ? t('cp.title.newWorkspaceTemplate')
        : t('cp.title.newTemplate')
      : isHuddleMode
        ? t('cp.title.huddle')
        : t('cp.title.create');

  const submitLabel = isEditingTemplate
    ? t('cp.submit.saveTemplate')
    : isCreatingTemplate
      ? t('cp.submit.createTemplate')
      : t('cp.submit.launch');

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
      text: modalTitle,
      emoji: true,
    },
    submit: {
      type: 'plain_text',
      text: submitLabel,
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: t('common.cancel'),
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
                  ? t('cp.huddle.bannerActive', {
                      inChannel: channelId ? t('cp.huddle.inChannel', { channelId }) : '',
                    })
                  : t('cp.huddle.bannerPending', {
                      inChannel: channelId ? t('cp.huddle.inChannel', { channelId }) : '',
                    }),
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
            text: t('cp.channel.placeholder'),
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
          text: isCreatingTemplate ? t('cp.channel.labelTemplate') : t('cp.channel.label'),
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
                  text: t('cp.huddleThread.placeholder'),
                },
                ...(preset.threadTs ? { initial_value: preset.threadTs } : {}),
              },
              label: {
                type: 'plain_text' as const,
                text: t('cp.huddleThread.label'),
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
            text: t('cp.question.placeholder'),
          },
        },
        label: {
          type: 'plain_text',
          text: t('cp.question.label'),
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
            text: t('cp.option.placeholder1'),
          },
        },
        label: {
          type: 'plain_text',
          text: t('cp.option.label', { number: 1 }),
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
            text: t('cp.option.placeholder2'),
          },
        },
        label: {
          type: 'plain_text',
          text: t('cp.option.label', { number: 2 }),
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
            text: t('cp.option.placeholder3'),
          },
        },
        label: {
          type: 'plain_text',
          text: t('cp.option.label', { number: 3 }),
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
            text: t('cp.option.placeholder4'),
          },
        },
        label: {
          type: 'plain_text',
          text: t('cp.option.label', { number: 4 }),
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
          text: t('cp.settings.label'),
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
          text: t('cp.quorum.label'),
        },
        hint: {
          type: 'plain_text',
          text: t('cp.quorum.hint'),
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
            text: t('cp.duration.placeholder'),
            emoji: true,
          },
          initial_option: selectedDurationOption,
          options: durationOptions,
        },
        label: {
          type: 'plain_text',
          text: t('cp.duration.label'),
          emoji: true,
        },
        hint: {
          type: 'plain_text',
          text: t('cp.duration.hint'),
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
                  text: t('cp.template.name.placeholderNew'),
                },
              },
              label: {
                type: 'plain_text' as const,
                text: t('cp.template.name.label'),
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
                text: t('cp.template.availability.label'),
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
                options: [saveAsTemplateOption, shareTemplateOption],
                ...(initialSaveTemplateOptions.length > 0
                  ? { initial_options: initialSaveTemplateOptions }
                  : {}),
              },
              label: {
                type: 'plain_text' as const,
                text: t('cp.template.save.label'),
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
                  text: t('cp.template.name.placeholderOptional'),
                },
              },
              label: {
                type: 'plain_text' as const,
                text: t('cp.template.name.label'),
              },
            },
          ]),
    ],
  };
}
