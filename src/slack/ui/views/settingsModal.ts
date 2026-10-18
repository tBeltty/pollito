import type { ModalView, MrkdwnOption, PlainTextOption } from '@slack/web-api';
import {
  SUPPORTED_LOCALES,
  defaultTranslator,
  type Locale,
  type MessageKey,
  type Translator,
} from '../../../i18n/index.js';

export interface WorkspaceSettingsData {
  allowMultipleActivePolls: boolean;
  defaultAnonymous: boolean;
  defaultQuorumPct: number;
  maxNudgeChannelMembers: number;
  allowVoterChoiceNudges: boolean;
  managerUserIds: string[];
  /** Workspace language override. Undefined follows each user's Slack language. */
  locale?: Locale | null;
}

export interface SettingsModalViewOptions extends WorkspaceSettingsData {
  workspaceId?: string;
  canEdit?: boolean;
  translator?: Translator;
}

const QUORUM_THRESHOLDS = ['51', '66', '70', '75', '80', '100'] as const;
const AUTO_LOCALE_VALUE = 'auto';

export function buildSettingsModalView(
  options: SettingsModalViewOptions,
  translator?: Translator
): ModalView {
  const activeTranslator = translator ?? options.translator ?? defaultTranslator;
  const { t } = activeTranslator;
  const canEdit = options.canEdit !== false;
  const maxNudgeMembers = options.maxNudgeChannelMembers || 50;

  if (!canEdit) {
    const concurrencyLabel = options.allowMultipleActivePolls
      ? t('settings.value.concurrencyMultiple')
      : t('settings.value.concurrencySingle');
    const privacyLabel = options.defaultAnonymous
      ? t('settings.value.privacyAnonymous')
      : t('settings.value.privacyPublic');
    const quorumLabel =
      options.defaultQuorumPct <= 0
        ? t('settings.value.quorumNone')
        : `${options.defaultQuorumPct}%`;
    const nudgesLabel = options.allowVoterChoiceNudges
      ? t('settings.value.nudgesEnabled', { max: maxNudgeMembers })
      : t('settings.value.nudgesDisabled');
    const managersLabel =
      options.managerUserIds && options.managerUserIds.length > 0
        ? activeTranslator.formatList(options.managerUserIds.map((id) => `<@${id}>`))
        : t('settings.value.managersNone');
    const localeLabel = options.locale
      ? t(`settings.locale.${options.locale}`)
      : t('settings.value.localeAuto');

    return {
      type: 'modal',
      callback_id: 'view_settings_modal_readonly',
      title: {
        type: 'plain_text',
        text: t('settings.title'),
        emoji: true,
      },
      close: {
        type: 'plain_text',
        text: t('common.close'),
        emoji: true,
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: t('settings.readOnly.body'),
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: t('settings.field.concurrency', { value: concurrencyLabel }) },
            { type: 'mrkdwn', text: t('settings.field.privacy', { value: privacyLabel }) },
            { type: 'mrkdwn', text: t('settings.field.quorum', { value: quorumLabel }) },
            { type: 'mrkdwn', text: t('settings.field.nudges', { value: nudgesLabel }) },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: t('settings.field.managers', { value: managersLabel }),
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: t('settings.field.locale', { value: localeLabel }),
          },
        },
      ],
    };
  }

  const concurrencyOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: t('settings.option.concurrency'),
    },
    description: {
      type: 'plain_text',
      text: t('settings.option.concurrencyHint'),
    },
    value: 'allow_multiple_active_polls',
  };

  const defaultAnonymousOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: t('settings.option.anonymous'),
    },
    value: 'default_anonymous',
  };

  const allowNudgesOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: t('settings.option.nudges'),
    },
    value: 'allow_nudges',
  };

  const initialPrivacyOptions: MrkdwnOption[] = [];
  if (options.defaultAnonymous) {
    initialPrivacyOptions.push(defaultAnonymousOption);
  }
  if (options.allowVoterChoiceNudges) {
    initialPrivacyOptions.push(allowNudgesOption);
  }

  const quorumOptions: PlainTextOption[] = [
    {
      text: {
        type: 'plain_text',
        text: t('settings.quorum.none'),
        emoji: true,
      },
      value: 'NONE',
    },
    ...QUORUM_THRESHOLDS.map(
      (threshold): PlainTextOption => ({
        text: {
          type: 'plain_text',
          text: t(`settings.quorum.${threshold}` as MessageKey),
          emoji: true,
        },
        value: threshold,
      })
    ),
  ];

  const targetQuorumValue =
    options.defaultQuorumPct <= 0 ? 'NONE' : String(options.defaultQuorumPct);
  const selectedQuorumOption =
    quorumOptions.find((opt) => opt.value === targetQuorumValue) ??
    quorumOptions.find((opt) => opt.value === '70')!;

  const localeOptions: PlainTextOption[] = [
    {
      text: { type: 'plain_text', text: t('settings.locale.auto'), emoji: true },
      value: AUTO_LOCALE_VALUE,
    },
    ...SUPPORTED_LOCALES.map(
      (code): PlainTextOption => ({
        text: { type: 'plain_text', text: t(`settings.locale.${code}`), emoji: true },
        value: code,
      })
    ),
  ];
  const selectedLocaleOption =
    localeOptions.find((opt) => opt.value === (options.locale ?? AUTO_LOCALE_VALUE)) ??
    localeOptions[0]!;

  return {
    type: 'modal',
    callback_id: 'submit_settings_modal',
    title: {
      type: 'plain_text',
      text: t('settings.title'),
      emoji: true,
    },
    submit: {
      type: 'plain_text',
      text: t('settings.submit'),
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: t('common.cancel'),
      emoji: true,
    },
    blocks: [
      {
        type: 'input',
        block_id: 'concurrency_settings_block',
        optional: true,
        element: {
          type: 'checkboxes',
          action_id: 'concurrency_checkboxes',
          options: [concurrencyOption],
          ...(options.allowMultipleActivePolls
            ? { initial_options: [concurrencyOption] }
            : {}),
        },
        label: {
          type: 'plain_text',
          text: t('settings.label.concurrency'),
        },
      },
      {
        type: 'input',
        block_id: 'privacy_settings_block',
        optional: true,
        element: {
          type: 'checkboxes',
          action_id: 'default_privacy_checkboxes',
          options: [defaultAnonymousOption, allowNudgesOption],
          ...(initialPrivacyOptions.length > 0
            ? { initial_options: initialPrivacyOptions }
            : {}),
        },
        label: {
          type: 'plain_text',
          text: t('settings.label.privacy'),
        },
      },
      {
        type: 'input',
        block_id: 'default_quorum_block',
        element: {
          type: 'static_select',
          action_id: 'default_quorum_select',
          options: quorumOptions,
          initial_option: selectedQuorumOption,
        },
        label: {
          type: 'plain_text',
          text: t('settings.label.quorum'),
        },
      },
      {
        type: 'input',
        block_id: 'max_nudge_members_block',
        element: {
          type: 'number_input',
          action_id: 'max_nudge_members_input',
          is_decimal_allowed: false,
          min_value: '5',
          max_value: '500',
          initial_value: String(maxNudgeMembers),
        },
        label: {
          type: 'plain_text',
          text: t('settings.label.maxNudge'),
        },
        hint: {
          type: 'plain_text',
          text: t('settings.hint.maxNudge'),
        },
      },
      {
        type: 'input',
        block_id: 'manager_settings_block',
        optional: true,
        element: {
          type: 'multi_users_select',
          action_id: 'manager_users_select',
          placeholder: {
            type: 'plain_text',
            text: t('settings.placeholder.managers'),
          },
          ...(options.managerUserIds && options.managerUserIds.length > 0
            ? { initial_users: options.managerUserIds }
            : {}),
        },
        label: {
          type: 'plain_text',
          text: t('settings.label.managers'),
        },
      },
      {
        type: 'input',
        block_id: 'workspace_locale_block',
        element: {
          type: 'static_select',
          action_id: 'workspace_locale_select',
          options: localeOptions,
          initial_option: selectedLocaleOption,
        },
        label: {
          type: 'plain_text',
          text: t('settings.label.locale'),
        },
        hint: {
          type: 'plain_text',
          text: t('settings.hint.locale'),
        },
      },
    ],
  };
}
