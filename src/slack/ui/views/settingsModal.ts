import type { ModalView, MrkdwnOption, PlainTextOption } from '@slack/web-api';

export interface WorkspaceSettingsData {
  allowMultipleActivePolls: boolean;
  defaultAnonymous: boolean;
  defaultQuorumPct: number;
  maxNudgeChannelMembers: number;
  allowVoterChoiceNudges: boolean;
  managerUserIds: string[];
}

export interface SettingsModalViewOptions extends WorkspaceSettingsData {
  workspaceId?: string;
  canEdit?: boolean;
}

export function buildSettingsModalView(
  options: SettingsModalViewOptions
): ModalView {
  const canEdit = options.canEdit !== false;
  const maxNudgeMembers = options.maxNudgeChannelMembers || 50;

  if (!canEdit) {
    const concurrencyLabel = options.allowMultipleActivePolls
      ? 'Multiple active polls allowed'
      : 'Only 1 active poll per channel';
    const privacyLabel = options.defaultAnonymous
      ? 'Anonymous Double-Urn'
      : 'Public';
    const quorumLabel =
      options.defaultQuorumPct <= 0
        ? 'No quorum'
        : `${options.defaultQuorumPct}%`;
    const nudgesLabel = options.allowVoterChoiceNudges
      ? `Enabled (up to ${maxNudgeMembers} channel members)`
      : 'Disabled';
    const managersLabel =
      options.managerUserIds && options.managerUserIds.length > 0
        ? options.managerUserIds.map((id) => `<@${id}>`).join(', ')
        : 'None configured';

    return {
      type: 'modal',
      callback_id: 'view_settings_modal_readonly',
      title: {
        type: 'plain_text',
        text: 'Workspace Settings',
        emoji: true,
      },
      close: {
        type: 'plain_text',
        text: 'Close',
        emoji: true,
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Read-Only View*\nWorkspace settings can only be modified by Slack Admins and designated Bot Managers.',
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Channel Concurrency*\n${concurrencyLabel}`,
            },
            {
              type: 'mrkdwn',
              text: `*Default Privacy*\n${privacyLabel}`,
            },
            {
              type: 'mrkdwn',
              text: `*Default Quorum*\n${quorumLabel}`,
            },
            {
              type: 'mrkdwn',
              text: `*Smart Nudges*\n${nudgesLabel}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Delegated Bot Managers*\n${managersLabel}`,
          },
        },
      ],
    };
  }

  const concurrencyOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: '*Allow multiple active polls in the same channel*\nWhen unchecked (default), only one active poll can run per channel at a time.',
    },
    value: 'allow_multiple_active_polls',
  };

  const defaultAnonymousOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: '*Default to Anonymous Voting (Double-Urn Secret Ballot)*',
    },
    value: 'default_anonymous',
  };

  const allowNudgesOption: MrkdwnOption = {
    text: {
      type: 'mrkdwn',
      text: '*Enable Smart Nudges for Poll Creators*',
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
        text: 'No quorum required',
        emoji: true,
      },
      value: 'NONE',
    },
    {
      text: {
        type: 'plain_text',
        text: '51% — Simple Majority (Half + 1)',
        emoji: true,
      },
      value: '51',
    },
    {
      text: {
        type: 'plain_text',
        text: '66% — Two-Thirds Supermajority',
        emoji: true,
      },
      value: '66',
    },
    {
      text: {
        type: 'plain_text',
        text: '70% — Standard Team Consensus',
        emoji: true,
      },
      value: '70',
    },
    {
      text: {
        type: 'plain_text',
        text: '75% — High Consensus',
        emoji: true,
      },
      value: '75',
    },
    {
      text: {
        type: 'plain_text',
        text: '80% — Strong Supermajority',
        emoji: true,
      },
      value: '80',
    },
    {
      text: {
        type: 'plain_text',
        text: '100% — Unanimous',
        emoji: true,
      },
      value: '100',
    },
  ];

  const targetQuorumValue =
    options.defaultQuorumPct <= 0 ? 'NONE' : String(options.defaultQuorumPct);
  const selectedQuorumOption =
    quorumOptions.find((opt) => opt.value === targetQuorumValue) ??
    quorumOptions.find((opt) => opt.value === '70')!;

  return {
    type: 'modal',
    callback_id: 'submit_settings_modal',
    title: {
      type: 'plain_text',
      text: 'Workspace Settings',
      emoji: true,
    },
    submit: {
      type: 'plain_text',
      text: 'Save Settings',
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
          text: 'Channel Concurrency',
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
          text: 'Default Privacy & Nudges',
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
          text: 'Default Quorum Threshold',
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
          text: 'Max Channel Size for Smart Nudges',
        },
        hint: {
          type: 'plain_text',
          text: 'Channels larger than this member limit will not show the Nudge Non-Voters button.',
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
            text: 'Select teammates who can manage workspace settings',
          },
          ...(options.managerUserIds && options.managerUserIds.length > 0
            ? { initial_users: options.managerUserIds }
            : {}),
        },
        label: {
          type: 'plain_text',
          text: 'Designated Bot Managers',
        },
      },
    ],
  };
}
