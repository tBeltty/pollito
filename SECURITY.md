# Security Policy — Pollito

Pollito takes the security and privacy of our users and their Slack workspaces seriously. As a source-available application, our codebase is publicly auditable to provide transparency into how votes, tokens, and data are handled.

---

## Supported Versions

Only the latest release running in production receives active security updates and patches.

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2.0 | :x:                |

---

## Reporting a Vulnerability

If you discover a potential security vulnerability in Pollito, please report it responsibly so we can remediate it before public disclosure.

### How to Report

1. **Email us directly**: Send an email to **[security@tbelt.online](mailto:security@tbelt.online)** with the subject line `[SECURITY] Vulnerability Report - Pollito`.
2. **Do NOT open public GitHub issues**: Avoid opening public issues, discussions, or pull requests detailing undisclosed vulnerabilities.
3. **Include helpful details**:
   - Description of the vulnerability and its potential impact.
   - Exact steps, scripts, or payloads required to reproduce the issue.
   - Affected components, endpoints, or files.
   - Any remediation suggestions you might have.

### Response & Remediation Commitment

- **Initial Acknowledgment**: Within 3 business days of report receipt.
- **Triage & Assessment**: Within 7 days, with an initial severity classification.
- **Patch Release**: Critical security fixes will be deployed to production via our continuous deployment pipeline immediately upon verification.
- **Credit**: We will gladly credit your responsible disclosure in our release notes and changelog once the fix is deployed.

---

## Core Security & Privacy Invariants

Auditors and security reviewers can verify the following invariants directly within this repository:

1. **Double-Urn Cryptographic Privacy**: In anonymous polls, user IDs are never linked to their selected options in the database. Tokens are derived using `HKDF-SHA256` salted hashes, ensuring mathematical secrecy while preventing duplicate voting.
2. **Zero Third-Party AI / LLM Telemetry**: Pollito does not transmit poll questions, responses, channel names, or user data to external AI models (OpenAI, Anthropic, etc.). Execution is 100% deterministic and local.
3. **Data Minimization**: Stored records retain only operational parameters (poll questions, option text, vote counts, quorum targets, and closure timestamps). Pollito listens to channel message events and reads recent channel history only to detect Huddle threads. It keeps the thread timestamp of an active Huddle in memory and does not store message content.
4. **Least-Privilege Scopes**: The application requests the Slack scopes its features need: posting and updating poll messages, reading channel membership to calculate quorum, sending reminders, and reading messages to detect Huddles.
