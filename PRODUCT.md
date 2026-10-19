# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/modern JS (Vanilla modern web, TTFB <100ms, zero-runtime build dependencies, served via Nginx/Caddy on VPS).

## Users

- **Primary**: Tech Leads, Engineering Managers, Scrum Masters, and Product Managers coordinating remote/hybrid teams in Slack.
- **Secondary**: Team members who need fast, frictionless voting without context switching or leaving Slack threads.
- **Enterprise Admins**: Workspace administrators seeking clear privacy policies, low permissions footprint, and budget predictability (freemium base with planned $15/month flat-rate Pro tier per workspace vs per-seat pricing).

## Product Purpose

Pollito is a native Slack application for team decision-making and consensus-building. It combines interactive in-channel polls (with quorum detection, deadline auto-closing, secret ballots, and smart nudges) with a complete analytical command center built directly inside Slack's **App Home** tab, backed by an authoritative, zero-bloat web surface at `pollito.tbelt.online`.

## Positioning

Unlike market leaders (Simple Poll, Polly) that enforce punitive per-seat pricing, force users out of Slack into external web dashboards, or require invasive permissions, Pollito:
1. Keeps 100% of the operational and analytical experience inside Slack (App Home dashboard).
2. Features automatic quorum-based and time-based closing, plus smart nudges to non-voters without exposing voter identity.
3. Operates on a Freemium base (100% Free during launch) with a planned $15/month flat-rate Pro tier per workspace (and enterprise tiers for advanced governance), zero external AI dependencies, and $0 marginal cost per vote.
4. Embodies a charming, memorable brand mascot (Pollito) with reactive micro-expressions, balancing warmth with technical sobriety.

## Operating Context

- Slack channels, threads, and App Home tabs across desktop, mobile (iOS/Android), and browser clients.
- Web presence on `pollito.tbelt.online` fulfilling Slack App Directory requirements: high-converting landing page, installation flow ("Add to Slack"), Privacy Policy, Terms of Service, and Support documentation.

## Capabilities and Constraints

- **Backend**: Node.js, TypeScript, `@slack/bolt`, Prisma ORM with SQLite in WAL mode.
- **Transport**: Dual mode (Socket Mode for development, HTTPReceiver for production).
- **Web Frontend**: Native HTML5, modern CSS (Custom Properties, Container Queries, `:has()`, Fluid Typography), vanilla JavaScript.
- **Voting Mechanics**: Single-choice, multiple-choice, secret ballot (double-urn architecture with HKDF-SHA256 salted tokens), quorum thresholds (50%, 66%, 75%, 80%, 100%), time-based closing (15m, 1h, 4h, 24h, 72h) with automated background timer worker, manual creator closing, and smart nudges.
- **Editorial Standard**: Strict Anti-AI Slop prose protocol, zero binary contrasts, zero colon reveals, zero em-dashes in Block Kit, 100% tuteo in Spanish, native direct English for Slack Directory.

## Brand Commitments

- **Name**: Pollito.
- **Mascot**: Pollito (cute chicken, modern flat 2.0 vector illustration, clean lines, SVG scalable, with reactive micro-expressions: 🐣 waiting for first vote, 🧐 active voting in progress, 🎉 quorum reached, ⏰ closed or expired).
- **Tone**: Warm, concise, direct, technically precise. Playful in micro-expressions; completely sober in data, numbers, and mechanics.
- **Visual Style**: Modern vector illustration (Linear/Duolingo clean aesthetic), crisp typography, purposeful motion, zero template fluff.

## Evidence on Hand

- Comprehensive product specification in [`pollito_product_brief.md`](pollito_product_brief.md).
- Verified DNS zone control on `tbelt.online` via Cloudflare API.
- Architecture and engineering patterns proven in production Bolt architectures.

## Product Principles

1. **Decisions inside Slack**: Never force users into external web logins for core interactions or analytics.
2. **Cryptographic Privacy by Architecture**: Secret ballots use a decoupled double-urn model; even database administrators cannot link a user to their vote.
3. **Zero Waste Infrastructure**: Algorithmic clarity over LLM hype. Fast, deterministic execution with 0 tokens consumed.
4. **Delight Without Noise**: Character micro-expressions convey status instantly without cluttering channel conversations with excessive text.
