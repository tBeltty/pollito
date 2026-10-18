# Infrastructure & Deployment Standards

This document specifies the operational standards for hosting Pollito on a dedicated production VPS (`mi-vps`).

---

## 1. Zero Cloud Ingress Architecture & Reverse Proxy

Pollito connects to Slack through **HTTPReceiver** with Nginx reverse proxy and Cloudflare CDN:
- **Nginx Reverse Proxy**: Receives incoming Slack webhook traffic on port 443 and proxies to local port 3015.
- **TLS Termination**: Managed by Cloudflare CDN with Let's Encrypt certificates.
- **Cryptographic Verification**: HMAC-SHA256 signature verification on every incoming Slack payload via `SLACK_SIGNING_SECRET`.

---

## 2. Server Isolation & Multi-Project Safety

When co-hosting Pollito alongside other services on the same VPS:

1. **Dedicated Directory**: Pollito lives in its own root directory (`/home/jhonatan/pollito`). It must never share files, node_modules, or virtualenvs with other projects.
2. **Process Supervision**:
   - Managed via PM2 (`pm2 restart pollito --update-env`).
   - Self-hosted GitHub Actions runner handles automated zero-downtime deployment with automatic rollback on error.
3. **Graceful Shutdown**:
   - Handles `SIGINT` and `SIGTERM` to cleanly close server listeners and Prisma database connections.

---

## 3. Database Durability (Embedded SQLite)

- **Storage Location**: `prisma/pollito.db`.
- **WAL Mode**: SQLite runs with Write-Ahead Logging (`PRAGMA journal_mode=WAL;`) enabled for high-concurrency read/write operations without table locking.
- **Backups**: Regular cron-based atomic backup (`sqlite3 /path/to/db ".backup '/path/to/backup.db'"`).
