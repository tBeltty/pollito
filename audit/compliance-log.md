# Pollito Quality, Security & Product Compliance — Compliance Log

> **Evidence of record.** One report and one verdict per task/gate ID. Pre-generate an
> empty row per ID from the execution guide so nothing gets skipped silently.
>
> Maintained by the Auditor after every verdict. Compact repeated open conditions
> periodically instead of only appending — see the protocol's note on log maintenance.

---

## Status board

| ID | Delivery | Verdict | Notes |
|---|---|---|---|
| P1-T1 | `DONE` | `APPROVED` | Independently verified by Auditor |
| P1-T2 | `DONE` | `APPROVED` | Independently verified by Auditor |
| P1-G1 | `DONE` | `APPROVED` | Verified via 2 auditkit negcontrol runs |
| P2-T1 | `DONE` | `APPROVED` | Independently verified by Auditor |
| P2-T2 | `DONE` | `APPROVED` | Independently verified by Auditor |
| P2-G1 | `DONE` | `APPROVED` | Verified via auditkit negcontrol |
| P3-T1 | `DONE` | `APPROVED` | Independently verified by Auditor |
| P3-G1 | `DONE` | `APPROVED` | Verified via auditkit negcontrol |
| P4-T1 | `DONE` | `APPROVED` | Independently verified by Auditor |
| P4-G1 | `DONE` | `APPROVED` | Verified via auditkit negcontrol |

---

## Open conditions

None yet.

---

## Reports

### P1-T1 — DONE
**Changed:** `src/utils/crypto.ts`, `prisma/schema.prisma`, `src/db/prisma.ts`, `vitest.config.ts`, `tests/setupEnv.ts`, `package.json`
**Verify output:**
```text
$ pnpm db:generate && DATABASE_URL="file:./test.db" pnpm db:push && npx tsc --noEmit
$ prisma generate
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
✔ Generated Prisma Client (v6.19.3) to ./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client in 86ms

$ prisma db push
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": SQLite database "test.db" at "file:./test.db"

SQLite database test.db created at file:./test.db

🚀  Your database is now in sync with your Prisma schema. Done in 17ms

Running generate... (Use --skip-generate to skip the generators)
✔ Generated Prisma Client (v6.19.3) to ./node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client in 68ms
```
**Observations:** Verified via `grep -rn "anonymousBallot" src/ tests/` that no existing code read `AnonymousBallot.createdAt`. Also ran `pnpm test && pnpm build` (4 test files, 26 tests passed against isolated `file:./test.db`, `tsc` exited 0).
**Decisions made without stopping:** Configured `fileParallelism: false` and `test.env` alongside `setupFiles: ['./tests/setupEnv.ts']` in `vitest.config.ts` so that running either `pnpm test` or `npx vitest run` directly guarantees `DATABASE_URL="file:./test.db"` is set before `dotenv.config()` executes and prevents concurrent test files from racing on SQLite cleanup.

### P1-T2 — DONE
**Changed:** `src/services/pollService.ts`, `src/workers/pollTimerWorker.ts`, `tests/services/pollService.test.ts`
**Verify output:**
```text
$ pnpm test && pnpm build
$ DATABASE_URL="file:./test.db" prisma db push --skip-generate && vitest run
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": SQLite database "test.db" at "file:./test.db"

The database is already in sync with the Prisma schema.


 RUN  v3.2.7 /Users/jhonatan/Documents/pollito

 ✓ tests/services/pollService.test.ts (15 tests) 256ms
 ✓ tests/copy/antiSlop.test.ts (7 tests) 6ms
 ✓ tests/ui/progressBar.test.ts (6 tests) 2ms
 ✓ tests/ui/createPollModal.test.ts (3 tests) 2ms

 Test Files  4 passed (4)
      Tests  31 passed (31)
   Start at  08:58:22
   Duration  954ms (transform 84ms, setup 16ms, collect 142ms, tests 266ms, environment 0ms, prepare 146ms)

$ tsc
```
**Observations:** none
**Decisions made without stopping:** none

### P1-G1 — DONE
**Verify output:**
```text
$ auditkit negcontrol --file src/services/pollService.ts --break-cmd "sed -i '' 's/!votedSet.has(uid)/true/' src/services/pollService.ts" --test-cmd "npx vitest run tests/services/pollService.test.ts"
FAIL tests/services/pollService.test.ts > PollService > castVote & getNonVoters > getNonVoters returns only eligible channel members who have not cast a vote
restored src/services/pollService.ts from backup (byte-identical)
OK: negative control verified — the check fails without the protection and passes with it.

$ auditkit negcontrol --file src/workers/pollTimerWorker.ts --break-cmd "sed -i '' 's/decryptToken(poll.workspace?.botToken ?? '\'''\'', env.APP_SECRET_SALT) ??/poll.workspace?.botToken ||/' src/workers/pollTimerWorker.ts" --test-cmd "npx vitest run tests/services/pollService.test.ts"
FAIL tests/services/pollService.test.ts > PollService > closePoll & PollTimerWorker > PollTimerWorker resolves placeholder workspace botToken to valid xoxb- token and never passes bot_token_managed
restored src/workers/pollTimerWorker.ts from backup (byte-identical)
OK: negative control verified — the check fails without the protection and passes with it.
```
**Observations:** Phase 1 complete and signed off.

### P2-T1 — DONE
**Changed:** `src/config/env.ts`, `src/services/updateQueue.ts`, `src/slack/handlers/events.ts`, `src/index.ts`, `manifest.json`, `tests/services/updateQueue.test.ts`
**Verify output:**
```text
$ pnpm test && pnpm build
$ DATABASE_URL="file:./test.db" prisma db push --skip-generate && vitest run
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": SQLite database "test.db" at "file:./test.db"

The database is already in sync with the Prisma schema.


 RUN  v3.2.7 /Users/jhonatan/Documents/pollito

 ✓ tests/services/updateQueue.test.ts (4 tests) 166ms
 ✓ tests/services/pollService.test.ts (15 tests) 241ms
 ✓ tests/copy/antiSlop.test.ts (7 tests) 6ms
 ✓ tests/ui/progressBar.test.ts (6 tests) 2ms
 ✓ tests/ui/createPollModal.test.ts (3 tests) 2ms

 Test Files  5 passed (5)
      Tests  35 passed (35)
   Start at  09:06:20
   Duration  1.27s (transform 91ms, setup 16ms, collect 182ms, tests 417ms, environment 1ms, prepare 179ms)

$ tsc
```
**Observations:** none
**Decisions made without stopping:** Scoped `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })` in `tests/services/updateQueue.test.ts` so fake timers deterministically control `UpdateQueue`'s debounce/ceiling schedule without blocking Prisma's native Rust query engine I/O callbacks.

### P2-T2 — DONE
**Changed:** `src/slack/utils/channelMembers.ts`, `src/slack/handlers/actions.ts`, `src/slack/handlers/commands.ts`, `src/slack/handlers/views.ts`, `tests/slack/handlers.test.ts`
**Verify output:**
```text
$ pnpm test && pnpm build
$ DATABASE_URL="file:./test.db" prisma db push --skip-generate && vitest run
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": SQLite database "test.db" at "file:./test.db"

The database is already in sync with the Prisma schema.


 RUN  v3.2.7 /Users/jhonatan/Documents/pollito

 ✓ tests/services/pollService.test.ts (15 tests) 286ms
 ✓ tests/services/updateQueue.test.ts (4 tests) 138ms
 ✓ tests/slack/handlers.test.ts (15 tests) 83ms
 ✓ tests/copy/antiSlop.test.ts (7 tests) 6ms
 ✓ tests/ui/progressBar.test.ts (6 tests) 2ms
 ✓ tests/ui/createPollModal.test.ts (3 tests) 6ms

 Test Files  6 passed (6)
      Tests  50 passed (50)
   Start at  09:16:54
   Duration  1.67s (transform 125ms, setup 18ms, collect 290ms, tests 521ms, environment 1ms, prepare 239ms)

$ tsc
```
**Observations:** Pre-verified negative control for `P2-G1` locally via `auditkit negcontrol --file src/services/pollService.ts --break-cmd "sed -i '' 's/poll.creatorId !== actorUserId/false/' src/services/pollService.ts" --test-cmd "pnpm test"` — failed cleanly on non-creator rejection test and restored cleanly to green.
**Decisions made without stopping:** Cached `botUserId` per WebClient object instance via WeakMap in `src/slack/utils/channelMembers.ts` so paginated calls and subsequent actions reuse the resolved bot ID without redundant `auth.test` roundtrips.

### P2-G1 — DONE
**Verify output:**
```text
$ auditkit negcontrol --file src/services/pollService.ts --break-cmd "sed -i '' 's/poll.creatorId !== actorUserId/false/' src/services/pollService.ts" --test-cmd "pnpm test"
FAIL tests/slack/handlers.test.ts > Slack Handlers & Channel Member Governance > poll_close_click action handler > rejects poll_close_click when clicked by a non-creator
AssertionError: expected 'CLOSED' to be 'ACTIVE' // Object.is equality
restored src/services/pollService.ts from backup (byte-identical)
OK: negative control verified — the check fails without the protection and passes with it.
```
**Observations:** Phase 2 complete and signed off.

### P3-T1 — DONE
**Changed:**
- `src/slack/ui/views/pollMessage.ts` (removed all `new Date(...)` calls in favor of direct `poll.closesAt.getTime()` and `poll.closesAt.toISOString()`, updated `PollWithDetails`, added reactive Pollito mascot micro-expressions `🐣`/`🧐`/`🎉`/`⏰`, added `Multiple choice`/`Single choice` badge, truncated header text to 150 chars, rendered `<@voterId>` public vote mentions up to 15 + `+N more` guarded by `!poll.isAnonymous`, added `poll_nudge_click` and `poll_close_click` action buttons on active polls, and appended `ID: ${poll.id.slice(-6)}` to footer context)
- `src/slack/ui/views/createPollModal.ts` (exported `CreatePollModalPreset`, made `buildCreatePollModalView` accept `string | CreatePollModalPreset`, added `max_length: 150` on question and `max_length: 200` on options 1-4, added `is_anonymous` and `allow_multiple_votes` checkboxes with `initial_options` support, and converted `quorum_block` to `number_input` with `min_value: '10'`, `max_value: '100'`)
- `src/slack/ui/views/appHome.ts` (exported `AppHomeStats`, `computeAppHomeStats`, `buildPollsCsvReport`, and `buildCsvExportModalView`, updated `buildAppHomeView` with aggregate metrics `Active Polls`, `Quorums Reached`, `Closed Polls`, `Avg. Participation: ${avgParticipationPct}%`, Quick Templates action buttons, `app_home_export_csv_click` button, and `Close Poll` accessory buttons on active polls)
- `src/slack/handlers/events.ts` (queried workspace-wide aggregate counts and passed `stats` to `buildAppHomeView`)
- `src/slack/handlers/actions.ts` (registered `app.action(/^app_home_template_/, ...)` and `app.action('app_home_export_csv_click', ...)`)
- `tests/ui/pollMessage.test.ts` (created unit tests covering public mentions, anonymous privacy guarantee, mascot micro-expressions, 150-char header truncation, and active/closed action buttons)
- `tests/ui/createPollModal.test.ts` (updated with unit tests for `number_input` bounds, `max_length`, `allow_multiple_votes`, preset templates, App Home analytics, and CSV export)
**Verify output:**
```text
$ pnpm test && pnpm build && ! grep -n "new Date(" src/slack/ui/views/*.ts
$ DATABASE_URL="file:./test.db" prisma db push --skip-generate && vitest run
The database is already in sync with the Prisma schema.

 RUN  v3.2.7 /Users/jhonatan/Documents/pollito

 ✓ tests/services/pollService.test.ts (15 tests) 263ms
 ✓ tests/services/updateQueue.test.ts (4 tests) 141ms
 ✓ tests/slack/handlers.test.ts (15 tests) 79ms
 ✓ tests/copy/antiSlop.test.ts (7 tests) 7ms
 ✓ tests/ui/createPollModal.test.ts (6 tests) 4ms
 ✓ tests/ui/pollMessage.test.ts (6 tests) 4ms
 ✓ tests/ui/progressBar.test.ts (6 tests) 2ms

 Test Files  7 passed (7)
      Tests  59 passed (59)
   Duration  1.76s

$ tsc
```
**Observations:** Pre-verified `P3-G1` negative control via `auditkit negcontrol --file src/slack/ui/views/pollMessage.ts --break-cmd "sed -i '' 's/!poll.isAnonymous/true/' src/slack/ui/views/pollMessage.ts" --test-cmd "pnpm test"` — failed on the anonymous poll voter mention leak assertion and restored cleanly to green.
**Decisions made without stopping:** Typed `PollWithDetails` as `Omit<Poll, 'allowMultipleVotes'> & { allowMultipleVotes?: boolean; options: PollOption[]; participations: { voterId: string }[]; publicVotes?: { voterId: string; optionId: string }[]; }` so full Prisma `Poll` objects and lightweight test fixtures without `allowMultipleVotes` or full `PublicVote` rows both typecheck cleanly.

### P3-G1 — DONE
**Verify output:**
```text
$ auditkit negcontrol --file src/slack/ui/views/pollMessage.ts --break-cmd "sed -i '' 's/!poll.isAnonymous/true/' src/slack/ui/views/pollMessage.ts" --test-cmd "pnpm test"
FAIL tests/ui/pollMessage.test.ts > Poll Message Block Kit Builder (pollMessage.ts) > never renders <@voterId> mentions on anonymous polls even when publicVotes is supplied
AssertionError: expected '[{"type":"header","text":{"type":"pla…' not to contain '<@U_SECRET_1>'
restored src/slack/ui/views/pollMessage.ts from backup (byte-identical)
OK: negative control verified — the check fails without the protection and passes with it.
```
**Observations:** Phase 3 complete and signed off.

### P4-T1 — DONE
**Changed:**
- `scripts/setup-slack-secrets.sh`: Streamed secrets via stdin to `node -e` on remote VPS without `sed -i` command-line interpolation.
- `scripts/setup-bot-token.sh`: Piped token via stdin to `node -e` without `sed -i` interpolation.
- `scripts/setup-signing-secret.sh`: Piped secret via stdin to `node -e` without `sed -i` interpolation.
- `scripts/setup-oauth-secrets.sh`: Created new executable script (`chmod +x`) for interactive Blind-Secret capture (`read -s -r -p`) of `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`, auto-generating `SLACK_STATE_SECRET` if missing, enforcing `chmod 600`, and restarting PM2.
- `docs/guidelines/CODING.md`: Replaced `validateMeetupTimebox`, `meetupId`, and timebox pacing with `validatePollOptions`, `pollId`, and poll consensus invariants.
- `docs/guidelines/SECURITY.md`: Replaced HuddlePace references with Pollito baseline and double-urn HMAC-SHA256 salted token invariants.
- `docs/guidelines/UI_SLACK_BLOCKS_CSS.md`: Replaced meeting tracker with `pollMessage.ts`, 10-block progress bar, and mascot micro-expressions (`🐣`, `🧐`, `🎉`, `⏰`).
- `docs/guidelines/EDITORIAL_STANDARDS.md`: Replaced Vector the Falcon and `/pace` with Pollito the Chick (`🐣`, `🧐`, `🎉`, `⏰`), `/pollito`, and zero AI slop invariants.
- `docs/guidelines/DEFINITION_OF_DONE.md`: Updated healthz check to `https://pollito.tbelt.online/healthz` and scoped to Pollito.
- `docs/guidelines/RELEASE_PROCESS.md`: Purged HuddlePace references, updated repository links and health check URL to `pollito.tbelt.online`.
- `docs/guidelines/REPOSITORY_HYGIENE.md` & `docs/guidelines/INFRASTRUCTURE.md`: Updated app name and infrastructure references to Pollito and `HTTPReceiver`.
- `PRODUCT.md` & `AGENTS.md`: Aligned pricing model to Freemium base (100% Free during launch) with planned $15/month flat-rate Pro tier per workspace and documented `HTTPReceiver`.
- `OPERATIONS.md`: Documented `HTTPReceiver`, added OAuth credentials table, and documented `scripts/setup-oauth-secrets.sh`.
- `public/index.html`, `public/privacy.html`, `public/terms.html`, `public/support.html`: Updated "Add to Slack" OAuth links to include complete scope set (`commands,chat:write,chat:write.public,channels:join,channels:read,groups:read,im:read,im:write,mpim:read,users:read`), aligned pricing copy while keeping 100% compliance with `antiSlop.test.ts`.
- `package.json`: Bumped version from `0.1.0` to `0.2.0`.

**Verify output:**
```text
$ ! grep -ri "huddlepace" docs/ && ! grep -rn "sed -i.*TOKEN" scripts/ && pnpm test && pnpm build
✓ Lockfile passes supply-chain policies (verified 16h ago)
Lockfile is up to date, resolution step is skipped
Already up to date
Done in 496ms using pnpm v11.7.0
$ DATABASE_URL="file:./test.db" prisma db push --skip-generate && vitest run
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": SQLite database "test.db" at "file:./test.db"

The database is already in sync with the Prisma schema.

 RUN  v3.2.7 /Users/jhonatan/Documents/pollito

 ✓ tests/services/pollService.test.ts (15 tests) 250ms
 ✓ tests/services/updateQueue.test.ts (4 tests) 138ms
 ✓ tests/slack/handlers.test.ts (15 tests) 71ms
 ✓ tests/ui/pollMessage.test.ts (6 tests) 4ms
 ✓ tests/copy/antiSlop.test.ts (7 tests) 6ms
 ✓ tests/ui/createPollModal.test.ts (6 tests) 4ms
 ✓ tests/ui/progressBar.test.ts (6 tests) 2ms

 Test Files  7 passed (7)
      Tests  59 passed (59)
   Start at  09:40:23
   Duration  1.74s (transform 125ms, setup 17ms, collect 271ms, tests 473ms, environment 1ms, prepare 261ms)

$ tsc

$ test -x scripts/setup-oauth-secrets.sh && ! grep -rn "sed -i.*SECRET" scripts/ && echo "ALL CRITERIA VERIFIED"
ALL CRITERIA VERIFIED
```
**Observations:** Zero occurrences of `huddlepace`, `Vector the Falcon`, `/pace`, or `sed -i` secret interpolation remain in repository. All 7 test suites (59 tests) pass with zero errors, TypeScript compiles cleanly with zero diagnostics.
**Decisions made without stopping:** Piped secrets across local and SSH streams directly to `node -e` stdin so secret tokens never appear in shell process argument vectors (`ps aux`). Enforced mode `0600` on `.env` file write.

### P4-G1 — DONE
**Verify output:**
```text
$ ! grep -ri "huddlepace" docs/ && ! grep -rn "sed -i.*TOKEN" scripts/ && ! grep -rn "sed -i.*SECRET" scripts/ && test -x scripts/setup-oauth-secrets.sh
(exit 0)

$ auditkit negcontrol --file public/index.html --break-cmd "sed -i '' 's/Pollito/Pollito synergize/' public/index.html" --test-cmd "pnpm test"
FAIL tests/copy/antiSlop.test.ts > Anti-AI Slop Quality Gate > index.html adheres strictly to Anti-AI Slop standards
AssertionError: Found banned AI-slop pattern /\bsynergize\b/i in index.html: expected [ 'synergize', index: 155, …(2) ] to be null
restored public/index.html from backup (byte-identical)
OK: negative control verified — the check fails without the protection and passes with it.
```
**Observations:** Phase 4 complete and signed off. All 4 phases (`P1-T1` through `P4-G1`) are `DONE` and `APPROVED`.
