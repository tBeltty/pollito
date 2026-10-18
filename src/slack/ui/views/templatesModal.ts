import type { Block, KnownBlock, ModalView, PlainTextOption } from '@slack/web-api';
import { BUILT_IN_POLL_TEMPLATES } from './createPollModal.js';

export interface PollTemplateData {
  id: string;
  workspaceId?: string;
  creatorId?: string;
  ownerUserId?: string;
  channelId?: string | null;
  name: string;
  question: string;
  options: string[];
  isAnonymous: boolean;
  allowMultipleVotes: boolean;
  quorumType: 'PERCENTAGE' | 'NONE' | string;
  quorumTarget: number;
  duration: string;
  isShared: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TemplatesModalState {
  tab: 'mine' | 'workspace';
  isManager?: boolean;
  confirmDeleteId?: string;
}

export function buildTemplatesModalView(
  templates: PollTemplateData[],
  viewerUserId: string,
  state: TemplatesModalState = { tab: 'mine' }
): ModalView {
  const mine = templates.filter((t) => (t.creatorId ?? t.ownerUserId) === viewerUserId);
  const workspaceShared = templates.filter((t) => t.isShared);
  const builtInEntries = Object.entries(BUILT_IN_POLL_TEMPLATES);

  const blocks: (Block | KnownBlock)[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Save recurring team questions, quorum rules, and ballot settings as reusable poll templates.',
      },
    },
    {
      type: 'actions',
      block_id: 'templates_tab_actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: `My Templates (${mine.length})`,
            emoji: true,
          },
          action_id: 'templates_tab_mine',
          ...(state.tab === 'mine' ? { style: 'primary' } : {}),
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: `Workspace Templates (${workspaceShared.length + builtInEntries.length})`,
            emoji: true,
          },
          action_id: 'templates_tab_workspace',
          ...(state.tab === 'workspace' ? { style: 'primary' } : {}),
        },
      ],
    },
    {
      type: 'divider',
    },
  ];

  if (state.confirmDeleteId) {
    const target = templates.find((t) => t.id === state.confirmDeleteId);
    blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Delete template "${target?.name ?? 'Selected Template'}"?*\nThis action cannot be undone.`,
        },
      },
      {
        type: 'actions',
        block_id: 'template_delete_confirm_actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Confirm Delete',
              emoji: true,
            },
            style: 'danger',
            action_id: 'confirm_delete_template',
            value: state.confirmDeleteId,
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Cancel',
              emoji: true,
            },
            action_id: 'cancel_delete_template',
            value: state.confirmDeleteId,
          },
        ],
      },
      {
        type: 'divider',
      }
    );
  }

  const renderCustomTemplateRow = (tpl: PollTemplateData) => {
    const ownerId = tpl.creatorId ?? tpl.ownerUserId;
    const isOwn = ownerId === viewerUserId;
    const privacyLabel = tpl.isAnonymous ? 'Anonymous' : 'Public';
    const quorumLabel =
      tpl.quorumType === 'NONE' ? 'No quorum' : `${tpl.quorumTarget}% quorum`;
    const sharedBadge = tpl.isShared ? ' • *Shared*' : '';

    const menuOptions: PlainTextOption[] = [
      {
        text: {
          type: 'plain_text',
          text: 'Launch Poll',
          emoji: true,
        },
        value: `launch:${tpl.id}`,
      },
    ];

    if (isOwn) {
      menuOptions.push({
        text: {
          type: 'plain_text',
          text: 'Edit Template',
          emoji: true,
        },
        value: `edit:${tpl.id}`,
      });
      menuOptions.push({
        text: {
          type: 'plain_text',
          text: tpl.isShared ? 'Stop sharing' : 'Share with workspace',
          emoji: true,
        },
        value: tpl.isShared ? `unshare:${tpl.id}` : `share:${tpl.id}`,
      });
    }

    menuOptions.push({
      text: {
        type: 'plain_text',
        text: 'Duplicate to my templates',
        emoji: true,
      },
      value: `duplicate:${tpl.id}`,
    });

    if (isOwn) {
      menuOptions.push({
        text: {
          type: 'plain_text',
          text: 'Delete',
          emoji: true,
        },
        value: `delete:${tpl.id}`,
      });
    } else if (state.isManager) {
      menuOptions.push({
        text: {
          type: 'plain_text',
          text: 'Unpublish (Admin)',
          emoji: true,
        },
        value: `unpublish:${tpl.id}`,
      });
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${tpl.name}*${sharedBadge}\n_${tpl.question}_\n${tpl.options.length} options • ${privacyLabel} • ${quorumLabel}`,
      },
      accessory: {
        type: 'overflow',
        action_id: 'template_row_menu',
        options: menuOptions.slice(0, 5),
      },
    });
  };

  if (state.tab === 'mine') {
    if (mine.length === 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '_You have no saved templates yet. Check "Save as reusable template" when creating a poll or duplicate one from Workspace Templates._',
        },
      });
    } else {
      for (const tpl of mine.slice(0, 25)) {
        renderCustomTemplateRow(tpl);
      }
    }
  } else {
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Built-In Engineering Templates',
      },
    });

    for (const [key, tpl] of builtInEntries) {
      const privacyLabel = tpl.isAnonymous ? 'Anonymous' : 'Public';
      const quorumLabel =
        tpl.quorumType === 'NONE' ? 'No quorum' : `${tpl.quorumTarget}% quorum`;
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${tpl.name}* • _Built-in_\n_${tpl.question}_\n${tpl.options.length} options • ${privacyLabel} • ${quorumLabel}`,
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Launch Poll',
            emoji: true,
          },
          action_id: `app_home_template_${key}`,
          value: key,
        },
      });
    }

    if (workspaceShared.length > 0) {
      blocks.push(
        {
          type: 'divider',
        },
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Shared by Teammates',
          },
        }
      );

      for (const tpl of workspaceShared.slice(0, 20)) {
        renderCustomTemplateRow(tpl);
      }
    }
  }

  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: 'Poll Templates',
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: 'Close',
      emoji: true,
    },
    blocks: blocks.slice(0, 98),
  };
}
