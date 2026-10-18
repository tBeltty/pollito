# Definition of Done (DoD)

A task, feature, or pull request is only considered **DONE** when it meets all of the following criteria:

---

## 1. Code & Type Safety
- [ ] TypeScript compiles cleanly with zero errors (`pnpm build`).
- [ ] No `any` types or bypasses; all models and DTOs are strictly typed.
- [ ] Core business logic passes mathematical percentage and rounding checks.

## 2. CI/CD, Deployment & Repository Hygiene
- [ ] Working tree is clean (`git status` shows no unstaged or uncommitted changes).
- [ ] All code, migrations, tests, and capabilities logs are committed with Conventional Commits.
- [ ] Changes are pushed to `origin/main` (never left in local-only state).
- [ ] The GitHub Actions CI/CD workflow (`ci.yml`) runs and completes 100% green (`✓`).
- [ ] Production deployment on the VPS is executed automatically by the CD runner with zero manual SSH or file copying required.
- [ ] Git commit messages and GitHub Actions titles follow professional engineering terminology.
- [ ] No untracked secrets, `.env` files, or temporary database artifacts in repository.

## 3. UI, Copywriting & Writing Hygiene
- [ ] Slack Block Kit layouts render cleanly across mobile and desktop.
- [ ] All notifications and documentation pass the Writing Hygiene check (no binary contrasts, no colon reveals, direct human cadence).
- [ ] English language policy is maintained across 100% of user-facing strings and code comments.

## 4. Operational Readiness & Verification
- [ ] Automated smoke check against `https://pollito.tbelt.online/healthz` returns status `ok`.
- [ ] Graceful shutdown verified on `SIGINT` / `SIGTERM`.
- [ ] Error scenarios log meaningful diagnostics without crashing the background worker.
- [ ] Zero manual VPS intervention: SSH is reserved exclusively for read-only log inspection.

## 5. Versioning, Changelog & GitHub Releases (Zero User Reminders)
> Applies to changes in the Pollito Slack app only. Website, SEO, docs, tests and tooling changes skip this section and are logged in `docs/PRODUCT_CAPABILITIES_LOG.md` (see `RELEASE_PROCESS.md`, section 0).
- [ ] Version bumped in `package.json` according to SemVer (`pnpm version:patch` for fixes/minor tweaks, `pnpm version:minor` for features).
- [ ] `CHANGELOG.md` updated under a new version block following Keep a Changelog 1.1.0 with comparison diff links updated at the bottom.
- [ ] Capabilities logged at the very top of `docs/PRODUCT_CAPABILITIES_LOG.md` in reverse-chronological order.
- [ ] Annotated git tag (`vX.Y.Z`) created and pushed to `origin`.
- [ ] Automated release workflow (`.github/workflows/release.yml`) monitored until green and GitHub Release verified published (`gh release view vX.Y.Z`).
- [ ] **Zero Prompts**: The user must NEVER have to remind the agent to bump versions, update changelogs, or cut releases. Every task is incomplete until this is done.

