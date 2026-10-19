# Pollito

Slack polls that close when enough of your team has voted. Pollito runs public or anonymous polls, closes them at quorum or at a deadline, and posts the result in the thread. Everything happens inside Slack.

Website and install: [pollito.tbelt.online](https://pollito.tbelt.online) · Spanish: [pollito.tbelt.online/es](https://pollito.tbelt.online/es/)

![Pollito poll card in Slack](assets/preview-slack-light.png)

## What it does

- **Public or anonymous polls.** Public polls show who picked what. Anonymous polls use a double-urn ballot: the record that a user voted and the option they chose are stored separately, with no link between them. Tokens are derived with HKDF-SHA256.
- **Quorum or deadline.** Set a participation target from 51% to 100% of channel members, a deadline from 15 minutes to 7 days, or both. The poll closes and announces the winner, or the tie, in its thread.
- **Nudges for non-voters.** `/pollito nudge` sends a private DM to people who have not voted. It never reveals who has, and it is limited to one nudge every 4 hours per poll.
- **Live results.** The poll card is edited in place with vote counts and progress bars. Updates are debounced (800 ms, 2 s maximum) to stay within Slack rate limits.
- **App Home dashboard.** Active polls, history, participation stats, reusable templates, and CSV export, all inside Slack.
- **Huddle polls.** `/pollito huddle` posts into a Huddle thread, and Pollito can remind the channel when the Huddle ends.
- **Single or multiple choice**, manual close by the creator, and English or Spanish UI based on the user's Slack language.

## Commands

| Command | What it does |
| --- | --- |
| `/pollito` | Opens the poll creation modal |
| `/pollito huddle` | Creates a poll in the current Huddle thread |
| `/pollito report` | Shows participation and results |
| `/pollito close [poll-id]` | Closes a poll you created |
| `/pollito nudge [poll-id]` | DMs the people who have not voted |
| `/pollito help` | Lists commands |

## Stack

- Node.js 22, TypeScript (strict), Zod for payload validation
- `@slack/bolt` over HTTP in production, Socket Mode for local development
- Prisma with SQLite in WAL mode
- Vitest, including a copy-quality gate that scans UI strings and the website
- Nginx, PM2, and GitHub Actions with a smoke-test gate and automatic rollback

```
src/slack/ui/        Pure Block Kit view builders (no I/O, no clock)
src/slack/handlers/  Commands, actions, views, and events
src/services/        Poll logic, voting, quorum, update queue
src/workers/         Auto-close timers and reminders
src/i18n/            Typed EN/ES message catalogs
public/              Website (EN, ES), legal pages, poll simulator
```

## Run it locally

You need Node.js 22, pnpm, and a Slack app created from [`manifest.json`](manifest.json). Copy `.env.example` to `.env` and fill in the Slack credentials. Enable Socket Mode for local work.

```bash
pnpm install
pnpm db:generate
pnpm db:push
pnpm dev
```

Run the checks before opening a pull request:

```bash
pnpm test
pnpm build
```

## Documentation

- [OPERATIONS.md](OPERATIONS.md): architecture, credentials, deployment, and server operations
- [PRODUCT.md](PRODUCT.md): positioning, personas, and brand
- [docs/guidelines](docs/guidelines/): coding, security, UI, i18n, and editorial standards
- [CHANGELOG.md](CHANGELOG.md): release history

## License and security

Pollito is source-available under the [Pollito Source-Available & Audit License](LICENSE). You can inspect and audit the code; copying, derivative works, and redistribution are not permitted.

Report vulnerabilities as described in [SECURITY.md](SECURITY.md).
