# Repository & Git Hygiene Standards

This guideline defines commit formatting, GitHub Actions naming conventions, repository cleanliness, and public-facing engineering standards for Pollito.

---

## 1. Professional Commit Conventions

Every commit message is public-facing engineering documentation. Messages must adhere to Conventional Commits:

```text
<type>(<scope>): <imperative summary>
```

### Standard Types
- `feat`: New feature or user-facing functionality.
- `fix`: Bug fix or error resolution.
- `refactor`: Code modification that neither adds a feature nor fixes a bug.
- `docs`: Documentation updates, README changes, or architecture guides.
- `style`: Formatting, whitespace, or code cleanup with no logic change.
- `chore`: Dependency updates, build configurations, or asset additions.
- `ci`: Changes to GitHub Actions workflows or runner configs.

### Public-Facing Terminology Policy
Never leak internal agent directives, prompt names, or colloquial procedures into commit messages, PR titles, or branch names. Use established industry terminology:

| Prohibited Internal Term | Standard Engineering Term |
| :--- | :--- |
| *noaislop / anti-ai slop* | **Editorial review / Copy refinement / Tone review** |
| *slop cleanup / slop fix* | **Text clarity / Copywriting polish** |
| *css slop* | **UI styling compliance / Design token alignment** |
| *bot polish* | **Code cleanup / Linting compliance** |

---

## 2. GitHub Actions & CI Pipeline Hygiene

1. **Descriptive Step & Job Names**:
   - CI steps must use clear, professional labels:
     - ✅ `Checkout repository`
     - ✅ `Typecheck & Compile TypeScript`
     - ✅ `Editorial & Style Compliance`
   - Workflow run titles reflect the head commit message, so keeping commit messages clean guarantees a clean Actions run dashboard.

2. **Run History Maintenance**:
   - If an accidental commit with irregular formatting triggers a workflow run, the run should be deleted via GitHub CLI (`gh run delete <run_id>`) once the commit is amended.

---

## 3. Working Tree & State Hygiene

1. **Zero Secret Leakage**:
   - `.env`, SQLite databases (`*.db`), credentials, and Slack tokens must never be tracked by git (`.gitignore` enforcement).
2. **Deterministic Builds**:
   - `pnpm-lock.yaml` must always be committed and synchronized with `package.json`.
   - Never commit ad-hoc dependency modifications without testing clean compilation (`pnpm build`).
3. **Artifact Isolation**:
   - Compiled output (`dist/`), scratch scripts, and temporary inspection files belong in `.gitignore`.
