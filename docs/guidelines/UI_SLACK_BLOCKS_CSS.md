# UI, Block Kit & Styling Standards

This document establishes the Golden Rules for user interface design across Slack surfaces (App Home, Modals, In-Channel Poll Messages) and companion web interfaces.

---

## 1. The Atmos UI Philosophy in Slack

Slack Block Kit does not use standard CSS stylesheets, but it demands the exact same visual discipline:

### Core Principles
1. **Visual Hierarchy**: Every message must have a single primary focal point (the question and voting options).
2. **Deterministic Layouts**: Information must fit neatly without awkward wrapping across desktop, tablet, and mobile Slack clients.
3. **Semantic Status Indicators & Mascot Micro-Expressions**:
   - `🐣 / 🧐 ACTIVE`: Poll open and awaiting quorum or votes.
   - `⏰ EXPIRING SOON`: Timebox ending or approaching deadline.
   - `🎉 QUORUM REACHED`: Closed automatically upon reaching participation threshold.
   - `🏁 CLOSED`: Concluded poll with final results.

---

## 2. In-Channel Poll Message Standards

The live poll card (`src/slack/ui/views/pollMessage.ts`) updates in-place upon vote events and quorum transitions. Follow these strict constraints:

1. **In-Place Updates Only**: Never spam the channel with new messages. Update the existing message `ts` via `chat.update`.
2. **Deterministic ASCII Progress Bar**:
   - Fixed length: 10 blocks (`█████░░░░░ 50%`).
   - Clean characters: `█` for votes, `░` for remaining. Built deterministically by `progressBar.ts`.
3. **Context Block Telemetry**:
   - Show status, anonymity mode (🔒 Anonymous ballot or 👥 Public), and quorum target.
4. **Mascot Micro-Expressions**:
   - Reactive status icons: `🐣` (new), `🧐` (waiting for quorum), `🎉` (consensus reached), `⏰` (closed/expired).
5. **Strict Anonymity Preservation**:
   - Never render user mentions (`<@voterId>`) or voter identities on anonymous polls, even if publicVotes are supplied.

---

## 3. Web & CSS Standards (Companion Dashboards)

When authoring web companion interfaces, landing pages, or SVG telemetry widgets:

### Design Tokens & Brand System
All colors, typography, and radiuses derive from the canonical **[Product Brief](../../pollito_product_brief.md)** and **[PRODUCT.md](../../PRODUCT.md)**:
- Canvas ground: `--bg-base` (`#F8FAFC` or `#FFFFFF`)
- Card surfaces: `--bg-surface` (`#FFFFFF`, `#0F172A`)
- Primary brand accent: `--accent-yellow` (`#FBBF24`, `#F59E0B`)
- Status indicators: `--status-active` (`#0284C7`), `--status-success` (`#16A34A`), `--status-closed` (`#64748B`)
- Typography: Plus Jakarta Sans for UI headers, JetBrains Mono / SF Mono for telemetry bars.

### Forbidden
- `!important` declarations.
- Magic pixel values: All margins, paddings, colors, and border-radii must come from design tokens.
- Generic non-semantic classes (`.box`, `.red`, `.container`).
- Deeply nested selectors (`.card .body .title span`).

### Allowed & Required
- CSS Modules (`*.module.css`) or scoped stylesheets (`site.css`).
- Atmos UI design tokens (`--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full`).
- High contrast accessibility (`wcag-aa` compliance, minimum 4.5:1 text contrast).
