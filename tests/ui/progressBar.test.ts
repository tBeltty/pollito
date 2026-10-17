import { describe, it, expect } from 'vitest';
import { renderProgressBar } from '../../src/slack/ui/views/pollMessage.js';

describe('renderProgressBar', () => {
  it('renders 0% correctly with all empty slots', () => {
    const result = renderProgressBar(0, 10);
    expect(result).toBe('░░░░░░░░░░ 0%');
  });

  it('renders 50% correctly with half filled slots', () => {
    const result = renderProgressBar(50, 10);
    expect(result).toBe('█████░░░░░ 50%');
  });

  it('renders 75% correctly with rounded slots', () => {
    const result = renderProgressBar(75, 10);
    expect(result).toBe('████████░░ 75%');
  });

  it('renders 100% correctly with all filled slots', () => {
    const result = renderProgressBar(100, 10);
    expect(result).toBe('██████████ 100%');
  });

  it('clamps values below 0 to 0%', () => {
    const result = renderProgressBar(-15, 10);
    expect(result).toBe('░░░░░░░░░░ 0%');
  });

  it('clamps values above 100 to 100%', () => {
    const result = renderProgressBar(120, 10);
    expect(result).toBe('██████████ 100%');
  });
});
