# Changelog

All notable changes to Pollito are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Public status page (`public/status/`, served at `pollito.tbelt.online/status/`): current state, 30-day uptime, time since the last restart, response time, a 90-day availability chart, and recent restarts and outages, in English and Spanish. A one-minute probe (`src/status/probe.ts`) writes a sanitized `status.json` with no hostnames, process ids, or resource figures; the pure history logic in `src/status/history.ts` is covered by tests. An nginx `location` snippet lives in `deploy/nginx/`.
- Comprehensive bilingual internationalization (i18n) and localization (l10n) architecture for English (`en`, default) and Spanish (`es`) across Slack and web surfaces.
- Typed message catalogs (`src/i18n/catalogs/en.ts` and `src/i18n/catalogs/es.ts`) with 317 compile-time verified message keys and 100% key and parameter parity.
- Lightweight, zero-dependency ICU MessageFormat parser supporting parameter interpolation, plurals (`Intl.PluralRules`), select branches, and ECMAScript `Intl` formatters (number, date, relative time, and list).
- Dynamic Slack locale resolution hierarchy (`src/slack/utils/locale.ts`) checking user Slack language (`users.info` with 1-hour TTL cache), workspace settings default, and global fallback to English.
- Workspace default language configuration dropdown in the Settings modal (`WorkspaceSettings.locale`) and creator locale persistence on `Poll.locale` for background announcements.
- Full Spanish localized routes for marketing and legal pages (`public/es/index.html`, `public/es/privacy.html`, `public/es/terms.html`, `public/es/support.html`) and mirrored `/en/` paths with bidirectional `hreflang` tags (`en`, `es`, `x-default`) and localized OpenGraph metadata.
- Multilingual XML sitemap (`public/sitemap.xml`) with alternate `hreflang` definitions.
- Localized interactive Slack poll simulator (`public/app.js`) detecting `<html lang="es">` or `/es/` pathname and displaying Spanish poll states and tallies.
- Comprehensive automated test suites in `tests/i18n/catalogParity.test.ts` (enforcing key parity, parameter matching, and locale resolution) and `tests/i18n/messageFormat.test.ts` (ICU plurals, selects, and Intl formatters).
- Engineering guideline `docs/guidelines/I18N.md` detailing catalog conventions, ICU syntax, Slack Block Kit text expansion resilience, and Spanish editorial standards (100% tuteo, RAE punctuation, zero AI slop).

### Changed
- Refactored all Slack UI Block Kit view builders (`src/slack/ui/views/`) to accept pure `Translator` instances, maintaining deterministic, clock-free rendering without side effects.
- Updated `public/styles.css` with responsive `.lang-switch-wrap` and `.lang-switch` pills and flexbox resilience for 20-45% text expansion in Spanish.
- Updated `AGENTS.md` and `docs/KNOWLEDGE_INDEX.md` to reference the bilingual i18n architecture and guideline.

## [0.2.0] - 2026-10-18

### Added
- Added multi-workspace OAuth 2.0 installation routes (`/slack/install` and `/slack/oauth_redirect`) with `HttpOnly; Secure` HMAC-signed state cookies and `AES-256-GCM` encryption at rest for `Workspace.botToken` (`src/utils/crypto.ts`, `src/index.ts`).
- Added an interactive Blind-Secret script (`scripts/setup-oauth-secrets.sh`) to configure `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and `SLACK_STATE_SECRET` without shell history or process list exposure.
- Added manual poll closing via `/pollito close [poll-id]` and in-card or App Home `Close Poll` buttons (`poll_close_click`), restricted to the poll creator.
- Added Smart Nudges via `/pollito nudge [poll-id]` and `Nudge Non-Voters` buttons (`poll_nudge_click`), sending private DMs strictly to eligible non-voters with a 4-hour cooldown tracked in `NudgeLog`.
- Added automatic thread closure summaries (`thread_ts`) when a poll reaches quorum, closes manually, or expires via `PollTimerWorker`.
- Added multiple-choice voting (`Poll.allowMultipleVotes`) across the creation modal and `PollService.castVote`.
- Added inline `<@user>` voter mentions per option on public polls (up to 15 mentions plus a `+N more` counter) while suppressing voter identities on anonymous polls.
- Added reactive Pollito mascot micro-expressions (`🐣` waiting, `🧐` active votes, `🎉` quorum reached, `⏰` closed or expired) to poll status lines.
- Added App Home workspace telemetry (`Active Polls`, `Quorums Reached`, `Closed Polls`, `Avg. Participation`), one-click Quick Templates (`Standup Check`, `Retro Date`, `Architecture RFC`, `Team Lunch`), and modal CSV export (`buildPollsCsvReport`).
- Added event deduplication middleware for `event_id` and `X-Slack-Retry-Num` headers alongside `tokens_revoked` lifecycle handling.
- Added runtime Zod validation (`createPollSubmissionSchema`) on `create_poll_modal_submit` with field-level Block Kit error mapping.

### Changed
- Added a 2000ms maximum wait ceiling (`MAX_WAIT_MS`), `flushNow`, and `flushAll` to `UpdateQueue` so rapid voting bursts update Slack cards in real time without starvation.
- Excluded the bot's own `user_id` (`getEligibleChannelMembers`) from channel member counts so 100% quorum thresholds remain mathematically reachable.
- Removed all `new Date()` calls from `src/slack/ui/views/pollMessage.ts` for pure, clock-free Block Kit rendering.
- Purged legacy `HuddlePace`, `Vector the Falcon`, and `/pace` references from `docs/guidelines/` and aligned pricing copy around the Freemium launch model and planned $15/month flat-rate Pro tier.

### Fixed
- Fixed `PollTimerWorker` token resolution on auto-created workspaces so it decrypts stored OAuth bot tokens or falls back to `env.SLACK_BOT_TOKEN` instead of passing the `'bot_token_managed'` placeholder.
- Isolated Vitest test runs to `file:./test.db` (`vitest.config.ts`, `tests/setupEnv.ts`) with SQLite `WAL` mode and `busy_timeout = 5000`.

### Security
- Upgraded double-urn anonymous ballot token derivation to `HKDF-SHA256` (`deriveDoubleUrnVoterToken`), combining `APP_SECRET_SALT` with each workspace's `anonymousSalt`.
- Removed `createdAt` and switched `id` to `@default(uuid())` on `AnonymousBallot` to prevent timing-correlation attacks against `PollParticipation`.
- Hardened `scripts/setup-slack-secrets.sh`, `scripts/setup-bot-token.sh`, and `scripts/setup-signing-secret.sh` to pipe secrets over `stdin` to `node -e` instead of interpolating values into `sed -i` arguments.

[Unreleased]: https://github.com/tBeltty/pollito/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/tBeltty/pollito/releases/tag/v0.2.0
