# Pollito Quality, Security & Product Compliance — Execution Guide

> **You are the Executor.** The Auditor wrote this file and will re-run every gate
> independently. Read `plan-of-record.md` once for context, then work only from here.
> Report every task in `compliance-log.md`.

---

## Rules of engagement

1. **One task at a time, in order.** No batching. Do not start a phase whose
   predecessor is not marked `APPROVED` in the compliance log.
2. **Never invent a value the codebase declares.** Read it. Needing to ask for one
   means a file was skipped.
3. **Never guess a cause. Observe it.** Read the log, run the query, print the value.
4. **Verification is running the thing, not reading the code.** "I reviewed it and it
   looks correct" is reported as `FAILED`.
5. **Scope is the task text.** Unrelated problems go in *Observations*. Do not fix
   them.
6. **Stop and ask** when this document contradicts the code, when a task needs a
   decision this document does not make, or when a previously passing check starts
   failing for reasons unrelated to your change. If you resolve an ambiguity without
   stopping, log the decision. A decision in the plan of record is settled; a factual
   claim never is — if this document states something the code contradicts, the
   evidence outranks the order.
7. **When the system cannot do what a task asks, that is the deliverable.** Report it
   and stop. A task that ends in a well-argued finding is a success.
8. Project-specific rules that apply to every task — cited from their source:
   - **Zero AI Slop & Strict English in Slack UI / Tuteo in Spanish Docs**: Enforced by [`AGENTS.md`](../AGENTS.md) Section 2 and [`tests/copy/antiSlop.test.ts`](../tests/copy/antiSlop.test.ts).
   - **Blind-Secret Protocol**: Never log, print, or pass plaintext secrets in command arguments (`~/.gemini/config/rules/blind-secrets.md`).
   - **Quality Gate Before Commit**: `pnpm test && pnpm build` must pass with 0 errors ([`AGENTS.md`](../AGENTS.md) Section 4).
   - **Zero `Co-Authored-By` Trailers & SemVer Bump at Run Completion**: Confirmed by user decision A4.

## Reporting format

For each task, append to `compliance-log.md`:

```
### <TASK-ID> — DONE | BLOCKED | FAILED
**Changed:** <paths>
**Verify output:**
<pasted, literal, unedited command output>
**Observations:** <or "none">
**Decisions made without stopping:** <or "none">
```

A `DONE` with no pasted output is recorded as `FAILED`.

---

# Phase 1 — Cryptographic Double-Urn Isolation, SQLite WAL & Timer Auth

### P1-T1 — Implement AES-256-GCM encryption, HKDF voter token derivation, schema de-correlation, SQLite WAL initialization, and isolated Vitest config

**Goal:** Ensure `AnonymousBallot` records carry no `createdAt` timestamp correlation, voter tokens require both `APP_SECRET_SALT` and `workspaceSalt`, bot tokens can be encrypted/decrypted with `AES-256-GCM`, SQLite initializes in `WAL` mode with `busy_timeout = 5000`, and `pnpm test` uses an isolated test database.

**Files:**
- `src/utils/crypto.ts` (new)
- `prisma/schema.prisma`
- `src/db/prisma.ts`
- `vitest.config.ts` (new)
- `tests/setupEnv.ts` (new)

**Steps:**
1. Create `src/utils/crypto.ts` exporting:
   - `ENV_MANAGED_TOKEN = 'ENV_MANAGED_TOKEN'` constant.
   - `encryptToken(plainToken: string, masterSecret: string): string` using `aes-256-gcm` with a 12-byte random IV, 16-byte authTag, and a 32-byte key derived via `crypto.scryptSync(masterSecret, 'pollito-token-encryption-v1', 32)`. Format output as `enc:v1:<ivHex>:<tagHex>:<ciphertextHex>`.
   - `decryptToken(storedValue: string, masterSecret: string): string | null` that returns `null` if `storedValue === 'ENV_MANAGED_TOKEN'` or `'bot_token_managed'` or empty, decrypts `enc:v1:...` payloads, and if `storedValue.startsWith('xoxb-')` returns it for backwards compatibility in tests.
   - `deriveDoubleUrnVoterToken(voterId: string, pollId: string, workspaceSalt: string, masterSecret: string): string` that derives a 32-byte key via `crypto.hkdfSync('sha256', Buffer.from(masterSecret, 'utf8'), Buffer.from(workspaceSalt, 'utf8'), Buffer.from('pollito-double-urn-v1', 'utf8'), 32)` and returns `crypto.createHmac('sha256', Buffer.from(derivedKey)).update(`${voterId}:${pollId}`).digest('hex')`.
2. Update `prisma/schema.prisma`:
   - Add `allowMultipleVotes Boolean @default(false)` to `model Poll`.
   - Remove `createdAt DateTime @default(now())` from `model AnonymousBallot` and change `id String @id @default(cuid())` to `id String @id @default(uuid())` so ballots have zero timestamp or monotonic counter correlation with `PollParticipation`.
3. Update `src/db/prisma.ts`:
   - Export `async function initSqlitePragmas()` that executes `await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;')`, `await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;')`, and `await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;')`.
4. Create `vitest.config.ts` and `tests/setupEnv.ts` so Vitest always sets `NODE_ENV=test`, `DATABASE_URL="file:./test.db"`, and unit-test placeholder values for `APP_SECRET_SALT`, `SLACK_SIGNING_SECRET`, and `SLACK_BOT_TOKEN` before any test module loads `dotenv`, and update `package.json` `"test"` script to `"prisma db push --skip-generate --schema prisma/schema.prisma && vitest run"` with `DATABASE_URL="file:./test.db"` in `tests/setupEnv.ts` (or run `prisma db push` in globalSetup).
5. Run `pnpm db:generate` and `DATABASE_URL="file:./test.db" pnpm db:push`.

**Expected failure to avoid:** Do not leave `createdAt` on `AnonymousBallot` in `prisma/schema.prisma`, and do not allow `dotenv.config()` in `src/config/env.ts` to override the test `DATABASE_URL` set by `tests/setupEnv.ts`.

**Verify:**
```bash
pnpm db:generate && DATABASE_URL="file:./test.db" pnpm db:push && npx tsc --noEmit
```

**Report:** `P1-T1`

---

### P1-T2 — Upgrade `PollService` (double-urn HKDF, multi-choice, SQLite retry, `getNonVoters`) and fix `PollTimerWorker` token authentication

**Goal:** Make `PollService` use HKDF-backed voter tokens, support both single-choice and multiple-choice polls, retry on transient SQLite lock errors, compute non-voters accurately, and ensure `PollTimerWorker` authenticates properly instead of sending `'bot_token_managed'`.

**Files:**
- `src/services/pollService.ts`
- `src/workers/pollTimerWorker.ts`
- `tests/services/pollService.test.ts`

**Steps:**
1. In `src/services/pollService.ts`:
   - Import `deriveDoubleUrnVoterToken`, `ENV_MANAGED_TOKEN`, `encryptToken`, `decryptToken` from `../utils/crypto.js` and `env` from `../config/env.js`.
   - Update `PollService.generateVoterToken(voterId: string, pollId: string, workspaceSalt: string, masterSecret = env.APP_SECRET_SALT)` to call `deriveDoubleUrnVoterToken(voterId, pollId, workspaceSalt, masterSecret)`.
   - In `createPoll`: accept `allowMultipleVotes?: boolean`, default to `false`. In the `workspace.upsert`, set `botToken: ENV_MANAGED_TOKEN`.
   - In `castVote`:
     - Wrap the `prisma.$transaction` call in a retry helper (up to 3 attempts with 50–150ms backoff if error code is `P2034` or message includes `SQLITE_BUSY` / `database is locked`).
     - Verify that `optionId` actually belongs to `poll.options` (`if (!poll.options.some((o) => o.id === optionId)) throw new Error('Invalid poll option')`).
     - Support `poll.allowMultipleVotes`:
       - When `poll.allowMultipleVotes === false`: keep strict single-vote behavior (if `existingParticipation` exists, throw `'You have already voted in this poll'`).
       - When `poll.allowMultipleVotes === true`: check if the user already voted for this specific `optionId` (via `publicVote` or `anonymousBallot` with `voterToken`). If they already voted for this `optionId`, throw `'You have already voted for this option'`. Otherwise record the ballot for `optionId`, increment `pollOption.voteCount`, and `upsert` `pollParticipation` so `poll.participations` counts unique voters for quorum calculation!
   - Add `static async getNonVoters(pollId: string, eligibleChannelMemberIds: string[]): Promise<string[]>`:
     - Fetch `pollParticipation` records for `pollId`.
     - Return `eligibleChannelMemberIds.filter((uid) => !votedSet.has(uid))`.
   - Add `static async resolveWorkspaceBotToken(workspaceId: string): Promise<string>`:
     - Look up `workspace.botToken` in Prisma; call `decryptToken(workspace.botToken, env.APP_SECRET_SALT)` and fall back to `env.SLACK_BOT_TOKEN`.
2. In `src/workers/pollTimerWorker.ts`:
   - Replace `token: poll.workspace?.botToken || undefined` in both `chat.update` and `chat.postMessage` with `const token = decryptToken(poll.workspace?.botToken ?? '', env.APP_SECRET_SALT) ?? env.SLACK_BOT_TOKEN;`.
3. In `tests/services/pollService.test.ts`:
   - Add tests verifying:
     - `AnonymousBallot` rows have no `createdAt` property and cannot be linked to `PollParticipation` without `APP_SECRET_SALT`.
     - Encryption/decryption round-trip of `xoxb-` tokens with `AES-256-GCM` and fallback to `env.SLACK_BOT_TOKEN` when stored value is `ENV_MANAGED_TOKEN` or `'bot_token_managed'`.
     - Multi-choice voting (`allowMultipleVotes: true`) allows a user to vote for 2 distinct options while counting them as 1 unique participant toward quorum, and rejects voting twice for the same option.
     - `getNonVoters` returns only channel members who have not voted and never leaks ballot choices.
     - `PollTimerWorker.checkAndCloseExpiredPolls` calls `chat.update` and `chat.postMessage` with a valid `xoxb-` token, never `'bot_token_managed'`.

**Expected failure to avoid:** In multi-choice polls (`allowMultipleVotes: true`), quorum is measured by unique voters (`poll_participations` count), not total option clicks (`sum(voteCount)`). Make sure `totalVotes` for quorum uses unique participants.

**Verify:**
```bash
pnpm test && pnpm build
```

**Report:** `P1-T2`

---

### P1-G1 — Gate: Cryptographic Double-Urn Isolation & Timer Worker Token Integrity

**Proven by:** `pnpm test` verifying that `deriveDoubleUrnVoterToken` requires `APP_SECRET_SALT`, `AnonymousBallot` has no `createdAt`, `getNonVoters` excludes voters, and `PollTimerWorker` never passes `'bot_token_managed'` to Slack Web API.

**Negative control:** Use `/Users/jhonatan/.local/bin/auditkit negcontrol` on `src/services/pollService.ts` to temporarily break the non-voter filter in `getNonVoters` (e.g., returning all `eligibleChannelMemberIds` unfiltered), verify `pnpm test` fails, restore, and verify `pnpm test` passes.

**Report:** `P1-G1`

---

# Phase 2 — Multi-Workspace OAuth v2, Bolt Resilience, Quorum Thread Notices, Manual Close & Smart Nudges

### P2-T1 — Implement OAuth v2 installation flow, event retry deduplication, bounded `UpdateQueue` throttle, graceful shutdown, and manifest event subscriptions

**Goal:** Support real multi-workspace OAuth v2 token exchange with AES-256-GCM storage, deduplicate Slack webhook retries, bound `UpdateQueue` wait times to 2,000ms with immediate flush support, cleanly shut down all resources on `SIGTERM`/`SIGINT`, and subscribe to `app_uninstalled` and `tokens_revoked`.

**Files:**
- `src/config/env.ts`
- `src/services/updateQueue.ts`
- `src/slack/handlers/events.ts`
- `src/index.ts`
- `manifest.json`
- `tests/services/updateQueue.test.ts` (new)

**Steps:**
1. In `src/config/env.ts`:
   - Add optional `SLACK_CLIENT_ID: z.string().optional()`, `SLACK_CLIENT_SECRET: z.string().optional()`, and `SLACK_STATE_SECRET: z.string().optional()` to `envSchema`.
2. In `src/services/updateQueue.ts`:
   - Upgrade `QueuedUpdate` to include `firstQueuedAt: number`.
   - Implement a bounded throttle in `scheduleUpdate`: if `Date.now() - existing.firstQueuedAt >= 2000` (`MAX_WAIT_MS`), flush immediately; otherwise debounce by `DEBOUNCE_MS = 800` capped at `firstQueuedAt + 2000`.
   - Add `static async flushNow(pollId: string, channelId: string, messageTs: string, client: WebClient): Promise<void>` that clears any pending timer for `pollId` and immediately awaits `this.flushUpdate(pollId, channelId, messageTs, client)`.
   - Add `static async flushAll(): Promise<void>` that clears all timers and awaits `flushUpdate` for every pending entry.
3. In `src/slack/handlers/events.ts`:
   - Add listener for `tokens_revoked`: mark affected workspace `isActive: false` and overwrite `botToken: ENV_MANAGED_TOKEN`.
4. In `src/index.ts`:
   - Call `await initSqlitePragmas()` inside `startServer()` before `app.start()`.
   - Register global `app.error(async (error) => { console.error('[Bolt Global Error]:', error); })`.
   - Register global Bolt middleware that checks `context.retryNum` (`X-Slack-Retry-Num`) and deduplicates `body.event_id` using an in-memory `Map<string, number>` (TTL 5 minutes) so retried events return early without double execution.
   - Add custom route `GET /slack/install`: if `env.SLACK_CLIENT_ID` is configured, generate a signed HMAC state token, set an `HttpOnly; Secure; SameSite=Lax` cookie, and 302-redirect to `https://slack.com/oauth/v2/authorize` with the exact scopes from `manifest.json`.
   - Upgrade `GET /slack/oauth_redirect`: parse `code` and `state` from `req.url`. If `code` is present and `env.SLACK_CLIENT_ID` + `env.SLACK_CLIENT_SECRET` are configured, verify `state` (when cookie present), call `app.client.oauth.v2.access({ client_id, client_secret, code })`, encrypt the returned `access_token` with `encryptToken(access_token, env.APP_SECRET_SALT)`, and `upsert` the `Workspace` and `WorkspaceSettings` in Prisma before rendering the HTML confirmation card. If `error` query param is present, render a clear OAuth cancellation page with HTTP 400.
   - Register an `authorize` function (or token resolution middleware) on `App` when in HTTP mode that resolves the workspace's decrypted `botToken` from Prisma (falling back to `env.SLACK_BOT_TOKEN`).
   - Update `SIGTERM` and `SIGINT` handlers to run `await UpdateQueue.flushAll()`, `pollTimerWorker.stop()`, `await app.stop()`, and `await prisma.$disconnect()`.
5. In `manifest.json`:
   - Add `"im:write"` to `oauth_config.scopes.bot`.
   - Add `"app_uninstalled"` and `"tokens_revoked"` to `settings.event_subscriptions.bot_events`.
6. Create `tests/services/updateQueue.test.ts` testing `scheduleUpdate`, `flushNow`, and `flushAll`.

**Expected failure to avoid:** Do not break existing tests that import `app` from `src/index.ts` when `SLACK_CLIENT_ID` is not set in `.env`. Keep single-workspace fallback seamless when `SLACK_CLIENT_ID` is undefined.

**Verify:**
```bash
pnpm test && pnpm build
```

**Report:** `P2-T1`

---

### P2-T2 — Implement Quorum thread announcements, `/pollito close`, `/pollito nudge`, UI action handlers (`poll_close_click`, `poll_nudge_click`), bot-filtered `eligibleVoterCount`, and Zod modal validation

**Goal:** Connect all promised poll lifecycle actions (quorum thread summary, manual close via command and UI button, Smart Nudges strictly to non-voters with `NudgeLog` cooldown, accurate human member count excluding bots, and Zod modal input validation).

**Files:**
- `src/slack/utils/channelMembers.ts` (new)
- `src/slack/handlers/actions.ts`
- `src/slack/handlers/commands.ts`
- `src/slack/handlers/views.ts`
- `tests/slack/handlers.test.ts` (new)

**Steps:**
1. Create `src/slack/utils/channelMembers.ts`:
   - Export `async function getEligibleChannelMembers(client: WebClient, channelId: string): Promise<string[]>`:
     - Call `client.auth.test()` (caching `botUserId` per token/client) to know Pollito's own user ID.
     - Paginate `client.conversations.members({ channel: channelId, limit: 200 })` (up to 5 pages) and exclude `botUserId` from the returned array.
2. In `src/slack/handlers/actions.ts`:
   - In `app.action(/^vote_option_/)`:
     - When `result.quorumReached === true`:
       - Call `await UpdateQueue.flushNow(pollId, channelId, messageTs, client)` immediately instead of `scheduleUpdate`.
       - Compute the winning option text and post a thread announcement via `client.chat.postMessage({ channel: channelId, thread_ts: messageTs, text: ... })` announcing that the quorum threshold was reached and stating the winning option and vote count.
     - Wrap the fallback `postEphemeral` inside the `catch` block in its own `try/catch`.
   - Add `app.action(/^poll_close_click/)`:
     - Parse `pollId` from button `value`.
     - Call `PollService.closePoll(pollId, blockAction.user.id, 'CLOSED')`.
     - Update the channel message via `UpdateQueue.flushNow(pollId, poll.channelId, poll.messageTs, client)` and post a thread summary (`thread_ts: poll.messageTs`).
     - If triggered from App Home (`blockAction.view?.type === 'home'`), republish the updated App Home view.
     - If user is not the creator, send an ephemeral notice or DM explaining only the creator can close the poll.
   - Add `app.action(/^poll_nudge_click/)`:
     - Parse `pollId` from button `value`.
     - Verify the poll is `ACTIVE` and the actor is `poll.creatorId`.
     - Check `prisma.nudgeLog.findFirst({ where: { pollId, sentAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) } } })`. If a nudge was sent within the last 4 hours, notify the actor ephemerally/DM that nudges are on cooldown.
     - Fetch channel members via `getEligibleChannelMembers(client, poll.channelId)` and filter non-voters via `PollService.getNonVoters(pollId, members)`.
     - Send a private DM (`client.chat.postMessage({ channel: recipientId, text: ... })`) to each non-voter (up to 50) reminding them that `<@${poll.creatorId}>` requested their vote on *${poll.question}* in `<#${poll.channelId}>`, and log each in `prisma.nudgeLog`.
     - Confirm to the creator how many teammates were privately nudged without listing their names publicly.
3. In `src/slack/handlers/commands.ts`:
   - Wrap all command execution paths in a top-level `try/catch`.
   - Update `/pollito help` text to include `/pollito close` and `/pollito nudge`.
   - Support `/pollito close [pollId]`: find the latest `ACTIVE` poll created by `command.user_id` in `command.channel_id` (or matching `pollId`), close it via `PollService.closePoll`, flush the message card update, post the thread closure summary, and send an ephemeral confirmation.
   - Support `/pollito nudge [pollId]`: find the latest `ACTIVE` poll created by `command.user_id` in `command.channel_id` (or matching `pollId`) and execute the Smart Nudge workflow.
   - Use `getEligibleChannelMembers(client, command.channel_id)` for quick polls.
4. In `src/slack/handlers/views.ts`:
   - Validate modal submission inputs (`selectedChannel`, `question` <= 150 chars, `options` >= 2 and <= 200 chars each, `quorumTarget` integer 10..100) using a **Zod** schema, returning `response_action: 'errors'` mapped to `block_id`s on failure.
   - Read `allow_multiple_votes` from `settings_block` checkboxes and pass `allowMultipleVotes` to `PollService.createPoll`.
   - Use `getEligibleChannelMembers(client, selectedChannel)` to compute `eligibleVoterCount`.
5. Create `tests/slack/handlers.test.ts` testing:
   - Quorum reached triggers `UpdateQueue.flushNow` and posts a thread summary via `chat.postMessage`.
   - `poll_close_click` closes the poll for the creator and rejects non-creators.
   - `poll_nudge_click` sends DMs strictly to non-voters (excluding voters and the bot itself), records `NudgeLog`, and enforces the 4-hour cooldown.

**Expected failure to avoid:** Never leak the list of non-voters or voters into the public channel when executing a Smart Nudge; confirmation to the poll creator must only state the count of nudged members.

**Verify:**
```bash
pnpm test && pnpm build
```

**Report:** `P2-T2`

---

### P2-G1 — Gate: Quorum Thread Notice, Manual Close Authorization & Smart Nudge Non-Voter Isolation

**Proven by:** `pnpm test` executing `tests/slack/handlers.test.ts` and `tests/services/updateQueue.test.ts`.

**Negative control:** Run `/Users/jhonatan/.local/bin/auditkit negcontrol` on `src/services/pollService.ts` breaking the creator authorization check in `PollService.closePoll` (`poll.creatorId !== actorUserId`), verify `pnpm test` fails, restore, and verify `pnpm test` passes.

**Report:** `P2-G1`

---

# Phase 3 — Pure Block Kit UI (Clock-Free), Public Voter Mentions, Mascot Micro-Expressions, App Home Analytics & CSV Export

### P3-T1 — Upgrade `pollMessage.ts`, `createPollModal.ts`, and `appHome.ts` for full product fidelity and clock-free purity

**Goal:** Render public voter mentions (`<@user>`), reactive Pollito mascot micro-expressions (`🐣`, `🧐`, `🎉`, `⏰`), creator action buttons, bounded modal inputs (`number_input`, `max_length`, multi-choice checkbox, templates), and a complete App Home analytical dashboard with Quick Templates and CSV Export—with zero `new Date()` calls inside `src/slack/ui/`.

**Files:**
- `src/slack/ui/views/pollMessage.ts`
- `src/slack/ui/views/createPollModal.ts`
- `src/slack/ui/views/appHome.ts`
- `src/slack/handlers/events.ts`
- `src/slack/handlers/actions.ts`
- `tests/ui/createPollModal.test.ts`
- `tests/ui/pollMessage.test.ts` (new)

**Steps:**
1. In `src/slack/ui/views/pollMessage.ts`:
   - Remove all `new Date(...)` calls. Read `poll.closesAt.getTime()` and `poll.closesAt.toISOString()` directly from the `Date` instance on `poll.closesAt` without calling `new Date()`.
   - Determine the Pollito mascot micro-expression:
     - `🎉` when `poll.status === 'QUORUM_REACHED'`
     - `⏰` when `poll.status === 'TIME_EXPIRED'` or `poll.status === 'CLOSED'`
     - `🐣` when `poll.status === 'ACTIVE'` and `totalVotes === 0`
     - `🧐` when `poll.status === 'ACTIVE'` and `totalVotes > 0`
   - Prefix the status context line with the mascot emoji and include `Multiple choice` vs `Single choice` alongside `Anonymous ballot` vs `Public vote`.
   - Truncate `header` text defensively to 150 characters (`poll.question.slice(0, 150)`).
   - When `!poll.isAnonymous && poll.publicVotes && poll.publicVotes.length > 0`, filter `poll.publicVotes` for each `option.id` and append voter mentions (`<@U123> <@U456>`, up to 15 mentions + `+N more`) on a new line under the progress bar. When `poll.isAnonymous === true`, never render voter mentions even if `publicVotes` is passed.
   - When `!isClosed`, append an `actions` block at the bottom of the card with two compact buttons: `Nudge Non-Voters` (`action_id: 'poll_nudge_click'`, `value: JSON.stringify({ pollId: poll.id })`) and `Close Poll` (`action_id: 'poll_close_click'`, `value: JSON.stringify({ pollId: poll.id })`), and display the short poll ID (`ID: ${poll.id.slice(-6)}`) in the footer context block so `/pollito close` is discoverable.
2. In `src/slack/ui/views/createPollModal.ts`:
   - Accept optional `preset?: { channelId?: string; question?: string; options?: string[]; isAnonymous?: boolean; quorumTarget?: number; duration?: string }`.
   - Set `max_length: 150` on `question_input` and `max_length: 200` on `option_1_input`..`option_4_input`.
   - In `settings_block`, add a second checkbox option with `value: 'allow_multiple_votes'` and label `*Multiple Choice*\nAllow teammates to select more than one option.`.
   - Change `quorum_block` element to `type: 'number_input'`, `is_decimal_allowed: false`, `min_value: '10'`, `max_value: '100'`, `initial_value: String(preset?.quorumTarget ?? 70)`.
3. In `src/slack/ui/views/appHome.ts`, `src/slack/handlers/events.ts`, and `src/slack/handlers/actions.ts`:
   - Expand `buildAppHomeView(polls, stats)` to accept workspace-wide aggregate stats (`totalActive`, `totalQuorumsReached`, `totalClosed`, `avgParticipationPct`) queried in `events.ts` via Prisma counts/aggregates.
   - Add a **Quick Templates** actions row (`Standup Check`, `Retro Date`, `Architecture RFC`, `Team Lunch` with `action_id: /^app_home_template_/`) that opens `buildCreatePollModalView` pre-filled with the template's question, options, and quorum target.
   - Add an `Export CSV` button (`action_id: 'app_home_export_csv_click'`) in the App Home header actions that opens a modal displaying a clean CSV report of the workspace's polls (`poll_id,question,channel_id,status,is_anonymous,total_participants,quorum_target_pct,winning_option,created_at,closed_at`).
   - For active polls in App Home, include a `Close Poll` accessory button (`action_id: 'poll_close_click'`).
4. Create `tests/ui/pollMessage.test.ts` and update `tests/ui/createPollModal.test.ts` to verify:
   - Public polls render `<@voterId>` mentions per option; anonymous polls never render `<@voterId>`.
   - Mascot micro-expressions transition accurately (`🐣` -> `🧐` -> `🎉` / `⏰`).
   - Header text over 150 chars is safely truncated to 150 chars.
   - Zero `new Date(` calls exist in `src/slack/ui/views/`.
   - App Home renders Quick Templates, Export CSV button, and aggregate metrics.

**Expected failure to avoid:** Ensure all new UI copy in `pollMessage.ts`, `createPollModal.ts`, and `appHome.ts` passes `tests/copy/antiSlop.test.ts` (strictly English, zero banned words, zero binary contrasts).

**Verify:**
```bash
pnpm test && pnpm build && ! grep -n "new Date(" src/slack/ui/views/*.ts
```

**Report:** `P3-T1`

---

### P3-G1 — Gate: Pure Clock-Free Block Kit UI, Public/Anonymous Rendering Parity & Anti-Slop Compliance

**Proven by:** `pnpm test` (including `tests/ui/pollMessage.test.ts`, `tests/ui/createPollModal.test.ts`, and `tests/copy/antiSlop.test.ts`) plus `! grep -n "new Date(" src/slack/ui/views/*.ts`.

**Negative control:** Run `/Users/jhonatan/.local/bin/auditkit negcontrol` on `src/slack/ui/views/pollMessage.ts` removing the `!poll.isAnonymous` guard on public voter mention rendering so anonymous polls leak `<@voterId>`, verify `pnpm test` fails, restore, and verify `pnpm test` passes.

**Report:** `P3-G1`

---

# Phase 4 — Blind-Secret Hardening, Documentation Cleanup, Pricing Alignment & Release Gate

### P4-T1 — Harden Blind-Secret scripts, create `setup-oauth-secrets.sh`, purge HuddlePace remnants from `docs/guidelines/`, align pricing/scopes, and bump SemVer to `0.2.0`

**Goal:** Eliminate `sed` command-line secret exposure in `scripts/*.sh`, provide an interactive Blind-Secret script for `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`, remove all `HuddlePace` / `Vector the Falcon` / `/pace` contamination from `docs/guidelines/`, unify pricing and OAuth scopes across docs and HTML, and bump `package.json` to `0.2.0`.

**Files:**
- `scripts/setup-slack-secrets.sh`
- `scripts/setup-bot-token.sh`
- `scripts/setup-signing-secret.sh`
- `scripts/setup-oauth-secrets.sh` (new)
- `docs/guidelines/CODING.md`
- `docs/guidelines/SECURITY.md`
- `docs/guidelines/UI_SLACK_BLOCKS_CSS.md`
- `docs/guidelines/EDITORIAL_STANDARDS.md`
- `docs/guidelines/DEFINITION_OF_DONE.md`
- `docs/guidelines/RELEASE_PROCESS.md`
- `PRODUCT.md`
- `AGENTS.md`
- `OPERATIONS.md`
- `public/index.html`
- `public/privacy.html`
- `public/terms.html`
- `public/support.html`
- `package.json`

**Steps:**
1. In `scripts/setup-slack-secrets.sh`, `scripts/setup-bot-token.sh`, and `scripts/setup-signing-secret.sh`:
   - Replace `sed -i "s|...|${SECRET}|"` with a safe helper that passes the secret via environment variable to `awk` or `node -e` reading `process.env`, so the secret never appears in process command-line arguments (`ps aux`) and never breaks on special characters.
2. Create `scripts/setup-oauth-secrets.sh` (`chmod +x`):
   - Interactive Blind-Secret capture (`read -s -r -p`) for `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` (and auto-generating `SLACK_STATE_SECRET` if missing), updating `/home/jhonatan/pollito/.env` on `mi-vps` with `chmod 600` and restarting `pollito` on PM2.
3. Update all 6 files in `docs/guidelines/` (`CODING.md`, `SECURITY.md`, `UI_SLACK_BLOCKS_CSS.md`, `EDITORIAL_STANDARDS.md`, `DEFINITION_OF_DONE.md`, `RELEASE_PROCESS.md`):
   - Replace all references to `HuddlePace`, `Vector the Falcon`, `/pace`, `meetupId`, `validateMeetupTimebox`, `trackerBlock.ts`, and `https://huddlepace.com/healthz` with Pollito's domain (`https://pollito.tbelt.online/healthz`), `/pollito`, double-urn voting invariants, and Pollito mascot micro-expressions.
4. Update `PRODUCT.md`, `AGENTS.md`, `OPERATIONS.md`, and `public/*.html`:
   - Align pricing model to: **Freemium base (100% Free during launch)** with planned **$15/month flat-rate Pro tier per workspace** (and enterprise tiers for advanced governance).
   - Update OAuth "Add to Slack" links in `public/index.html`, `public/privacy.html`, `public/terms.html`, and `public/support.html` to include the complete scope set matching `manifest.json` (`commands,chat:write,chat:write.public,channels:join,channels:read,groups:read,im:read,im:write,mpim:read,users:read`).
   - Update `OPERATIONS.md` to document `HTTPReceiver` accurately and reference `scripts/setup-oauth-secrets.sh`.
5. Bump `"version"` in `package.json` from `"0.1.0"` to `"0.2.0"`.

**Expected failure to avoid:** Do not leave any occurrence of `HuddlePace`, `huddlepace`, `Vector the Falcon`, or `/pace` anywhere in `docs/guidelines/`.

**Verify:**
```bash
! grep -ri "huddlepace" docs/ && ! grep -rn "sed -i.*TOKEN" scripts/ && pnpm test && pnpm build
```

**Report:** `P4-T1`

---

### P4-G1 — Gate: Repository Hygiene, Blind-Secret Safety, Anti-Slop & Full Suite Verification

**Proven by:** Running `! grep -ri "huddlepace" docs/`, `! grep -rn "sed -i.*TOKEN" scripts/`, `pnpm test && pnpm build`, and `/Users/jhonatan/.local/bin/auditkit lint audit`.

**Negative control:** Run `/Users/jhonatan/.local/bin/auditkit negcontrol` on `public/index.html` injecting a banned AI-slop phrase (`"synergize"`), verify `pnpm test` fails on `tests/copy/antiSlop.test.ts`, restore, and verify `pnpm test` passes.

**Report:** `P4-G1`
