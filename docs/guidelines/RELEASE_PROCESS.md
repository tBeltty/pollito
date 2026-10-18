# Release Process & Versioning Standards

This document establishes the release lifecycle, versioning protocol, changelog hygiene, and automated GitHub Releases pipeline for Pollito.

> [!IMPORTANT]
> **Mandatory Autonomous Execution Directive (Zero User Reminders)**
> AI agents and contributors must execute the complete release protocol proactively for every functional, UI, schema, or configuration update. The user must **NEVER** have to ask or remind the agent to update `CHANGELOG.md`, bump the version in `package.json`, or deploy the release tag. If code was modified, the task is **NOT DONE** until the release is live on GitHub.

---

## 0. What Gets a Release

Releases, tags, `CHANGELOG.md` entries and version bumps are **only for the Pollito Slack app**: bot behavior, commands, modals, App Home, notifications, OAuth, data and anything else a workspace admin or team member would notice.

These changes get **no** version bump, tag, changelog entry or GitHub Release:
- The website: pages in `public/`, SEO, structured data, fonts, images, `sitemap.xml`, `robots.txt`, the 404 page and site performance.
- Documentation, tests, scripts and other tooling.

Record those in [`docs/PRODUCT_CAPABILITIES_LOG.md`](../PRODUCT_CAPABILITIES_LOG.md), push to `main` and let CI deploy them. `pnpm test` enforces this: `tests/changelogStyle.test.ts` rejects release-note bullets that mention the website, tests, docs or tooling.

---

## 1. Versioning Architecture (SemVer 2.0.0)

Pollito follows [Semantic Versioning 2.0.0](https://semver.org/):

```text
MAJOR.MINOR.PATCH (e.g., 0.2.0)
```

- **MAJOR (`x.0.0`)**: Incompatible API breaks, destructive database migrations, major architectural pivots, or breaking Slack manifest changes requiring manual workspace re-authorization.
- **MINOR (`0.x.0`)**: Backwards-compatible new features, new Slack commands/interactivity, new web views, or additive database schema migrations.
- **PATCH (`0.0.x`)**: Backwards-compatible bug fixes, UI styling refinements, security patches, performance improvements, or documentation updates.

---

## 2. Changelog Standards (Keep a Changelog 1.1.0)

Every user-facing or architectural change is recorded in [CHANGELOG.md](../../CHANGELOG.md) adhering to [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).

### Required Section Headers
Under any version header, changes must be classified under these standard categories:
- `### Added`: New capabilities or interfaces.
- `### Changed`: Changes in existing functionality or design.
- `### Deprecated`: Features slated for removal in forthcoming releases.
- `### Removed`: Features excised from the codebase.
- `### Fixed`: Bug fixes, security vulnerabilities, or error handling adjustments.
- `### Security`: Hardening, token handling, or vulnerability mitigations.

### Comparison Links
Every version in `CHANGELOG.md` must maintain Markdown anchor and diff links at the foot of the document:
```markdown
[Unreleased]: https://github.com/tBeltty/pollito/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/tBeltty/pollito/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/tBeltty/pollito/releases/tag/v0.1.0
```

---

## 3. Step-by-Step Release Protocol

Execute this sequential protocol when releasing a new version:

### Step 1: Pre-Release Quality Gate
Run full verification locally:
```bash
pnpm test
pnpm typecheck
pnpm build
```
All unit, integration, and UI tests must pass with 0 failures.

### Step 2: Prepare the Changelog
The release workflow publishes the version block of `CHANGELOG.md` verbatim as the GitHub Release notes, so review it **before** committing and tagging, never after. It describes the Slack product only (see section 0):
- Write plain sentences about what changed for visitors or maintainers. Keep implementation detail in `docs/PRODUCT_CAPABILITIES_LOG.md`.
- Run the [`no-ai-slop`](../../.agents/skills/no-ai-slop/SKILL.md) pass against [EDITORIAL_STANDARDS](EDITORIAL_STANDARDS.md): no colon reveals or `**Label**:` openers, no banned lexicon, no em dashes, no binary contrasts.
- `pnpm test` enforces this through `tests/changelogStyle.test.ts` for every entry after 1.4.0.

1. In `CHANGELOG.md`, move items from `## [Unreleased]` into a new version block:
   ```markdown
   ## [1.0.2] - YYYY-MM-DD

   ### Fixed
   - ...
   ```
2. Update the diff comparison links at the bottom of `CHANGELOG.md`.

### Step 3: Bump `package.json`
Use the preconfigured npm scripts to bump the version without creating an automatic git tag yet:
```bash
pnpm version:patch   # for 1.0.1 -> 1.0.2
# or
pnpm version:minor   # for 1.0.1 -> 1.1.0
# or
pnpm version:major   # for 1.0.1 -> 2.0.0
```

### Step 4: Update Capabilities Log
Document functional additions at the top of [`docs/PRODUCT_CAPABILITIES_LOG.md`](../PRODUCT_CAPABILITIES_LOG.md) under the corresponding date.

### Step 5: Commit and Deploy to `main`
Commit the release preparation and push to `main` to trigger the CI/CD pipeline:
```bash
git add package.json CHANGELOG.md docs/PRODUCT_CAPABILITIES_LOG.md
git commit -m "chore(release): prepare v1.0.2"
git push origin main
```
Monitor the GitHub Actions CI/CD deployment until green (`✓`):
```bash
gh run list --limit 1
gh run watch <run_id> --exit-status
```
Verify the production health check reflects the new version:
```bash
curl -sS https://pollito.tbelt.online/healthz
```

### Step 6: Create Annotated Git Tag & Push
Once the code is verified live in production, create an annotated Git tag matching the SemVer release:
```bash
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin v0.2.0
```

### Step 7: Automated GitHub Release Workflow
Pushing a tag matching `v*.*.*` automatically triggers `.github/workflows/release.yml`. This workflow:
1. Extracts the exact release notes corresponding to that version from `CHANGELOG.md`.
2. Creates or updates the official GitHub Release with release notes attached via the GitHub CLI.

Verify the release on GitHub:
```bash
gh release view v0.2.0
```
or visit `https://github.com/tBeltty/pollito/releases`.
