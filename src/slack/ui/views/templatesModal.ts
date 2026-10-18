import type { Block, KnownBlock, ModalView, PlainTextOption } from '@slack/web-api';
import { defaultTranslator, type Translator } from '../../../i18n/index.js';

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
  forwardToChannelOnHuddleEnd?: boolean;
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
  state: TemplatesModalState = { tab: 'mine' },
  translator: Translator = defaultTranslator
): ModalView {
  const { t } = translator;
  const mine = templates.filter((tpl) => (tpl.creatorId ?? tpl.ownerUserId) === viewerUserId);
  const workspaceShared = templates.filter((tpl) => tpl.isShared);

  const blocks: (Block | KnownBlock)[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: t('templates.intro'),
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: state.isManager ? t('templates.button.newWorkspace') : t('templates.button.new'),
          emoji: true,
        },
        style: 'primary',
        action_id: 'open_create_template_modal',
        value: state.isManager ? 'workspace' : 'mine',
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
            text: t('templates.tab.mine', { count: mine.length }),
            emoji: true,
          },
          action_id: 'templates_tab_mine',
          ...(state.tab === 'mine' ? { style: 'primary' } : {}),
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: t('templates.tab.workspace', { count: workspaceShared.length }),
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
    const target = templates.find((tpl) => tpl.id === state.confirmDeleteId);
    blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: t('templates.delete.prompt', {
            name: target?.name ?? t('templates.delete.fallbackName'),
          }),
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
              text: t('templates.delete.confirm'),
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
              text: t('common.cancel'),
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
    const privacyLabel = tpl.isAnonymous ? t('common.anonymous') : t('common.public');
    const quorumLabel =
      tpl.quorumType === 'NONE'
        ? t('templates.row.noQuorum')
        : t('templates.row.quorum', { target: tpl.quorumTarget });
    const sharedBadge = tpl.isShared ? t('templates.row.shared') : '';

    const menuOptions: PlainTextOption[] = [
      {
        text: {
          type: 'plain_text',
          text: t('templates.menu.launch'),
          emoji: true,
        },
        value: `launch:${tpl.id}`,
      },
    ];

    if (isOwn) {
      menuOptions.push({
        text: {
          type: 'plain_text',
          text: t('templates.menu.edit'),
          emoji: true,
        },
        value: `edit:${tpl.id}`,
      });
      menuOptions.push({
        text: {
          type: 'plain_text',
          text: tpl.isShared ? t('templates.menu.unshare') : t('templates.menu.share'),
          emoji: true,
        },
        value: tpl.isShared ? `unshare:${tpl.id}` : `share:${tpl.id}`,
      });
    }

    menuOptions.push({
      text: {
        type: 'plain_text',
        text: t('templates.menu.duplicate'),
        emoji: true,
      },
      value: `duplicate:${tpl.id}`,
    });

    if (isOwn) {
      menuOptions.push({
        text: {
          type: 'plain_text',
          text: t('templates.menu.delete'),
          emoji: true,
        },
        value: `delete:${tpl.id}`,
      });
    } else if (state.isManager) {
      menuOptions.push({
        text: {
          type: 'plain_text',
          text: t('templates.menu.unpublish'),
          emoji: true,
        },
        value: `unpublish:${tpl.id}`,
      });
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: t('templates.row.summary', {
          name: tpl.name,
          shared: sharedBadge,
          question: tpl.question,
          count: tpl.options.length,
          privacy: privacyLabel,
          quorum: quorumLabel,
        }),
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
          text: t('templates.empty.mine'),
        },
      });
    } else {
      for (const tpl of mine.slice(0, 25)) {
        renderCustomTemplateRow(tpl);
      }
    }
  } else {
    if (workspaceShared.length === 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: t('templates.empty.workspace'),
        },
      });
    } else {
      for (const tpl of workspaceShared.slice(0, 25)) {
        renderCustomTemplateRow(tpl);
      }
    }
  }

  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: t('templates.title'),
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: t('common.close'),
      emoji: true,
    },
    blocks: blocks.slice(0, 98),
  };
}
