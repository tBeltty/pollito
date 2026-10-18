# Security & Token Standards

This document establishes the security baseline for Pollito.

---

## 1. Secrets Management

1. **Zero Secret Leaks**: `.env` and SQLite database files are strictly ignored via `.gitignore` and must never enter git history.
2. **Token Separation**:
   - `SLACK_BOT_TOKEN` (`xoxb-...`): Used only for authorized API calls (`chat.postMessage`, `chat.update`).
   - `SLACK_SIGNING_SECRET`: Used for HMAC-SHA256 request verification in HTTPReceiver.
   - `SLACK_CLIENT_ID` & `SLACK_CLIENT_SECRET`: Used for multi-tenant OAuth 2.0 installations.
   - `SLACK_APP_TOKEN` (`xapp-...`): Used exclusively for opening WebSocket connections in Socket Mode.
   - `APP_SECRET_SALT`: Private workspace cryptographic salt for double-urn anonymous ballots.
3. **Restricted Token Scopes**: Never request wildcard or admin scopes. Request only the exact granular scopes defined in [`manifest.json`](../../manifest.json).

---

## 2. Input Validation & Defense in Depth

1. **Zod Validation**: All user inputs submitted from modals (poll questions, option labels, quorum targets) must be validated with Zod before database persistence.
2. **Channel Authorization**: Only query member counts and post messages in channels where the bot is installed or has legitimate access.
3. **Cryptographic Double-Urn Isolation**: Enforce HMAC-SHA256 salted tokens for anonymous polls. Never link voter IDs directly to options in SQLite.
