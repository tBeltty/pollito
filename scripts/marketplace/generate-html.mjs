import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT_HTML_DIR = process.argv[2] || path.join(__dirname, '.tmp');

fs.mkdirSync(OUT_HTML_DIR, { recursive: true });

const svgIcons = {
  target: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  lock: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  thread: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  headphones: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>`,
  bolt: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`,
  bellOff: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5"/><path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="m2 2 20 20"/></svg>`,
  userCheck: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>`,
  clock: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  chart: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>`,
  layers: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  eye: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
};

const sharedCss = `
  @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

  :root {
    --bg-canvas: #0b0f19;
    --bg-frame: #0f172a;
    --bg-elevated: #1e293b;
    --text-primary: #f8fafc;
    --text-secondary: #cbd5e1;
    --text-muted: #94a3b8;
    --brand-amber: #f59e0b;
    --brand-amber-light: #fbbf24;
    --brand-purple: #8b5cf6;
    --brand-purple-light: #a78bfa;
    --brand-emerald: #10b981;
    --brand-emerald-light: #34d399;
    --slack-bg: #1a1d21;
    --slack-sidebar: #19171d;
    --slack-header: #222529;
    --slack-border: rgba(255, 255, 255, 0.1);
    --slack-text: #d1d2d3;
    --slack-bright: #f8f8f8;
    --slack-muted: #ababad;
    --slack-green: #007a5a;
    --slack-danger: #e01e5a;
    --slack-mention-text: #2ba5ce;
    --slack-mention-bg: rgba(29, 155, 209, 0.18);
    --slack-code-orange: #e8912d;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    width: 1600px;
    height: 1000px;
    overflow: hidden;
    background-color: var(--bg-canvas);
    color: var(--text-primary);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .canvas {
    width: 1600px;
    height: 1000px;
    padding: 28px;
    position: relative;
    display: flex;
  }

  .stage {
    width: 100%;
    height: 100%;
    border-radius: 32px;
    background-color: var(--bg-frame);
    background-image:
      radial-gradient(circle at 18% 22%, rgba(139, 92, 246, 0.22) 0%, transparent 52%),
      radial-gradient(circle at 82% 78%, rgba(245, 158, 11, 0.14) 0%, transparent 52%),
      linear-gradient(rgba(255, 255, 255, 0.032) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.032) 1px, transparent 1px);
    background-size: 100% 100%, 100% 100%, 56px 56px, 56px 56px;
    border: 2px solid rgba(139, 92, 246, 0.42);
    box-shadow: inset 0 0 80px rgba(139, 92, 246, 0.1), 0 24px 60px rgba(0, 0, 0, 0.6);
    display: grid;
    grid-template-columns: 540px 1fr;
    gap: 36px;
    padding: 46px 52px;
    position: relative;
    overflow: hidden;
  }

  /* Left Narrative Column */
  .copy-col {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    z-index: 2;
    height: 100%;
  }

  .copy-top {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .brand-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .brand-badge {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    font-family: 'Raleway', sans-serif;
    font-weight: 800;
    font-size: 26px;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .brand-badge img {
    width: 40px;
    height: 40px;
    border-radius: 10px;
  }

  .slide-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 4px 10px;
    border-radius: 999px;
  }

  .slide-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    align-self: flex-start;
    padding: 7px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: rgba(139, 92, 246, 0.16);
    border: 1px solid rgba(167, 139, 250, 0.35);
    color: #ddd6fe;
  }

  .slide-pill.amber {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(251, 191, 36, 0.38);
    color: #fde68a;
  }

  .slide-pill.emerald {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(52, 211, 153, 0.38);
    color: #a7f3d0;
  }

  .headline {
    font-family: 'Raleway', sans-serif;
    font-size: 46px;
    font-weight: 800;
    line-height: 1.08;
    letter-spacing: -0.03em;
    color: var(--text-primary);
  }

  .headline .accent-amber {
    color: var(--brand-amber-light);
  }

  .headline .accent-purple {
    color: var(--brand-purple-light);
  }

  .headline .accent-emerald {
    color: var(--brand-emerald-light);
  }

  .subtitle {
    font-size: 18.5px;
    line-height: 1.5;
    color: var(--text-secondary);
    font-weight: 400;
  }

  /* Feature Callout Cards in Left Column */
  .feature-chips {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 6px;
  }

  .chip-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 13px 16px;
    border-radius: 14px;
    background: rgba(30, 41, 59, 0.65);
    border: 1px solid rgba(148, 163, 184, 0.16);
  }

  .chip-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #c4b5fd;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.35);
  }

  .chip-icon.amber {
    color: #fde68a;
    background: rgba(245, 158, 11, 0.2);
    border-color: rgba(245, 158, 11, 0.35);
  }

  .chip-icon.emerald {
    color: #a7f3d0;
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.35);
  }

  .chip-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .chip-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .chip-desc {
    font-size: 13px;
    color: var(--text-muted);
  }

  .bottom-anchor {
    margin-top: auto;
    background: rgba(15, 23, 42, 0.78);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 16px;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  /* Right Visual Stage */
  .visual-col {
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;
    z-index: 2;
    min-width: 0;
  }

  /* Slack Window Shell */
  .slack-window {
    background: var(--slack-bg);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 18px;
    box-shadow: 0 28px 65px -12px rgba(0, 0, 0, 0.78), 0 0 0 1px rgba(255, 255, 255, 0.04);
    overflow: hidden;
    color: var(--slack-text);
    display: flex;
    flex-direction: column;
  }

  .slack-topbar {
    background: #141619;
    border-bottom: 1px solid var(--slack-border);
    padding: 13px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .window-dots {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
  }
  .dot.r { background: #ff5f56; }
  .dot.y { background: #ffbd2e; }
  .dot.g { background: #27c93f; }

  .channel-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 15px;
    font-weight: 700;
    color: var(--slack-bright);
  }

  .channel-title .hash {
    color: var(--slack-muted);
    font-weight: 800;
  }

  .channel-title .topic {
    font-weight: 400;
    color: var(--slack-muted);
    font-size: 13.5px;
    margin-left: 6px;
  }

  .status-pill {
    font-size: 12.5px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .status-pill.green {
    color: #34d399;
    background: rgba(52, 211, 153, 0.13);
    border: 1px solid rgba(52, 211, 153, 0.3);
  }

  .status-pill.amber {
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.14);
    border: 1px solid rgba(251, 191, 36, 0.32);
  }

  .status-pill.purple {
    color: #c4b5fd;
    background: rgba(139, 92, 246, 0.18);
    border: 1px solid rgba(167, 139, 250, 0.35);
  }

  /* Slack Message Layout */
  .slack-msg {
    display: grid;
    grid-template-columns: 42px 1fr;
    gap: 14px;
    padding: 22px 24px;
  }

  .slack-avatar {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .slack-avatar img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .msg-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  .msg-sender {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sender-name {
    font-size: 16px;
    font-weight: 800;
    color: var(--slack-bright);
  }

  .app-tag {
    background: rgba(255, 255, 255, 0.1);
    color: var(--slack-muted);
    font-size: 10.5px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.03em;
  }

  .msg-time {
    font-size: 12.5px;
    color: var(--slack-muted);
  }

  .bk-header {
    font-size: 19px;
    font-weight: 800;
    color: var(--slack-bright);
    line-height: 1.3;
    margin-top: 2px;
  }

  .bk-context {
    font-size: 13.5px;
    color: var(--slack-muted);
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .bk-context strong {
    color: var(--slack-text);
    font-weight: 600;
  }

  .bk-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 4px 0;
  }

  .bk-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .bk-option.highlight {
    background: rgba(0, 122, 90, 0.12);
    border-color: rgba(0, 122, 90, 0.38);
  }

  .bk-option-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .bk-option-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--slack-bright);
  }

  .bk-telemetry {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13.5px;
    color: var(--slack-text);
  }

  .ascii-bar {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: var(--slack-code-orange);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.09);
    padding: 2px 8px;
    border-radius: 5px;
    letter-spacing: 0.02em;
  }

  .voter-mentions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 2px;
  }

  .mention {
    color: var(--slack-mention-text);
    background: var(--slack-mention-bg);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12.5px;
    font-weight: 500;
  }

  .bk-btn {
    padding: 7px 15px;
    border-radius: 7px;
    font-size: 13.5px;
    font-weight: 700;
    border: 1px solid rgba(255, 255, 255, 0.22);
    background: transparent;
    color: var(--slack-bright);
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .bk-btn.primary {
    background: var(--slack-green);
    border-color: var(--slack-green);
    color: #ffffff;
  }

  .bk-btn.danger {
    background: var(--slack-danger);
    border-color: var(--slack-danger);
    color: #ffffff;
  }

  .bk-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
  }

  .bk-footer {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12.5px;
    color: var(--slack-muted);
    margin-top: 2px;
  }
`;

// ---------------------------------------------------------------------------
// SLIDE 1: Polls that close at quorum (Hero + Live In-Channel Poll Card)
// ---------------------------------------------------------------------------
const slide1Html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  ${sharedCss}
  .mascot-wrap {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: 18px;
    margin-top: auto;
  }
  .mascot-img {
    width: 245px;
    height: auto;
    filter: drop-shadow(0 16px 28px rgba(0, 0, 0, 0.55));
  }
  .mascot-callout {
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(245, 158, 11, 0.35);
    border-radius: 16px;
    padding: 14px 18px;
    margin-bottom: 24px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mascot-callout-title {
    font-size: 14px;
    font-weight: 700;
    color: #fde68a;
  }
  .mascot-callout-desc {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.4;
  }
</style>
</head>
<body>
  <div class="canvas">
    <div class="stage">
      <div class="copy-col">
        <div class="copy-top">
          <div class="brand-row">
            <div class="brand-badge">
              <img src="file://${ROOT}/public/assets/plates/pollito-nav-logo.png" alt="Pollito">
              <span>Pollito</span>
            </div>
            <span class="slide-num">01 / 06</span>
          </div>
          <span class="slide-pill amber">In-Channel Consensus</span>
          <h1 class="headline">Polls that close at <span class="accent-amber">quorum.</span></h1>
          <p class="subtitle">
            Set a participation threshold from 51% to 100% of channel members. Teammates vote in one click, and the card updates in place.
          </p>
        </div>

        <div class="mascot-wrap">
          <img class="mascot-img" src="file://${ROOT}/public/assets/plates/mascot-pollito.png" alt="Pollito Mascot">
          <div class="mascot-callout">
            <div class="mascot-callout-title">Zero Context Switching</div>
            <div class="mascot-callout-desc">100% inside Slack channels, Huddles, and App Home. No external web logins.</div>
          </div>
        </div>
      </div>

      <div class="visual-col">
        <div class="slack-window">
          <div class="slack-topbar">
            <div class="channel-title">
              <div class="window-dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></div>
              <span class="hash" style="margin-left:10px;">#</span>
              <span>team-retros</span>
              <span class="topic">· Q4 Planning &amp; Consensus</span>
            </div>
            <span class="status-pill green">Quorum Active · 75% Target</span>
          </div>

          <div class="slack-msg">
            <div class="slack-avatar">
              <img src="file://${ROOT}/public/assets/plates/pollito-nav-logo.png" alt="Pollito">
            </div>
            <div class="msg-body">
              <div class="msg-sender">
                <span class="sender-name">Pollito</span>
                <span class="app-tag">APP</span>
                <span class="msg-time">10:42 AM</span>
              </div>

              <div class="bk-header">Where should we host the Q4 Team Retro?</div>

              <div class="bk-context">
                <span><strong>Status:</strong> Approaching quorum target</span>
                <span>•</span>
                <span><strong>Type:</strong> Anonymous ballot</span>
                <span>•</span>
                <span>Single choice</span>
              </div>

              <div class="bk-divider"></div>

              <div class="bk-option highlight">
                <div class="bk-option-info">
                  <div class="bk-option-title">1. Blue Terrace Rooftop</div>
                  <div class="bk-telemetry">
                    <span class="ascii-bar">█████░░░░░ 50%</span>
                    <span>• <strong>4</strong> votes</span>
                  </div>
                </div>
                <div class="bk-btn primary">Vote 1</div>
              </div>

              <div class="bk-option">
                <div class="bk-option-info">
                  <div class="bk-option-title">2. Downtown Workshop Space</div>
                  <div class="bk-telemetry">
                    <span class="ascii-bar">████░░░░░░ 38%</span>
                    <span>• <strong>3</strong> votes</span>
                  </div>
                </div>
                <div class="bk-btn primary">Vote 2</div>
              </div>

              <div class="bk-option">
                <div class="bk-option-info">
                  <div class="bk-option-title">3. Virtual (Slack Huddle + Miro)</div>
                  <div class="bk-telemetry">
                    <span class="ascii-bar">█░░░░░░░░░ 13%</span>
                    <span>• <strong>1</strong> vote</span>
                  </div>
                </div>
                <div class="bk-btn primary">Vote 3</div>
              </div>

              <div class="bk-actions">
                <div class="bk-btn">Remind non-voters</div>
                <div class="bk-btn danger">Close poll</div>
              </div>

              <div class="bk-divider"></div>

              <div class="bk-footer">
                <div>Quorum target: 75% (8/12 members • 67% reached) • Closes: Oct 23, 5:00 PM</div>
                <div>Created by <span class="mention">@sarah</span> • ID: cm9x7q2k</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

// ---------------------------------------------------------------------------
// SLIDE 2: Instant winner announcement when quorum hits (Quorum Reached + Thread)
// ---------------------------------------------------------------------------
const slide2Html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  ${sharedCss}
  .thread-connector {
    margin: 0 24px 20px 66px;
    background: #14171a;
    border: 1px solid rgba(52, 211, 153, 0.35);
    border-left: 4px solid #10b981;
    border-radius: 12px;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
  }
  .thread-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #34d399;
  }
  .thread-msg {
    display: grid;
    grid-template-columns: 36px 1fr;
    gap: 12px;
    align-items: start;
  }
  .thread-avatar {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: #0f172a;
    overflow: hidden;
  }
  .thread-avatar img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .winner-banner {
    margin-top: 6px;
    padding: 10px 14px;
    background: rgba(16, 185, 129, 0.14);
    border: 1px solid rgba(52, 211, 153, 0.35);
    border-radius: 8px;
    color: #ecfdf5;
    font-size: 14.5px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .lifecycle-pills {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-secondary);
  }
  .lc-step {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
  }
  .lc-step.active {
    background: rgba(16, 185, 129, 0.16);
    border: 1px solid rgba(52, 211, 153, 0.35);
    color: #a7f3d0;
  }
</style>
</head>
<body>
  <div class="canvas">
    <div class="stage">
      <div class="copy-col">
        <div class="copy-top">
          <div class="brand-row">
            <div class="brand-badge">
              <img src="file://${ROOT}/public/assets/plates/pollito-nav-logo.png" alt="Pollito">
              <span>Pollito</span>
            </div>
            <span class="slide-num">02 / 06</span>
          </div>
          <span class="slide-pill emerald">Automatic Resolution</span>
          <h1 class="headline">Instant winner post when <span class="accent-emerald">quorum hits.</span></h1>
          <p class="subtitle">
            As soon as the decisive vote lands, Pollito locks the ballot in place and announces the winning option in the thread.
          </p>

          <div class="feature-chips">
            <div class="chip-row">
              <div class="chip-icon emerald">${svgIcons.target}</div>
              <div class="chip-text">
                <div class="chip-title">Deterministic Quorum Detection</div>
                <div class="chip-desc">Calculates unique voters against eligible channel members in real time.</div>
              </div>
            </div>
            <div class="chip-row">
              <div class="chip-icon amber">${svgIcons.lock}</div>
              <div class="chip-text">
                <div class="chip-title">Automatic Ballot Lock</div>
                <div class="chip-desc">Removes voting buttons via chat.update so late clicks cannot skew results.</div>
              </div>
            </div>
            <div class="chip-row">
              <div class="chip-icon">${svgIcons.thread}</div>
              <div class="chip-text">
                <div class="chip-title">Clean Thread Summary</div>
                <div class="chip-desc">Posts the winning option or exact tie breakdown directly in the poll thread.</div>
              </div>
            </div>
          </div>
        </div>

        <div class="bottom-anchor">
          <div class="lifecycle-pills">
            <span class="lc-step">Poll Open</span>
            <span>→</span>
            <span class="lc-step">67% Voted</span>
            <span>→</span>
            <span class="lc-step active">🎉 Quorum Hit</span>
            <span>→</span>
            <span class="lc-step">🏆 Winner Posted</span>
          </div>
        </div>
      </div>

      <div class="visual-col">
        <div class="slack-window">
          <div class="slack-topbar">
            <div class="channel-title">
              <div class="window-dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></div>
              <span class="hash" style="margin-left:10px;">#</span>
              <span>eng-architecture</span>
              <span class="topic">· RFC Decisions</span>
            </div>
            <span class="status-pill amber">🎉 Quorum Reached · 75% (9/12)</span>
          </div>

          <div class="slack-msg" style="padding-bottom: 14px;">
            <div class="slack-avatar">
              <img src="file://${ROOT}/public/assets/plates/pollito-nav-logo.png" alt="Pollito">
            </div>
            <div class="msg-body">
              <div class="msg-sender">
                <span class="sender-name">Pollito</span>
                <span class="app-tag">APP</span>
                <span class="msg-time">11:15 AM</span>
              </div>

              <div class="bk-header">Which queue engine should power the webhook worker?</div>

              <div class="bk-context">
                <span><strong>Status:</strong> 🎉 Quorum reached • Closed</span>
                <span>•</span>
                <span><strong>Type:</strong> Public vote</span>
                <span>•</span>
                <span>Single choice</span>
              </div>

              <div class="bk-divider"></div>

              <div class="bk-option highlight">
                <div class="bk-option-info">
                  <div class="bk-option-title">1. BullMQ + Redis Streams 🏆</div>
                  <div class="bk-telemetry">
                    <span class="ascii-bar">███████░░░ 67%</span>
                    <span>• <strong>6</strong> votes</span>
                  </div>
                  <div class="voter-mentions">
                    <span class="mention">@sarah</span>
                    <span class="mention">@alex</span>
                    <span class="mention">@Elena</span>
                    <span class="mention">@marcus</span>
                    <span class="mention">@priya</span>
                    <span class="mention">@devon</span>
                  </div>
                </div>
              </div>

              <div class="bk-option">
                <div class="bk-option-info">
                  <div class="bk-option-title">2. Postgres SKIP LOCKED Worker</div>
                  <div class="bk-telemetry">
                    <span class="ascii-bar">███░░░░░░░ 33%</span>
                    <span>• <strong>3</strong> votes</span>
                  </div>
                  <div class="voter-mentions">
                    <span class="mention">@liam</span>
                    <span class="mention">@noah</span>
                    <span class="mention">@chloe</span>
                  </div>
                </div>
              </div>

              <div class="bk-divider"></div>

              <div class="bk-footer">
                <div>Quorum target: 75% (9/12 members • 75% reached) • Closed: Oct 19, 11:18 AM</div>
              </div>
            </div>
          </div>

          <div class="thread-connector">
            <div class="thread-badge">↳ Thread Reply · Posted automatically on quorum</div>
            <div class="thread-msg">
              <div class="thread-avatar">
                <img src="file://${ROOT}/public/assets/plates/pollito-nav-logo.png" alt="Pollito">
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;">
                <div class="msg-sender">
                  <span class="sender-name" style="font-size:14.5px;">Pollito</span>
                  <span class="app-tag">APP</span>
                  <span class="msg-time">11:18 AM</span>
                </div>
                <div style="font-size:14.5px;font-weight:700;color:var(--slack-bright);">🎉 Quorum reached. Poll closed</div>
                <div style="font-size:13.5px;color:var(--slack-text);">
                  <strong>Which queue engine should power the webhook worker?</strong> reached its target quorum with <strong>9</strong> participants.
                </div>
                <div class="winner-banner">
                  <span>🏆 Winner: <strong>BullMQ + Redis Streams</strong> (6 votes).</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

// ---------------------------------------------------------------------------
// SLIDE 3: Interactive Modal Builder & Huddle Thread Support
// ---------------------------------------------------------------------------
const slide3Html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  ${sharedCss}
  .cmd-card {
    background: #14171c;
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 14px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cmd-label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brand-purple-light);
  }
  .cmd-code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: #f8fafc;
    background: rgba(255, 255, 255, 0.05);
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    line-height: 1.45;
  }
  .cmd-code .kw { color: #34d399; font-weight: 600; }
  .cmd-code .str { color: #fbbf24; }

  /* Slack Modal Card */
  .modal-card {
    background: #222529;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 16px;
    box-shadow: 0 32px 70px rgba(0, 0, 0, 0.85);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .modal-header {
    padding: 18px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .modal-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 19px;
    font-weight: 800;
    color: var(--slack-bright);
  }
  .modal-title img {
    width: 28px;
    height: 28px;
    border-radius: 6px;
  }
  .modal-close {
    color: var(--slack-muted);
    font-size: 20px;
    font-weight: 600;
  }
  .modal-body {
    padding: 18px 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .huddle-banner {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(52, 211, 153, 0.32);
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 13px;
    color: #d1fae5;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .field-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .field-label {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--slack-bright);
  }
  .field-input, .field-select {
    background: #1a1d21;
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 14px;
    color: var(--slack-bright);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .checkbox-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 10px 14px;
  }
  .cb-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .cb-box {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1.5px solid rgba(255, 255, 255, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 800;
    margin-top: 2px;
    flex-shrink: 0;
  }
  .cb-box.checked {
    background: #1d9bd1;
    border-color: #1d9bd1;
    color: #fff;
  }
  .modal-footer {
    padding: 14px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    background: #1d2024;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
  }
</style>
</head>
<body>
  <div class="canvas">
    <div class="stage">
      <div class="copy-col">
        <div class="copy-top">
          <div class="brand-row">
            <div class="brand-badge">
              <img src="file://${ROOT}/public/assets/plates/pollito-nav-logo.png" alt="Pollito">
              <span>Pollito</span>
            </div>
            <span class="slide-num">03 / 06</span>
          </div>
          <span class="slide-pill">Modal &amp; Slash Commands</span>
          <h1 class="headline">Launch from <span class="accent-purple">/pollito</span> or inside any Huddle.</h1>
          <p class="subtitle">
            Use the visual modal builder, run an inline slash command in seconds, or target an active Slack Huddle thread automatically.
          </p>

          <div class="cmd-card">
            <div class="cmd-label">Instant Slash Commands</div>
            <div class="cmd-code">
              <span class="kw">/pollito</span> <span class="str">"Ship v2.4 today?"</span> <span class="str">"Yes, deploy"</span> <span class="str">"Wait for QA"</span>
            </div>
            <div class="cmd-code">
              <span class="kw">/pollito huddle</span> <span style="color:#94a3b8;"># Posts directly inside live Huddle thread</span>
            </div>
          </div>

          <div class="feature-chips" style="margin-top:0;">
            <div class="chip-row">
              <div class="chip-icon">${svgIcons.headphones}</div>
              <div class="chip-text">
                <div class="chip-title">Huddle-End Follow-up</div>
                <div class="chip-desc">Posts a channel link if the Huddle ends while voting is still open.</div>
              </div>
            </div>
          </div>
        </div>

        <div class="bottom-anchor">
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="chip-icon amber" style="width:32px;height:32px;">${svgIcons.bolt}</div>
            <div>
              <div style="font-size:14px;font-weight:700;color:#f8fafc;">3 Ways to Launch in Slack</div>
              <div style="font-size:12.5px;color:#94a3b8;">Slash command <code>/pollito</code> • Global shortcut • App Home button</div>
            </div>
          </div>
        </div>
      </div>

      <div class="visual-col">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">
              <img src="file://${ROOT}/public/assets/plates/pollito-nav-logo.png" alt="Pollito">
              <span>Create a Huddle poll</span>
            </div>
            <span class="modal-close">✕</span>
          </div>

          <div class="modal-body">
            <div class="huddle-banner">
              <span style="display:flex;color:#34d399;">${svgIcons.headphones}</span>
              <div>
                <strong>Target: Active Huddle Thread in #sprint-planning</strong><br>
                <span>This poll will be posted directly inside the live Huddle thread.</span>
              </div>
            </div>

            <div class="field-group">
              <div class="field-label">Poll question</div>
              <div class="field-input">Should we split the auth migration into two sprints?</div>
            </div>

            <div class="field-grid-2">
              <div class="field-group">
                <div class="field-label">Option 1</div>
                <div class="field-input">Yes, split Phase 1 &amp; Phase 2</div>
              </div>
              <div class="field-group">
                <div class="field-label">Option 2</div>
                <div class="field-input">Keep in Sprint 14 with extra QA</div>
              </div>
            </div>

            <div class="field-group">
              <div class="field-label">Option 3 <span style="color:var(--slack-muted);font-weight:400;">(optional)</span></div>
              <div class="field-input">Defer OAuth rotation to next month</div>
            </div>

            <div class="field-group">
              <div class="field-label">Poll settings</div>
              <div class="checkbox-list">
                <div class="cb-row">
                  <div class="cb-box checked">✓</div>
                  <div>
                    <div style="font-size:13.5px;font-weight:700;color:var(--slack-bright);">Anonymous voting</div>
                    <div style="font-size:12px;color:var(--slack-muted);">Nobody can see who voted for what.</div>
                  </div>
                </div>
                <div class="cb-row">
                  <div class="cb-box checked">✓</div>
                  <div>
                    <div style="font-size:13.5px;font-weight:700;color:var(--slack-bright);">Remind in channel when Huddle ends</div>
                    <div style="font-size:12px;color:var(--slack-muted);">Posts a vote reminder link in the channel when the Huddle ends.</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="field-grid-2">
              <div class="field-group">
                <div class="field-label">Target quorum percentage (%)</div>
                <div class="field-input"><span>75</span><span style="color:var(--slack-muted);font-size:12px;">Min 51%</span></div>
              </div>
              <div class="field-group">
                <div class="field-label">Poll duration or deadline</div>
                <div class="field-select"><span>24 hours (1 day)</span><span>▾</span></div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <div class="bk-btn">Cancel</div>
            <div class="bk-btn primary" style="padding:8px 20px;">Launch poll</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

// ---------------------------------------------------------------------------
// SLIDE 4: Anonymous Secret Ballot (Double-Urn Architecture)
// ---------------------------------------------------------------------------
const slide4Html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  ${sharedCss}
  .urn-diagram {
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(167, 139, 250, 0.35);
    border-radius: 16px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .urn-header {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brand-purple-light);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .urn-grid {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 10px;
  }
  .urn-box {
    background: rgba(30, 41, 59, 0.85);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .urn-box-title {
    font-size: 13px;
    font-weight: 700;
    color: #f8fafc;
  }
  .urn-box-sub {
    font-size: 11.5px;
    color: #94a3b8;
    font-family: 'JetBrains Mono', monospace;
  }
  .urn-sep {
    font-size: 13px;
    font-weight: 800;
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.14);
    border: 1px solid rgba(245, 158, 11, 0.35);
    padding: 5px 8px;
    border-radius: 8px;
  }
  .ephemeral-toast {
    margin: 0 24px 22px 66px;
    background: rgba(29, 155, 209, 0.1);
    border: 1px solid rgba(29, 155, 209, 0.3);
    border-left: 4px solid #2ba5ce;
    border-radius: 10px;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ephemeral-eye {
    font-size: 12px;
    color: var(--slack-muted);
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>
</head>
<body>
  <div class="canvas">
    <div class="stage">
      <div class="copy-col">
        <div class="copy-top">
          <div class="brand-row">
            <div class="brand-badge">
              <img src="file://${ROOT}/public/assets/plates/pollito-nav-logo.png" alt="Pollito">
              <span>Pollito</span>
            </div>
            <span class="slide-num">04 / 06</span>
          </div>
          <span class="slide-pill amber">Double-Urn Secret Ballot</span>
          <h1 class="headline">Anonymous polls your team <span class="accent-amber">can trust.</span></h1>
          <p class="subtitle">
            Get candid answers in retros and pulse checks. Pollito separates participation records from option tallies so nobody can inspect who voted for what.
          </p>

          <div class="urn-diagram">
            <div class="urn-header">
              <span>Unlinked Ballot Storage</span>
              <span style="color:#34d399;">Zero Voter-to-Choice Foreign Key</span>
            </div>
            <div class="urn-grid">
              <div class="urn-box">
                <div class="urn-box-title">Urn A · Turnout</div>
                <div class="urn-box-sub">voterId: U049K...<br>Prevents double vote</div>
              </div>
              <div class="urn-sep">≠</div>
              <div class="urn-box">
                <div class="urn-box-title">Urn B · Tallies</div>
                <div class="urn-box-sub">optionId: opt_2<br>voteCount: +1</div>
              </div>
            </div>
          </div>

          <div class="feature-chips" style="margin-top:0;">
            <div class="chip-row">
              <div class="chip-icon amber">${svgIcons.shield}</div>
              <div class="chip-text">
                <div class="chip-title">Hidden from Creators &amp; Admins</div>
                <div class="chip-desc">Even workspace owners and CSV exports only see aggregate counts.</div>
              </div>
            </div>
          </div>
        </div>

        <div class="bottom-anchor">
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="chip-icon" style="width:32px;height:32px;">${svgIcons.lock}</div>
            <div>
              <div style="font-size:14px;font-weight:700;color:#f8fafc;">Cryptographic Privacy by Default</div>
              <div style="font-size:12.5px;color:#94a3b8;">No user mentions rendered on anonymous cards • Least-privilege bot scopes</div>
            </div>
          </div>
        </div>
      </div>

      <div class="visual-col">
        <div class="slack-window">
          <div class="slack-topbar">
            <div class="channel-title">
              <div class="window-dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></div>
              <span class="hash" style="margin-left:10px;">#</span>
              <span>sprint-retros</span>
              <span class="topic">· Candid Team Pulse</span>
            </div>
            <span class="status-pill purple">Anonymous Ballot</span>
          </div>

          <div class="slack-msg" style="padding-bottom: 14px;">
            <div class="slack-avatar">
              <img src="file://${ROOT}/public/assets/plates/pollito-nav-logo.png" alt="Pollito">
            </div>
            <div class="msg-body">
              <div class="msg-sender">
                <span class="sender-name">Pollito</span>
                <span class="app-tag">APP</span>
                <span class="msg-time">2:10 PM</span>
              </div>

              <div class="bk-header">How confident do you feel about the Q4 release timeline?</div>

              <div class="bk-context">
                <span><strong>Status:</strong> Poll active</span>
                <span>•</span>
                <span><strong>Type:</strong> Anonymous ballot</span>
                <span>•</span>
                <span>Single choice</span>
              </div>

              <div class="bk-divider"></div>

              <div class="bk-option">
                <div class="bk-option-info">
                  <div class="bk-option-title">1. Ready to ship on schedule</div>
                  <div class="bk-telemetry">
                    <span class="ascii-bar">██░░░░░░░░ 20%</span>
                    <span>• <strong>2</strong> votes</span>
                  </div>
                </div>
                <div class="bk-btn primary">Vote 1</div>
              </div>

              <div class="bk-option highlight">
                <div class="bk-option-info">
                  <div class="bk-option-title">2. Need 1 extra sprint for load testing</div>
                  <div class="bk-telemetry">
                    <span class="ascii-bar">██████░░░░ 60%</span>
                    <span>• <strong>6</strong> votes</span>
                  </div>
                </div>
                <div class="bk-btn primary">Vote 2</div>
              </div>

              <div class="bk-option">
                <div class="bk-option-info">
                  <div class="bk-option-title">3. Blocked on third-party API migration</div>
                  <div class="bk-telemetry">
                    <span class="ascii-bar">██░░░░░░░░ 20%</span>
                    <span>• <strong>2</strong> votes</span>
                  </div>
                </div>
                <div class="bk-btn primary">Vote 3</div>
              </div>

              <div class="bk-divider"></div>

              <div class="bk-footer">
                <div>Quorum target: 80% (10/14 members • 71% reached)</div>
                <div>Created by <span class="mention">@alex</span> • ID: cm9x8b4p</div>
              </div>
            </div>
          </div>

          <div class="ephemeral-toast">
            <div class="ephemeral-eye">${svgIcons.eye} <span>Only visible to you</span></div>
            <div style="font-size:14px;color:var(--slack-bright);font-weight:600;">
              Your anonymous vote has been recorded.
            </div>
            <div style="font-size:12.5px;color:var(--slack-muted);">
              Your choice is unlinked from your Slack user ID and never appears in channel cards or exports.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

// ---------------------------------------------------------------------------
// SLIDE 5: Smart Nudges (Private DM Reminders strictly to non-voters)
// ---------------------------------------------------------------------------
const slide5Html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  ${sharedCss}
  .stack-cards {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .confirm-modal-card {
    background: #222529;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 16px;
    padding: 20px 24px;
    box-shadow: 0 24px 50px rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .confirm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .confirm-title {
    font-size: 18px;
    font-weight: 800;
    color: var(--slack-bright);
  }
  .confirm-body {
    font-size: 14px;
    line-height: 1.5;
    color: var(--slack-text);
  }
  .confirm-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
  }
  .dm-preview-card {
    background: var(--slack-bg);
    border: 1px solid rgba(52, 211, 153, 0.35);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 24px 55px rgba(0, 0, 0, 0.75);
  }
  .dm-Jump-box {
    margin-top: 8px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.03);
    border-left: 3px solid #f59e0b;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .creator-toast {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(52, 211, 153, 0.32);
    border-left: 4px solid #10b981;
    border-radius: 12px;
    padding: 13px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
</style>
</head>
<body>
  <div class="canvas">
    <div class="stage">
      <div class="copy-col">
        <div class="copy-top">
          <div class="brand-row">
            <div class="brand-badge">
              <img src="file://${ROOT}/public/assets/plates/pollito-nav-logo.png" alt="Pollito">
              <span>Pollito</span>
            </div>
            <span class="slide-num">05 / 06</span>
          </div>
          <span class="slide-pill emerald">Smart Reminders</span>
          <h1 class="headline">Remind non-voters <span class="accent-emerald">privately.</span></h1>
          <p class="subtitle">
            Reach quorum without <span class="mention">@here</span> channel noise. Send a private DM strictly to channel members who have not cast their ballot yet.
          </p>

          <div class="feature-chips">
            <div class="chip-row">
              <div class="chip-icon emerald">${svgIcons.bellOff}</div>
              <div class="chip-text">
                <div class="chip-title">Zero Channel Clutter</div>
                <div class="chip-desc">Teammates who already voted are never interrupted.</div>
              </div>
            </div>
            <div class="chip-row">
              <div class="chip-icon amber">${svgIcons.userCheck}</div>
              <div class="chip-text">
                <div class="chip-title">No Public Shaming</div>
                <div class="chip-desc">Never reveals in the channel who is still pending.</div>
              </div>
            </div>
            <div class="chip-row">
              <div class="chip-icon">${svgIcons.clock}</div>
              <div class="chip-text">
                <div class="chip-title">Built-in Cooldown Guard</div>
                <div class="chip-desc">Creator-only action with a 4-hour cooldown and channel size cap.</div>
              </div>
            </div>
          </div>
        </div>

        <div class="bottom-anchor">
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="chip-icon emerald" style="width:32px;height:32px;">${svgIcons.thread}</div>
            <div>
              <div style="font-size:14px;font-weight:700;color:#f8fafc;">Button or Slash Command</div>
              <div style="font-size:12.5px;color:#94a3b8;">Click <strong>Remind non-voters</strong> on the card or run <code>/pollito nudge</code></div>
            </div>
          </div>
        </div>
      </div>

      <div class="visual-col">
        <div class="stack-cards">
          <!-- Step 1: Creator clicks Remind non-voters -->
          <div class="confirm-modal-card">
            <div class="confirm-header">
              <span class="confirm-title">Send reminder to non-voters?</span>
              <span class="status-pill purple">Creator Action · /pollito nudge</span>
            </div>
            <div class="confirm-body">
              Pollito will send a private DM to members of <strong>#team-retros</strong> who have not voted yet. Only the poll creator can send reminders, and each poll allows one every 4 hours.
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px;">
              <span style="font-size:13px;color:#34d399;font-weight:600;">3 pending members detected (9/12 already voted)</span>
              <div class="confirm-actions">
                <div class="bk-btn">Cancel</div>
                <div class="bk-btn primary">Send reminders</div>
              </div>
            </div>
          </div>

          <!-- Step 2: Ephemeral Confirmation to Creator -->
          <div class="creator-toast">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="display:flex;color:#94a3b8;">${svgIcons.eye}</span>
              <div>
                <div style="font-size:13.5px;font-weight:700;color:var(--slack-bright);">Sent private reminders to 3 teammates.</div>
                <div style="font-size:12px;color:var(--slack-muted);">Only visible to you in #team-retros • Next reminder available in 4 hours</div>
              </div>
            </div>
            <span class="status-pill green">3 DMs Sent</span>
          </div>

          <!-- Step 3: Non-voter receives private DM -->
          <div class="dm-preview-card">
            <div class="slack-topbar">
              <div class="channel-title">
                <span style="color:#34d399;">●</span>
                <span>Pollito</span>
                <span class="app-tag">APP</span>
                <span class="topic">· Direct Message to non-voter</span>
              </div>
              <span class="status-pill green">Private DM Delivered</span>
            </div>

            <div class="slack-msg">
              <div class="slack-avatar">
                <img src="file://${ROOT}/public/assets/plates/pollito-nav-logo.png" alt="Pollito">
              </div>
              <div class="msg-body">
                <div class="msg-sender">
                  <span class="sender-name">Pollito</span>
                  <span class="app-tag">APP</span>
                  <span class="msg-time">3:05 PM</span>
                </div>

                <div style="font-size:15px;line-height:1.5;color:var(--slack-bright);">
                  <span class="mention">@sarah</span> would like your vote on <strong>Where should we host the Q4 Team Retro?</strong> in <span class="mention">#team-retros</span>.
                </div>

                <div class="dm-Jump-box">
                  <div>
                    <div style="font-size:14px;font-weight:700;color:var(--slack-bright);">Where should we host the Q4 Team Retro?</div>
                    <div style="font-size:12.5px;color:var(--slack-muted);">Quorum target: 75% (8/12 members) • Anonymous ballot</div>
                  </div>
                  <div class="bk-btn primary">Jump to poll →</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

// ---------------------------------------------------------------------------
// SLIDE 6: App Home Command Center, Templates & CSV Export
// ---------------------------------------------------------------------------
const slide6Html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  ${sharedCss}
  .home-tabs {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 0 24px;
    background: #141619;
    border-bottom: 1px solid var(--slack-border);
    font-size: 13.5px;
    font-weight: 600;
    color: var(--slack-muted);
  }
  .home-tab {
    padding: 10px 4px;
    border-bottom: 2px solid transparent;
  }
  .home-tab.active {
    color: var(--slack-bright);
    border-bottom-color: #10b981;
  }
  .home-body {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .home-greeting {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  .kpi-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .kpi-val {
    font-family: 'Raleway', sans-serif;
    font-size: 24px;
    font-weight: 800;
    color: var(--slack-bright);
  }
  .kpi-label {
    font-size: 12px;
    color: var(--slack-muted);
    font-weight: 500;
  }
  .section-head {
    font-size: 14px;
    font-weight: 800;
    color: var(--slack-bright);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .row-card {
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    padding: 11px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .suit-mascot-row {
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 16px;
    padding: 14px 18px;
    margin-top: auto;
  }
  .suit-mascot-row img {
    width: 68px;
    height: 68px;
    border-radius: 14px;
    object-fit: cover;
  }
</style>
</head>
<body>
  <div class="canvas">
    <div class="stage">
      <div class="copy-col">
        <div class="copy-top">
          <div class="brand-row">
            <div class="brand-badge">
              <img src="file://${ROOT}/public/assets/plates/pollito-nav-logo.png" alt="Pollito">
              <span>Pollito</span>
            </div>
            <span class="slide-num">06 / 06</span>
          </div>
          <span class="slide-pill">App Home Command Center</span>
          <h1 class="headline">Analytics, templates &amp; CSV in <span class="accent-purple">App Home.</span></h1>
          <p class="subtitle">
            Manage every poll without leaving Slack. Launch recurring team templates in one click, configure workspace defaults, and export CSV reports.
          </p>

          <div class="feature-chips">
            <div class="chip-row">
              <div class="chip-icon">${svgIcons.chart}</div>
              <div class="chip-text">
                <div class="chip-title">30-Day Participation Telemetry</div>
                <div class="chip-desc">Track quorum rates, turnout percentages, and winning outcomes.</div>
              </div>
            </div>
            <div class="chip-row">
              <div class="chip-icon amber">${svgIcons.layers}</div>
              <div class="chip-text">
                <div class="chip-title">Shared Workspace Templates</div>
                <div class="chip-desc">Save standup, retro, and RFC questions with preset quorum rules.</div>
              </div>
            </div>
          </div>
        </div>

        <div class="suit-mascot-row">
          <img src="file://${ROOT}/assets/pollito-avatar-suit-bust-1024.png" alt="Pollito Manager">
          <div>
            <div style="font-size:15px;font-weight:700;color:#f8fafc;">Workspace Governance Built In</div>
            <div style="font-size:13px;color:#94a3b8;">Configure default privacy, quorum targets, Pollito managers, and EN/ES localization.</div>
          </div>
        </div>
      </div>

      <div class="visual-col">
        <div class="slack-window">
          <div class="slack-topbar" style="border-bottom:none;padding-bottom:8px;">
            <div class="channel-title">
              <div class="window-dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></div>
              <img src="file://${ROOT}/public/assets/plates/pollito-nav-logo.png" alt="" style="width:22px;height:22px;margin-left:10px;border-radius:5px;">
              <span>Pollito</span>
              <span class="app-tag">APP</span>
            </div>
            <span class="status-pill green">EN / ES Bilingual</span>
          </div>

          <div class="home-tabs">
            <div class="home-tab active">Home</div>
            <div class="home-tab">Messages</div>
            <div class="home-tab">About</div>
          </div>

          <div class="home-body">
            <div class="home-greeting">
              <div style="font-size:14.5px;color:var(--slack-text);">
                Hi, <span class="mention">@sarah</span>. Team polls, consensus thresholds, and results in one place.
              </div>
            </div>

            <div class="bk-actions" style="margin-top:0;flex-wrap:wrap;">
              <div class="bk-btn primary">Launch new poll</div>
              <div class="bk-btn">Results and analytics</div>
              <div class="bk-btn">Templates</div>
              <div class="bk-btn">Settings</div>
              <div class="bk-btn">Export CSV</div>
            </div>

            <div class="bk-divider"></div>

            <div class="kpi-grid">
              <div class="kpi-card">
                <div class="kpi-val" style="color:#34d399;">3</div>
                <div class="kpi-label">Active polls</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-val" style="color:#fbbf24;">28</div>
                <div class="kpi-label">Quorums reached</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-val">34</div>
                <div class="kpi-label">Closed polls</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-val" style="color:#a78bfa;">86%</div>
                <div class="kpi-label">Average participation</div>
              </div>
            </div>

            <div class="section-head">
              <span>Quick Templates</span>
              <span style="font-size:12px;color:var(--slack-muted);font-weight:500;text-transform:none;">Launch in 1 click</span>
            </div>

            <div class="row-card">
              <div>
                <div style="font-size:14px;font-weight:700;color:var(--slack-bright);">Sprint Retro Confidence Pulse • <span style="color:#a78bfa;">Shared</span></div>
                <div style="font-size:12.5px;color:var(--slack-muted);">3 options • Anonymous • 80% quorum target</div>
              </div>
              <div class="bk-btn primary">Launch poll</div>
            </div>

            <div class="section-head" style="margin-top:2px;">
              <span>Recent Polls</span>
              <span style="font-size:12px;color:var(--slack-muted);font-weight:500;text-transform:none;">Showing latest workspace activity</span>
            </div>

            <div class="row-card">
              <div>
                <div style="font-size:14px;font-weight:700;color:var(--slack-bright);">Which queue engine should power the webhook worker?</div>
                <div style="font-size:12.5px;color:var(--slack-muted);">
                  <span class="mention">#eng-architecture</span> • 9 votes • 🎉 Quorum reached • 🏆 Winner: <strong>BullMQ + Redis Streams</strong> (6)
                </div>
              </div>
              <div class="bk-btn">View results</div>
            </div>

            <div class="row-card">
              <div>
                <div style="font-size:14px;font-weight:700;color:var(--slack-bright);">Where should we host the Q4 Team Retro?</div>
                <div style="font-size:12.5px;color:var(--slack-muted);">
                  <span class="mention">#team-retros</span> • 8 votes • Active • You created this
                </div>
              </div>
              <div class="bk-btn">View results</div>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

const slides = [
  { name: '01-live-quorum-polls', html: slide1Html },
  { name: '02-quorum-auto-close', html: slide2Html },
  { name: '03-create-poll-modal', html: slide3Html },
  { name: '04-anonymous-secret-ballot', html: slide4Html },
  { name: '05-smart-nudges', html: slide5Html },
  { name: '06-app-home-analytics', html: slide6Html },
];

for (const slide of slides) {
  const filePath = path.join(OUT_HTML_DIR, `${slide.name}.html`);
  fs.writeFileSync(filePath, slide.html, 'utf8');
}
console.log(`Generated ${slides.length} HTML templates in ${OUT_HTML_DIR}`);
