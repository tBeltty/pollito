# Editorial Standards & Writing Hygiene — HuddlePace

This guideline governs all text, Slack Block Kit copy, bot notifications, modals, web marketing copy, documentation, and communications in HuddlePace.

---

## 1. Writing Hygiene Directive & Anti-AI Slop

All copy must adhere to direct, natural human cadence and eliminate predictable rhetorical tropes that inflate word count, dilute clarity, or trigger AI-generation fingerprints.

### Banned Rhetorical Patterns
1. **Binary Contrast Openers**:
   - ❌ *"HuddlePace isn't just a timer, it's your meeting copilot."*
   - ❌ *"No es solo un cronómetro, es un copiloto de agilidad."*
   - ✅ *"HuddlePace keeps meetings inside their scheduled timeboxes."*
   - ✅ *"HuddlePace distribuye y controla los bloques de tiempo de tu llamada en Slack."*
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
   - ❌ *"Teams use HuddlePace in two primary scenarios, depending on need:"*
   - ✅ *"Use `/pace start` for structured agendas or `/pace 15m` for open timers."*
6. **Portability Test Violations**:
   - If a sentence can be copy-pasted into any generic corporate SaaS website without conveying concrete project facts, cut it or replace it with specific numbers, commands, and actions.

### Banned Lexicon
delve, foster, leverage, utilize, facilitate, empower, streamline, robust, cutting-edge, paradigm shift, game changer, tapestry, realm, beacon, multifaceted, meticulous, paramount, transformative, elevate, embark, supercharge, harness, ever-evolving, world-class, revolutionary, best-in-class, synergize, holistic, seamless, trailblazing.

---

## 2. Voice & Tone: Vector the Falcon (*Flight Pacer*)

Vector is a Peregrine Falcon from the Vibecoder Universe. His role is flight navigator and cadence keeper:
- **Calm & Telemetric**: Communicates clear flight telemetry (time remaining, active topic, holding patterns). Never panics and never scolds.
- **Supportive, Not Accusatory**: Timekeeping is socially sensitive. Never act like an abrasive "meeting cop" (*"Time's up! Stop talking!"*). Offer neutral status (*"1 minute remaining in Architecture Review. Holding pattern available."*).
- **Physical Concrete Verbs**: Use direct actions ("wrap up current topic", "move to Q&A block", "close huddle") instead of corporate abstractions ("optimize transitional momentum").

---

## 3. Language & Internationalization Policy

### 1. Strict English Policy for Slack UI
- **100% of Slack in-app text must be in English**: Block Kit cards, section headers, modal inputs, button text, overflow menus, ephemeral errors, and DM notifications.
- Slack workspaces are often multi-cultural and global. English is the universal baseline for all bot interactions.

### 2. Marketing & Documentation (Bilingual ES / EN)
When drafting Spanish copy for marketing (`marketing/`), target niches (`docs/TARGET_NICHES.md`), or internal guides:
- **NEVER voseo. Always tuteo**: Use `tú`/`tu` conjugations (sube, tienes, puedes, elige), never `vos` (subí, tenés, podés, elegí).
- **Translate meaning, never words**: Translate the *intent* in natural target-language idiom. Literal word-for-word calques corrupt nuance.
- **Pan-regional Spanish**: Avoid hyper-regional slang or peninsular-only terms ("móvil", "céntimo", "apetecer"). Use neutral terminology ("teléfono", "centavos", "reunión").

---

## 4. Skills & Execution Suite

Autonomous agents and contributors must leverage the tracked skills in `.agents/skills/`:
- [`no-ai-slop`](../../.agents/skills/no-ai-slop/SKILL.md): Proactive pass on every user-facing draft.
- [`text-humanizer`](../../.agents/skills/text-humanizer/SKILL.md): Burstiness calibration and fact-shielding for Slack tokens.
- [`copywriting`](../../.agents/skills/copywriting/SKILL.md) & [`copy-editing`](../../.agents/skills/copy-editing/SKILL.md): Conversion copywriting and the Seven Sweeps framework.
- [`proofreading`](../../.agents/skills/proofreading/SKILL.md): Mechanical grammar and punctuation review.
- [`paragraph-structure`](../../.agents/skills/paragraph-structure/SKILL.md): Beat segmentation and paragraph break checks.
- [`COPYWRITING_PLAYBOOK.md`](../marketing/COPYWRITING_PLAYBOOK.md): The master 14-step anti-AI pipeline.

---

## 5. Pre-Submission Checklist

Before committing any Slack notification copy, marketing text, or documentation:
- [ ] Does it state the actual time remaining, topic, or command within the first 10 words?
- [ ] Is it free of binary contrasts (*"not X, but Y"*), colon reveals, and corporate buzzwords?
- [ ] Is Slack Block Kit copy strictly in English?
- [ ] If Spanish is used in marketing/docs, is it 100% tuteo with zero voseo?
- [ ] Are all protected tokens (`/pace`, minutes, Slack user/channel IDs) preserved accurately?
- [ ] Does it sound like a focused teammate speaking directly to a peer?
