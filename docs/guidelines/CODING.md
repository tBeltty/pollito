# Coding Standards & Best Practices

## Core Philosophy

Code is read far more often than it is written.
Clarity beats cleverness. Explicit beats implicit.

Every module and function optimizes for:
1. **Readability**: Reads like clean, natural prose.
2. **Predictability**: Zero hidden side effects; deterministic calculations.
3. **Correctness**: Strict TypeScript type-safety; runtime Zod schema validation.
4. **Resilience**: Graceful degradation when external APIs (Slack, SQLite) face network jitter or locks.

---

## 1. Code Style Rules

### Principles
1. **Explicit names over comments**: If a function or variable requires a comment to explain *what* it is, rename it.
2. **No abbreviations**: Use `remainingMinutes` instead of `remMin`; `speakerUserId` instead of `spkId`.
3. **Functions describe intent**: A function name must state its exact business action (`calculateModuleAllocations`, `concludeMeetup`).
4. **Early returns**: Eliminate nested `if` statements and boolean flags.

```typescript
// Good: Clear intent, early returns, descriptive naming
export function validateMeetupTimebox(totalMinutes: number, modules: SubtopicInput[]): void {
  if (totalMinutes <= 0) {
    throw new ValidationError("Total minutes must be greater than zero.");
  }
  const sum = modules.reduce((acc, m) => acc + m.percentage, 0);
  if (sum !== 100) {
    throw new ValidationError(`Percentages must sum to 100%. Received: ${sum}%.`);
  }
}

// Bad: Ambiguous flags, deep nesting, cryptic names
export function chkTime(t: number, m: any[], flg: boolean) {
  if (flg) {
    if (t > 0) {
      // nested logic...
    }
  }
}
```

---

## 2. File & Architecture Design

### Single Responsibility Rule
A file must change for only one reason:
- `src/slack/ui/`: Pure Block Kit view builders (no database access, no side effects).
- `src/slack/handlers/`: Event/action routing and UI responses.
- `src/services/`: Core domain logic, math, timebox allocations, and database queries.
- `src/scheduler/`: Background periodic heartbeat loops (`timerWorker.ts`).

### Time and Zones
1. Store instants as UTC `Date`s; convert wall-clock input and display only at the edges with `src/utils/timezone.ts`.
2. View builders receive dates and times as arguments. They never call `new Date()`, so the same input always renders the same view.
3. A time shown to a person always carries its zone (`10:00 AM PT`).

### Immutability First
1. Never mutate input arguments or parameters.
2. Return new arrays or objects when computing state or schedule offsets.
3. Use `const` by default; avoid `let` unless strictly managing accumulator loops.

---

## 3. Error Handling & Slack Boundaries

1. **Never crash the process**: Wrap Slack API calls in localized `try/catch` blocks. If an ephemeral message or DM fails to deliver, log the failure and allow the main heartbeat ticker to continue.
2. **User-facing errors must be actionable**: Provide clear Block Kit feedback instead of cryptic stack traces.
3. **Structured logging**: Use standardized loggers with contextual metadata (`meetupId`, `channelId`, `elapsedMinutes`).
