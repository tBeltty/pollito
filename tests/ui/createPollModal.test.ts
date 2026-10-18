import { describe, it, expect } from 'vitest';
import { buildCreatePollModalView } from '../../src/slack/ui/views/createPollModal.js';
import { buildAppHomeView } from '../../src/slack/ui/views/appHome.js';

describe('Modal & App Home Views', () => {
  it('buildCreatePollModalView includes channel selector with initial_conversation when channelId is provided', () => {
    const modal = buildCreatePollModalView('C12345');
    expect(modal.type).toBe('modal');
    expect(modal.callback_id).toBe('create_poll_modal_submit');

    const channelBlock = modal.blocks.find(
      (b: any) => b.block_id === 'channel_block'
    ) as any;

    expect(channelBlock).toBeDefined();
    expect(channelBlock.element.type).toBe('conversations_select');
    expect(channelBlock.element.initial_conversation).toBe('C12345');
  });

  it('buildCreatePollModalView omits initial_conversation when channelId is empty (from App Home)', () => {
    const modal = buildCreatePollModalView('');
    const channelBlock = modal.blocks.find(
      (b: any) => b.block_id === 'channel_block'
    ) as any;

    expect(channelBlock).toBeDefined();
    expect(channelBlock.element.type).toBe('conversations_select');
    expect(channelBlock.element.initial_conversation).toBeUndefined();
  });

  it('buildAppHomeView renders clean anti-slop header and button labels', () => {
    const home = buildAppHomeView([]);
    const headerBlock = home.blocks.find((b: any) => b.type === 'header') as any;
    expect(headerBlock.text.text).toBe('Pollito');
    expect(headerBlock.text.text).not.toContain('Workspace Dashboard');

    const actionBlock = home.blocks.find((b: any) => b.type === 'actions') as any;
    const launchBtn = actionBlock.elements.find(
      (e: any) => e.action_id === 'app_home_launch_poll_click'
    );
    expect(launchBtn.text.text).toBe('New Poll');
  });
});
