# Security & Token Standards

This document establishes the security baseline for HuddlePace.

---

## 1. Secrets Management

1. **Zero Secret Leaks**: `.env` and SQLite database files are strictly ignored via `.gitignore` and must never enter git history.
2. **Token Separation**:
   - `SLACK_BOT_TOKEN` (`xoxb-...`): Used only for authorized API calls (`chat.postMessage`, `chat.update`).
   - `SLACK_APP_TOKEN` (`xapp-...`): Used exclusively for opening the WebSocket connection in Socket Mode.
3. **Restricted Token Scopes**: Never request wildcard or admin scopes. Request only the exact granular scopes defined in [`manifest.json`](../../manifest.json).

---

## 2. Input Validation & Defense in Depth

1. **Zod Validation**: All user inputs submitted from modals (meeting titles, percentages, module names) must be validated with Zod before database persistence.
2. **Channel Authorization**: Only allow scheduled tracking in channels where the bot has been explicitly invited.
3. **Strict Bounds Checking**: Enforce 100% time budget constraint mathematically before creating records in SQLite.
