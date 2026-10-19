# Changelog

All notable changes to Pollito are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### New
- Pollito speaks English and Spanish. It uses each person's Slack language, and admins can set a workspace default in Settings. The website, legal pages, and the poll demo are available in both languages too.
- Type `/pollito` and Slack now suggests every action: `/pollito-huddle`, `/pollito-report`, `/pollito-close`, and `/pollito-nudge` also work as commands on their own.
- A public status page at pollito.tbelt.online/status/ shows whether Pollito is running, uptime over 30 and 90 days, response time, and any recent restarts or outages.
- After installing, the confirmation page sends you to the help and support page.

### Improved
- App Home is easier to read: the numbers come first, each poll shows its channel, votes and status on one quiet line, and the export and documentation links sit at the bottom. Delete and Clear closed polls are no longer red, and still ask before removing anything.
- Messages and error texts were rewritten to be clearer and shorter, in both languages.
- The website has a new headline, "Polls that close at quorum.", a new mascot, a layout that works from small phones to large screens, and a preview image that Slack shows without cutting the text.
- Pollito has a new profile picture and site icons.

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
