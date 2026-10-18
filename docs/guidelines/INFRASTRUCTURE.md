# Infrastructure & Deployment Standards

This document specifies the operational standards for hosting HuddlePace on a dedicated production VPS (`<PRODUCTION_VPS>`).

---

## 1. Zero Cloud Ingress Architecture

HuddlePace connects to Slack exclusively through **Slack Socket Mode** over an outbound WebSocket tunnel (`wss://`):
- **No Inbound Ports**: The bot does not open public HTTP/HTTPS ports.
- **No Reverse Proxy**: Eliminates Nginx/Caddy proxy overhead for Slack webhooks.
- **No TLS Maintenance**: Zero certificate renewal dependencies (Let's Encrypt / Certbot).
- **Cost**: Zero cloud egress/ingress costs.

---

## 2. Server Isolation & Multi-Project Safety

When co-hosting HuddlePace alongside other services on the same VPS:

1. **Dedicated Directory**: HuddlePace lives in its own root directory (`/opt/huddle-pace` or `/home/<DEPLOY_USER>/huddle-pace`). It must never share files, node_modules, or virtualenvs with other projects.
2. **Dedicated Systemd Daemons**:
   - **Production Bot Service**: `huddlepace.service` managed by systemd, running under the designated user.
   - **CI Runner Service**: `actions.runner.<ORG>-<REPO>.<RUNNER_NAME>.service` running in `/home/<DEPLOY_USER>/actions-runner`.
3. **Process Supervision**:
   - `Restart=on-failure` with `RestartSec=5s` in systemd.
   - Graceful shutdown handles `SIGINT` and `SIGTERM` to cleanly disconnect Socket Mode and close Prisma database connections.

---

## 3. Database Durability (Embedded SQLite)

- **Storage Location**: `prisma/dev.db` (or `data/huddlepace.db`).
- **WAL Mode**: SQLite runs with Write-Ahead Logging (`PRAGMA journal_mode=WAL;`) enabled for high-concurrency read/write operations without table locking.
- **Backups**: Regular cron-based atomic backup (`sqlite3 /path/to/db ".backup '/path/to/backup.db'"`).
