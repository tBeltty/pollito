# Changelog

All notable changes to Pollito are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-10-23

### Added
- Bilingual English and Spanish support across Slack Block Kit views, interactive modals, slash commands, error notifications, and landing pages, automatically resolving from user Slack preferences or workspace defaults.
- Direct slash command aliases (`/pollito-huddle`, `/pollito-report`, `/pollito-close`, `/pollito-nudge`) alongside the primary `/pollito` command.
- Public status dashboard at `/status` tracking real-time health, 30-day and 90-day uptime metrics, response latency, and operational events via an automated background probe.
- Workspace setting in App Home to toggle automatic poll standby card prompts in Huddle threads (disabled by default to prevent unsolicited thread messages).
- Visual destination banner and channel host hints in the poll creation modal when launching within a thread or active Huddle.
- Post-installation redirect pointing directly to documentation and support resources.
- Auditable GitHub repository link in the website footer.

### Changed
- Quorum threshold calculation is now opt-in and unchecked by default in the poll creation modal.
- Standby poll cards in active Huddle threads are now silent by default and require enabling the workspace setting.
- App Home layout updated with prioritized summary metrics, single-line poll status entries, and subdued non-destructive action styling.
- Ephemeral vote confirmation messages now stay inside the active thread instead of posting to the root channel view.
- Landing page updated with fluid typography, responsive layout, refreshed mascot branding, and Slack-optimized Open Graph preview images.

### Fixed
- Prevented unintended thread prompts on general message activity, YouTube links, and colleague mentions inside conversation threads.
- Prevented bot ID false negatives during Huddle thread detection by passing workspace bot authorization tokens.
- Resolved multi-tenant token resolution in Slack OAuth authorization handlers.
- Enforced Slack modal title constraints (maximum 24 characters).
- Pointed public landing page "Add to Slack" buttons directly to `/slack/install`.

## [0.2.0] - 2026-10-18

### Added
- Workspace installation flow from public web interface at pollito.tbelt.online.
- Manual poll closing via `/pollito close` command or modal actions.
- Smart nudges sent via ephemeral messages or direct messages strictly to non-voters (rate-limited to once every 4 hours).
- Multiple-choice polling options.
- Automated thread result publication upon poll completion (quorum reached, deadline reached, or manual close).
- Public poll voter breakdowns showing individual voter selections.
- App Home metrics, workspace quick templates, and CSV export capabilities.

### Changed
- Concurrency hardening for real-time vote updates during high-volume participation.
- Quorum math adjustments excluding bot identities from channel membership counts.
- Global background worker for poll deadline enforcement across all installed workspaces.

### Security
- Cryptographic double-urn architecture ensuring anonymous votes cannot be correlated with user identities.
- Workspace access tokens encrypted at rest.

[Unreleased]: https://github.com/tBeltty/pollito/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/tBeltty/pollito/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/tBeltty/pollito/releases/tag/v0.2.0
