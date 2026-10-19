import type { ModalView } from '@slack/web-api';
import { defaultTranslator, type Translator } from '../../../i18n/index.js';
import { NUDGE_COOLDOWN_HOURS } from '../../../config/limits.js';

export function buildGuideModalView(translator: Translator = defaultTranslator): ModalView {
  const { t } = translator;

  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: t('guide.title'),
      emoji: true,
    },
    close: {
      type: 'plain_text',
      text: t('guide.close'),
      emoji: true,
    },
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: t('guide.header.how'),
        },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: t('guide.step1') },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: t('guide.step2') },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: t('guide.step3', { hours: NUDGE_COOLDOWN_HOURS }) },
      },
      {
        type: 'divider',
      },
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: t('guide.header.commands'),
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            t('guide.cmd.builder'),
            t('guide.cmd.instant'),
            t('guide.cmd.huddleBuilder'),
            t('guide.cmd.huddleInstant'),
            t('guide.cmd.close'),
            t('guide.cmd.nudge'),
            t('guide.cmd.report'),
          ].join('\n'),
        },
      },
    ],
  };
}
