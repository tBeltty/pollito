# Editorial Standards & Writing Hygiene — Pollito

This guideline governs all text, Slack Block Kit copy, bot notifications, modals, web marketing copy, documentation, and communications in Pollito.

---

## 1. Writing Hygiene Directive & Anti-AI Slop

All copy must adhere to direct, natural human cadence and eliminate predictable rhetorical tropes that inflate word count, dilute clarity, or trigger AI-generation fingerprints.

### Banned Rhetorical Patterns
1. **Binary Contrast Openers**:
   - ❌ *"Pollito isn't just a polling bot, it's your consensus engine."*
   - ❌ *"No es solo una encuesta, es un motor de consenso."*
   - ✅ *"Pollito runs public and anonymous polls that close when quorum is met."*
   - ✅ *"Pollito gestiona votaciones y quórum directamente en Slack."*
2. **Theatrical Throat-Clearing & Colon Reveals**:
   - ❌ *"Here's the kicker: we went overtime."*
   - ❌ *"The result: meetings finish on time."*
   - ✅ *"We exceeded the scheduled 45 minutes."*
   - ✅ *"Meetings stay on schedule."*
3. **Corporate Fluff & Agile Buzzwords**:
   - ❌ *"Empowering agile teams to synergize their communication and supercharge velocity."*
   - ✅ *"Preventing 15-minute standups from turning into 45-minute technical debates."*
4. **Symmetrical Tripartite Structures**:
   - ❌ *"It tracks your agenda, alerts the speaker, and frees your team."*
   - ✅ *"It tracks agenda modules and pings the speaker before overtime."*
5. **Slide-Transition Scaffolding**:
   - ❌ *"Teams use Pollito in two primary scenarios, depending on need:"*
   - ✅ *"Use `/pollito` for interactive modals or `/pollito "Question" "A" "B"` for quick polls."*
6. **Portability Test Violations**:
   - If a sentence can be copy-pasted into any generic corporate SaaS website without conveying concrete project facts, cut it or replace it with specific numbers, commands, and actions.

### Banned Lexicon
delve, foster, leverage, utilize, facilitate, empower, streamline, robust, cutting-edge, paradigm shift, game changer, tapestry, realm, beacon, multifaceted, meticulous, paramount, transformative, elevate, embark, supercharge, harness, ever-evolving, world-class, revolutionary, best-in-class, synergize, holistic, seamless, trailblazing.

---

## 2. Voice & Tone: Pollito the Chick (*Consensus Pacer*)

Pollito is a focused, friendly chick who facilitates team decisions with warmth and mathematical precision:
- **Calm & Objective**: Communicates clear consensus telemetry (votes cast, quorum percentage, remaining time). Never scolds and never pressures non-voters.
- **Supportive & Discreet**: Voting and consensus can be sensitive. Protect voter privacy strictly. In anonymous polls, never reveal voter identities.
- **Micro-Expressions**: Expresses state cleanly with mascot emojis:
  - 🐣 Hatching / New poll
  - 🧐 Focused / Waiting for quorum
  - 🎉 Consensus reached / Quorum met
  - ⏰ Time expired / Closed
- **Physical Concrete Verbs**: Use direct actions ("vote for an option", "reach quorum", "close poll") instead of corporate abstractions ("empower alignment").

---

## 3. Language & Internationalization Policy

### 1. Slack UI Language (English default, Spanish supported)
- **English is the base catalog** (`src/i18n/catalogs/en.ts`) and the fallback for any Slack language Pollito does not support. Spanish lives in `es.ts` with identical keys and parameters.
- Every user-facing string in Block Kit cards, section headers, modal inputs, button text, overflow menus, ephemeral errors, and DM notifications goes through the catalogs. Never throw or post hard-coded English text; throw `LocalizedError` and render it with `describeError`.
- **Button, label, and title text uses sentence case** ("Close poll", not "Close Poll").
- **Use the same names the product uses**: *Reminders* (not "Smart Nudges"), *Huddle* (also in Spanish), *Pollito managers*. Do not expose internal terms such as double-urn or ballot pools in the interface.
- **Spanish stays pan-regional**: "promedio", not "media"; "Huddle", not "junta de voz".

### 2. Marketing & Documentation (Bilingual ES / EN)
When drafting Spanish copy for marketing (`marketing/`), target niches (`docs/TARGET_NICHES.md`), or internal guides:
- **NEVER voseo. Always tuteo**: Use `tú`/`tu` conjugations (sube, tienes, puedes, elige), never `vos` (subí, tenés, podés, elegí).
- **Translate meaning, never words**: Translate the *intent* in natural target-language idiom. Literal word-for-word calques corrupt nuance.
- **Pan-regional Spanish**: Avoid hyper-regional slang or peninsular-only terms ("móvil", "céntimo", "apetecer"). Use neutral terminology ("teléfono", "centavos", "reunión").
