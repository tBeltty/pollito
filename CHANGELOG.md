# Changelog

All notable changes to Pollito are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Subcommand aliases `/pollito-huddle`, `/pollito-report`, `/pollito-close` and `/pollito-nudge`, so Slack suggests every action when you type `/pollito`. The updated `manifest.json` registers them with usage hints.
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
- Engineering guideline `docs/guidelines/I18N.md` detailing catalog conventions, ICU syntax, Slack Block Kit text expansion resilience, and Spanish editorial standards (100% tuteo, RAE punctuation, plain prose).

### Changed
- App Home layout: values lead each stat, poll details sit on a single context line, and export and documentation links moved to the bottom. Delete and Clear closed polls no longer use red styling and keep their confirmation dialogs.
- Landing page: new headline ("Polls that close at quorum."), a hero built from the new mascot and an HTML poll card, a rem-based mobile-first stylesheet, and an Open Graph image designed for Slack's square crop.
- Refactored all Slack UI Block Kit view builders (`src/slack/ui/views/`) to accept pure `Translator` instances, maintaining deterministic, clock-free rendering without side effects.
- Updated `public/styles.css` with responsive `.lang-switch-wrap` and `.lang-switch` pills and flexbox resilience for 20-45% text expansion in Spanish.

## [0.2.0] - 2026-10-18

### New
- Install Pollito on any Slack workspace from pollito.tbelt.online.
- Close a poll yourself with `/pollito close` or the Close button.
- Nudge people who haven't voted. They get a private message, nobody sees who has voted, and a poll can be nudged once every 4 hours.
- Multiple-choice polls.
- When a poll closes (quorum, deadline, or by hand), the result is posted in its thread.
- Public polls show who voted for each option.
- App Home shows your stats, quick templates, and CSV export.

### Improved
- Results update live, even when many people vote at once.
- A 100% quorum can now be reached. Pollito no longer counts itself as a channel member.
- Poll deadlines now close polls on every installed workspace.

### Privacy and security
- Anonymous votes are stronger: nothing in the data can link a vote to the person who cast it.
- Workspace access tokens are stored encrypted.

[Unreleased]: https://github.com/tBeltty/pollito/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/tBeltty/pollito/releases/tag/v0.2.0
