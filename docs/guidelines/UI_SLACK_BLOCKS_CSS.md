# UI, Block Kit & Styling Standards

This document establishes the Golden Rules for user interface design across Slack surfaces (App Home, Modals, In-Channel Tracker Blocks) and companion web interfaces.

---

## 1. The Atmos UI Philosophy in Slack

Slack Block Kit does not use standard CSS stylesheets, but it demands the exact same visual discipline:

### Core Principles
1. **Visual Hierarchy**: Every message must have a single primary focal point (the active timer and module status).
2. **Deterministic Layouts**: Information must fit neatly without awkward wrapping across desktop, tablet, and mobile Slack clients.
3. **Semantic Status Indicators**:
   - `🟢 ACTIVE / IN PROGRESS`: Current phase within time budget.
   - `🟡 WARNING / PACING ALERT`: Approaching transition boundary (last 2 minutes of module).
   - `🔴 OVERTIME`: Session has exceeded scheduled duration.
   - `🏁 CONCLUDED`: Clean exit state.

---

## 2. In-Channel Tracker Block Standards

The live meeting tracker (`src/slack/ui/trackerBlock.ts`) updates every 30 seconds in-place. Follow these strict constraints:

1. **In-Place Updates Only**: Never spam the channel with new messages. Update the existing message `ts` via `chat.update`.
2. **ASCII/Unicode Progress Bar**:
   - Fixed length: 16 blocks (`[████████░░░░░░░░] 50%`).
   - Clean characters: `█` for elapsed, `░` for remaining. Avoid jagged emojis that break alignment across different fonts.
3. **Two-Column Context**:
   - Left field: Current speaker and active module.
   - Right field: Remaining module minutes and total session elapsed.
4. **Non-Intrusive Exit Ramp**:
   - Post to the thread or update the block once at 100% elapsed time to free attendees with other commitments.

---

## 3. Web & CSS Standards (Companion Dashboards)

When authoring web companion interfaces, landing pages, or SVG telemetry widgets:

### Design Tokens & Brand System
All colors, typography, and radiuses must strictly derive from the canonical **[Brand Identity & System Guide](../BRAND.md)**:
- Canvas ground: `--bg-base` (`#080B11`)
- Glass surfaces: `--bg-surface` (`#0F172A`, `rgba(15, 23, 42, 0.72)`)
- Flight telemetry: `--accent-cyan` (`#06B6D4`)
- Visor warnings: `--accent-amber` (`#F59E0B`)
- Action buttons: `--accent-orange` (`#F97316`)
- Typography: Display/UI with Plus Jakarta Sans, tabular telemetry with JetBrains Mono.

### Forbidden
- `!important` declarations.
- Magic pixel values: All margins, paddings, colors, and border-radii must come from design tokens.
- Generic non-semantic classes (`.box`, `.red`, `.container`).
- Deeply nested selectors (`.card .body .title span`).

### Allowed & Required
- CSS Modules (`*.module.css`) or scoped stylesheets (`site.css`).
- Atmos UI design tokens (`--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full`).
- High contrast accessibility (`wcag-aa` compliance, minimum 4.5:1 text contrast).
