# Central Agentic Guidelines — Pollito

This document serves as the central operating manual and source of truth for all autonomous coding agents, AI pair programmers, and contributors working on Pollito.

---

## 📚 Core Project Knowledge Base

Any agent operating in this codebase must reference and respect the following core documents before planning or implementing changes:

1. **[Product Capabilities & Vision](PRODUCT.md)** (`PRODUCT.md` & `pollito_product_brief.md`):
   * **Purpose**: Product definition, positioning vs Simple Poll/Polly, double-urn secret ballots, quorum detection, App Home analytics, and pricing model (Freemium base / 100% Free during launch with a planned $15/month flat-rate Pro tier per workspace).
   * **Rule**: Align feature copy, modal fields, and user experience with these target personas (Tech Leads, Scrum Masters, Remote Engineering Teams).
2. **[Master Knowledge & Skills Index](docs/KNOWLEDGE_INDEX.md)** (`docs/KNOWLEDGE_INDEX.md`):
   * **Purpose**: Central navigation index to all tracked skills and engineering guidelines in Pollito.
3. **[Engineering Guidelines](docs/guidelines/)** (`docs/guidelines/`):
   * **Coding & Architecture**: [`docs/guidelines/CODING.md`](docs/guidelines/CODING.md)
   * **UI & Block Kit Styling**: [`docs/guidelines/UI_SLACK_BLOCKS_CSS.md`](docs/guidelines/UI_SLACK_BLOCKS_CSS.md)
   * **Editorial Standards & Anti-Slop**: [`docs/guidelines/EDITORIAL_STANDARDS.md`](docs/guidelines/EDITORIAL_STANDARDS.md)
   * **Security & Token Isolation**: [`docs/guidelines/SECURITY.md`](docs/guidelines/SECURITY.md)
   * **Definition of Done (DoD)**: [`docs/guidelines/DEFINITION_OF_DONE.md`](docs/guidelines/DEFINITION_OF_DONE.md)
   * **Release Process & Versioning**: [`docs/guidelines/RELEASE_PROCESS.md`](docs/guidelines/RELEASE_PROCESS.md)
   * **Subagent Orchestration & Model Governance**: [`docs/guidelines/SUBAGENT_ORCHESTRATION.md`](docs/guidelines/SUBAGENT_ORCHESTRATION.md)
4. **[Skills Suite](.agents/skills/)** (`.agents/skills/`):
   * Tracked skills for automated execution: `slack-block-kit`, `slack-security-auth`, `slack-bolt-architecture`, `slack-ai-agents`, `slack-app-distribution`, `competitor-alternatives`, `copywriting`, `copy-editing`, `text-humanizer`, `ogilvy`, `content-strategy`, `proofreading`, `paragraph-structure`.

---

## ⚡ Mandatory Agent Protocols

### 1. Invariants of Voting & Privacy Architecture
* **Double-Urn Secret Ballots**: In anonymous polls, never link a user ID directly to their selected vote choice in the database. Use HKDF-SHA256 salted tokens or an unlinked vote pool to ensure mathematical anonymity while preventing duplicate voting.
* **Deterministic Quorum Logic**: Quorum thresholds (50%, 66%, 75%, 80%, 100%) calculate participation as `(unique_voters / channel_members)`. When quorum is met, the poll automatically transitions to `CLOSED` and notifies the thread without revealing identities.
* **Smart Nudges**: Nudges send ephemeral messages or DMs strictly to non-voters. Never leak who has already voted.
* **Clock-Free UI**: Slack Block Kit builders in `src/slack/ui/` never read the system clock directly. Pass timestamps and computed states into builders so that rendering is 100% deterministic and pure.
* **In-Place Updates**: Never flood channels. Use `chat.update` with the stored message timestamp `ts`.

### 2. User-Facing Copy & Anti-AI Slop Protocol
* **MANDATORY for every draft of user-facing prose**: Slack Block Kit messages, modal views, button labels, toasts, bot notifications, landing page (`public/index.html`), and documentation.
* **Proactive Execution**: Run `no-ai-slop` and `text-humanizer` proactively.
* **Zero AI-Slop**: Ban binary contrasts (*"not X, but Y"*), colon reveals, corporate buzzwords, and em-dash crutches in UI copy.
* **Language Rules**:
  * **Slack In-App Elements**: **100% Strict English Policy** for all Slack Block Kit components, modals, and bot notifications.
  * **Spanish Documentation & Marketing**: **100% Tuteo** (`tú`/`tu`). Never voseo.

### 3. Architecture & Code Boundaries
* **Single Responsibility**:
  * `src/slack/ui/`: Pure Block Kit view builders (no database access, no side effects).
  * `src/slack/handlers/`: Bolt action, command, and event dispatchers.
  * `src/services/`: Domain business logic, vote calculations, quorum detection, Prisma queries.
  * `src/workers/`: Background workers for auto-closing timers and nudges.
* **Resilience**: Never crash the process. Wrap Slack API calls in localized `try/catch` blocks.
* **Strict Types**: Use runtime Zod validation for external payloads and TypeScript strict types.

### 4. Verification Protocol
* Always run `pnpm test` and `pnpm build` locally before completing tasks.
* Ensure all tests pass with 0 failures and the working tree is clean.

### 5. Specialist Subagent Delegation Matrix: `slack_buddy`
* **Trigger**: Any architectural design, implementation, refactor, or debugging involving:
  - Slack Block Kit surfaces, interactive modals, or App Home views (`src/slack/ui/`).
  - Bolt event listeners, action dispatchers, 3s `ack()` timeouts, or rate limiting (`src/slack/handlers/`).
  - Request signature verification, token rotation, OAuth 2.0 multi-workspace installation, or Enterprise Grid security.
  - Slack AI agents, assistant containers (`assistant_thread_started`), or Slack MCP server integrations.
* **Action**: Delegate the task to subagent `slack_buddy` via `invoke_subagent` (`TypeName: "slack_buddy"`). `slack_buddy` possesses deep mastery over the full suite of Slack skills and internal technical documentation.

### 6. Specialist Subagent Delegation Matrix: `wordsmith`
* **Trigger**: Any editorial review, copy generation, anti-AI slop audit, or version communication task involving:
  - Drafting, rewriting, or auditing user-facing copy (landing page `public/index.html`, modal text, bot messages, documentation).
  - Eliminating synthetic clichés, binary contrasts, throat-clearing, and robotic phrasing.
  - Formulating atomic Conventional Commits (`feat:`, `fix:`, `refactor:`) with high-value technical context.
  - Curating releases, writing changelogs under [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and aligning SemVer tags.
  - Drafting competitor comparison pages or sales enablement narratives (*Pollito vs Simple Poll*, *Pollito vs Polly*).
* **Action**: Delegate the task to subagent `wordsmith` via `invoke_subagent` (`TypeName: "wordsmith"`). `wordsmith` has access to the full writing and anti-slop skills suite (`no-ai-slop`, `text-humanizer`, `copywriting`, `copy-editing`, `proofreading`, `paragraph-structure`, `ogilvy`, `competitor-alternatives`).

### 7. Subagent Session Hygiene & Model Governance
* **Reference**: [`docs/guidelines/SUBAGENT_ORCHESTRATION.md`](docs/guidelines/SUBAGENT_ORCHESTRATION.md)
* **1 Task = 1 Fresh Session**: Spawn a fresh subagent per task (`invoke_subagent`) and terminate it immediately upon completion (`manage_subagents(Action: "kill")`) to prevent context saturation.
* **Mandatory Prompt Directives**: Embed the task specification directly in the subagent prompt, forbid reading closed phase files or planning docs, and require parallel `view_file` batching (5–8 files per turn).
* **Model Selection (`inherit` vs. `flash`)**:
  - Use `Model: "inherit"` for complex TypeScript architecture, cryptography, Slack Bolt handlers, Block Kit UI views, and unit test suites.
  - Use `Model: "flash"` (strictly paired with parallel read and scope-lock directives) for high-volume mechanical updates across scripts, documentation, and HTML files.
