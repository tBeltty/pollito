# Pollito Quality, Security & Product Compliance — Plan of Record

> **Status:** active. This document holds the *what* and the *why*. Nobody implements
> from this file. The executable instructions live in `execution-guide.md`; evidence
> goes in `compliance-log.md`.

**Target version / milestone:** `v0.2.0`

---

## 1. Why this exists

Pollito (`pollito.tbelt.online`) is a native Slack application for team consensus with double-urn secret ballots, live quorum auto-closing, deadline timers, smart nudges, and an in-Slack App Home analytical center. An independent architectural and security audit of commit `20d416b` revealed that while the basic happy path compiles and passes 26 unit tests, critical security invariants, background workers, OAuth flows, and advertised product features are either broken at runtime or unimplemented.

## 2. What the audit of the current system found

| Finding | Evidence |
|---|---|
| **F1 (CRITICAL):** `PollTimerWorker` fails with `invalid_auth` on every auto-upserted workspace because `PollService.createPoll` stores literal `'bot_token_managed'` in `Workspace.botToken`, and `PollTimerWorker` passes `token: poll.workspace?.botToken \|\| undefined` to Slack Web API. | `src/services/pollService.ts:66`, `src/workers/pollTimerWorker.ts:61,75` |
| **F2 (CRITICAL):** Double-urn secret ballots are trivially reversible by any database reader: `workspace_settings.anonymousSalt` is stored in plaintext in the same SQLite DB, and `anonymous_ballots` shares millisecond-identical `createdAt` timestamps and sequential insertion order with `poll_participations`. | `src/services/pollService.ts:140-166`, `prisma/schema.prisma:84-106` |
| **F3 (CRITICAL):** `/slack/oauth_redirect` is a static HTML stub that ignores `code` and `state`, performs no `oauth.v2.access` exchange, and never encrypts `botToken` with AES-256-GCM despite claims in `public/privacy.html:116`. | `src/index.ts:31-106`, `public/privacy.html:116` |
| **F4 (CRITICAL):** Core promised mechanics have zero implementation in `src/`: Smart Nudges (`NudgeLog` in `schema.prisma:108` is unused), `/pollito close` (`support.html:59` is unhandled in `commands.ts`), quorum thread announcements (`actions.ts:37-46` never posts to `thread_ts`), and public voter visibility (`pollMessage.ts:73-107` never reads `publicVotes`). | `src/slack/handlers/actions.ts`, `src/slack/handlers/commands.ts`, `src/slack/ui/views/pollMessage.ts` |
| **F5 (HIGH):** SQLite WAL mode and `busy_timeout` are never enabled in `src/db/prisma.ts`, and running `pnpm test` wipes the local `.env` database because `vitest.config.ts` does not exist. | `src/db/prisma.ts:1-16`, `tests/services/pollService.test.ts:9-17` |
| **F6 (HIGH):** `eligibleVoterCount` counts `@Pollito` and other bots via `conversations.members`, making 100% quorum impossible to reach. `UpdateQueue` uses an unbounded trailing debounce that starves UI updates under steady voting. | `src/slack/handlers/commands.ts:48-55`, `src/services/updateQueue.ts:20-43` |
| **F7 (HIGH):** `createPollModal.ts` allows 3,000-character questions while `pollMessage.ts:54` injects `poll.question` into a 150-char Slack `header` block, causing `invalid_blocks`. `pollMessage.ts:122` calls `new Date()` directly inside the pure UI layer. | `src/slack/ui/views/createPollModal.ts:50-61`, `src/slack/ui/views/pollMessage.ts:54,122` |
| **F8 (MEDIUM):** `docs/guidelines/*.md` contain copy-pasted references to `HuddlePace`, `Vector the Falcon`, `/pace`, and `huddlepace.com`. Blind-Secret scripts in `scripts/*.sh` pass secrets on the `sed` command line (`ps aux` exposure). | `docs/guidelines/CODING.md`, `scripts/setup-slack-secrets.sh:48` |

## 3. The decisions (settled — reopening one is a stop, not a choice)

### D1 — OAuth v2 Multi-Workspace + AES-256-GCM Token Encryption with Single-Workspace Fallback
Implement real OAuth v2 installation (`/slack/install` and `/slack/oauth_redirect`) encrypting `Workspace.botToken` at rest using `AES-256-GCM` derived from `APP_SECRET_SALT`. Provide an interactive Blind-Secret script (`scripts/setup-oauth-secrets.sh`) for `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`. When a workspace uses `ENV_MANAGED_TOKEN` (or single-workspace mode), fall back cleanly to `env.SLACK_BOT_TOKEN` so `PollTimerWorker` and handlers never send placeholder strings to Slack.

### D2 — True Cryptographic Double-Urn Isolation
Remove `createdAt` from `AnonymousBallot`, use random UUID primary keys, and derive voter tokens using `HMAC-SHA256(voterId:pollId, HKDF(env.APP_SECRET_SALT, workspaceSalt))`. Even a full dump of `pollito.db` cannot link `poll_participations` to `anonymous_ballots` by timestamp or by recomputing the HMAC without the server-only secret `APP_SECRET_SALT`.

### D3 — Full Delivery of Core Promised Mechanics
Deliver public vote `<@user>` rendering, multiple-choice voting (`allowMultipleVotes`), immediate quorum thread announcements, manual poll closing (`/pollito close` and UI buttons), Smart Nudges via DM strictly to non-voters (`NudgeLog` + `/pollito nudge` + UI buttons), and App Home aggregate analytics, Quick Templates, and CSV export.

### D4 — Canonical Pricing Positioning
Unify documentation around a **Freemium base (100% free during current launch)** with a planned **$15/month flat-rate Pro tier per workspace** (and higher enterprise tiers for advanced governance), eliminating contradictions between `PRODUCT.md`, `AGENTS.md`, and `public/`.

## 4. What this deliberately does not do

- **Dot Voting (seed allocation)** and **Time-Slot Grid (Doodle matrix)** from `pollito_product_brief.md` are deferred to a future minor release (`v0.3.0+`) per user decision A2.
- Does not replace SQLite with PostgreSQL; instead, properly configures SQLite in `WAL` mode with `busy_timeout = 5000` and transaction retry logic.

## 5. Phases

| Phase | Delivers | Risk |
|---|---|---|
| **Phase 1** | AES-256-GCM crypto, HKDF double-urn isolation, `AnonymousBallot` de-correlation, SQLite WAL + busy retry, `vitest.config.ts`, `PollTimerWorker` auth fix, `getNonVoters` & multi-choice service logic. | High (DB schema & cryptography) |
| **Phase 2** | Real OAuth v2 (`/slack/install` & `/slack/oauth_redirect`), Bolt retry deduplication & error boundaries, bounded `UpdateQueue` throttle, Quorum thread notices, `/pollito close`, `/pollito nudge` & Smart Nudge DMs, bot-filtered `eligibleVoterCount`. | High (Slack API & concurrency) |
| **Phase 3** | Clock-free `pollMessage.ts`, public voter `<@user>` mentions, mascot reactive micro-expressions (`🐣`, `🧐`, `🎉`, `⏰`), modal input bounds (`number_input`, `max_length`), App Home real metrics, Quick Templates & CSV export. | Medium (Block Kit constraints) |
| **Phase 4** | Blind-Secret script hardening (zero `sed` cmdline leaks + `setup-oauth-secrets.sh`), cleanup of `HuddlePace` references in `docs/guidelines/`, pricing & OAuth scope alignment across `public/`, and SemVer bump to `0.2.0`. | Low (Ops & documentation) |

## 6. Request traceability

| Origin request | Where it lands |
|---|---|
| Audit tech stack, code quality, and architecture without condescension | `implementation_plan.md`, `audit/plan-of-record.md` |
| Fix everything needed so Pollito fulfills all its promises | Phases 1, 2, and 3 (`P1-T1` through `P3-T1`) |
| Request special tokens securely without improvising (`Blind-Secret Protocol`) | Decision D1, Phase 2 (`P2-T1`), Phase 4 (`P4-T1`: `scripts/setup-oauth-secrets.sh`) |
| Align `OPERATIONS.md`, `PRODUCT.md`, `AGENTS.md`, and `docs/guidelines/` | Phase 4 (`P4-T1`, `P4-G1`) |

## 7. Standards this work is held to

- Central operating manual: [`AGENTS.md`](../AGENTS.md)
- Operations manual: [`OPERATIONS.md`](../OPERATIONS.md)
- Anti-AI Slop gate: [`tests/copy/antiSlop.test.ts`](../tests/copy/antiSlop.test.ts)
