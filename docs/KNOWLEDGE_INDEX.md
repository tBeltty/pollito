# Pollito — Master Knowledge & Skills Index

Este documento centraliza el mapa de navegación completo a todos los recursos de conocimiento, guías normativas, perfiles de producto y habilidades (`skills`) disponibles en **Pollito**.

---

## 🧭 1. Suite de Skills (`.agents/skills/`)

Pollito integra 13 habilidades de alto impacto para arquitectura de apps en Slack, distribución, seguridad, Block Kit, redacción publicitaria, erradicación de sesgo sintético y comparativas competitivas:

| Habilidad | Archivo Principal | Referencias | Propósito y Activación |
| :--- | :--- | :--- | :--- |
| **`slack-block-kit`** | [`SKILL.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/slack-block-kit/SKILL.md) | — | Composición de Block Kit (límite 50 bloques), modales dinámicos (`views.open`/`views.update`), respuesta `view_submission` en $\le 3$s, errores inline (`response_action: "errors"`), App Home (`views.publish`) y actualizaciones in-place (`chat.update`). |
| **`slack-security-auth`** | [`SKILL.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/slack-security-auth/SKILL.md) | — | Verificación criptográfica HMAC-SHA256 (`timingSafeEqual`, ventana replay 5 min), ciclo de vida de tokens (`xoxb`, `xoxp`, rotación `xoxe` cada 12h), cifrado de tokens multi-tenant y aislamiento Enterprise Grid (`enterprise_id`). |
| **`slack-bolt-architecture`** | [`SKILL.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/slack-bolt-architecture/SKILL.md) | — | Arquitectura de backend Bolt (Socket Mode vs HTTP Webhooks), regla de `ack()` en $\le 3$s, deduplicación idempotente de retries (`X-Slack-Retry-Num`), gobernanza de rate limits (Tiers 1–4, HTTP 429 con backoff y jitter) y resiliencia de procesos. |
| **`slack-ai-agents`** | [`SKILL.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/slack-ai-agents/SKILL.md) | — | Arquitectura de asistentes y agentes de IA en Slack (`assistant_thread_started`), indicadores de pensamiento en tiempo real (`assistant.threads.setStatus`), integración con Model Context Protocol (MCP) y flujos human-in-the-loop en hilos. |
| **`slack-app-distribution`** | [`SKILL.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/slack-app-distribution/SKILL.md) | — | Gestión del ciclo de vida del manifest de Slack, flujos OAuth 2.0 multi-workspace, triggers de reinstalación (`permissions_updated: true`) y despliegue CI/CD. |
| **`competitor-alternatives`** | [`SKILL.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/competitor-alternatives/SKILL.md) | • [`content-architecture.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/competitor-alternatives/references/content-architecture.md)<br>• [`templates.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/competitor-alternatives/references/templates.md) | Creación de páginas de comparativa de competidores (*Pollito vs Simple Poll*, *Pollito vs Polly*) para SEO y conversión. |
| **`copywriting`** | [`SKILL.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/copywriting/SKILL.md) | • [`copy-frameworks.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/copywriting/references/copy-frameworks.md)<br>• [`natural-transitions.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/copywriting/references/natural-transitions.md) | Redacción y reescritura de landing pages, secciones de producto, pricing y llamadas a la acción (CTA). |
| **`copy-editing`** | [`SKILL.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/copy-editing/SKILL.md) | • [`plain-english-alternatives.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/copy-editing/references/plain-english-alternatives.md) | Edición sistemática de copia mediante pases enfocados en claridad, ritmo y reducción de fricción verbal (The Seven Sweeps). |
| **`text-humanizer`** | [`SKILL.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/text-humanizer/SKILL.md) | — | Reescribe textos sintéticos en prosa humana natural. Calibra variación oracional (*burstiness*), protege tokens inmutables y busca legibilidad Flesch 60–70. |
| **`ogilvy`** | [`SKILL.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/ogilvy/SKILL.md) | — | Principios publicitarios de David Ogilvy orientados a ventas: posicionamiento claro, promesas verificables y lógica visual. |
| **`content-strategy`** | [`SKILL.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/content-strategy/SKILL.md) | — | Planificación de contenidos, clusters temáticos y calendario editorial para atracción orgánica. |
| **`proofreading`** | [`SKILL.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/proofreading/SKILL.md) | — | Barrido mecánico de ortografía, puntuación y gramática en español e inglés sin reescribir la estructura del mensaje. |
| **`paragraph-structure`** | [`SKILL.md`](file:///Users/jhonatan/Documents/pollito/.agents/skills/paragraph-structure/SKILL.md) | — | Diagnóstico y división de límites de párrafo para evitar bloques densos y optimizar la escaneabilidad visual. |

---

## 🏛️ 2. Manuales Centrales de Operación

* **[Manual de Operaciones y Credenciales (`OPERATIONS.md`)](file:///Users/jhonatan/Documents/pollito/OPERATIONS.md)**  
  Manual maestro de arquitectura técnica, administración de VPS (`mi-vps`), comandos PM2, Nginx, pipeline CI/CD en GitHub Actions, guía de credenciales de Slack y scripts interactivos Blind-Secret.
* **[Central Agentic Guidelines (`AGENTS.md`)](file:///Users/jhonatan/Documents/pollito/AGENTS.md)**  
  Manual de operaciones obligatorio para agentes autónomos. Invariantes de votación y privacidad, secret ballots, Slack Block Kit y anti-slop.
* **[Product Specification (`PRODUCT.md`)](file:///Users/jhonatan/Documents/pollito/PRODUCT.md)**  
  Especificación técnica y de producto: plataforma, stack, usuarios objetivo y posicionamiento.
* **[Product Brief Detallado (`pollito_product_brief.md`)](file:///Users/jhonatan/Documents/pollito/pollito_product_brief.md)**  
  Documento de definición de producto, comparativa de mercado, vistas de Slack Block Kit y modelo de precios.

---

## 🛡️ 3. Guías Normativas de Ingeniería (`docs/guidelines/`)

* **[Coding Standards & Architecture](file:///Users/jhonatan/Documents/pollito/docs/guidelines/CODING.md)**: Estructura TypeScript, inmutabilidad y separación de responsabilidades.
* **[UI, Block Kit & Styling](file:///Users/jhonatan/Documents/pollito/docs/guidelines/UI_SLACK_BLOCKS_CSS.md)**: Jerarquía visual en Block Kit, barras de progreso y diseño web limpio.
* **[Editorial Standards & Writing Hygiene](file:///Users/jhonatan/Documents/pollito/docs/guidelines/EDITORIAL_STANDARDS.md)**: Tono directo, erradicación de clichés sintéticos e inglés estricto en Slack.
* **[Security & Token Standards](file:///Users/jhonatan/Documents/pollito/docs/guidelines/SECURITY.md)**: Cifrado de tokens, scopes mínimos y esquemas Zod en tiempo de ejecución.
* **[Definition of Done (DoD)](file:///Users/jhonatan/Documents/pollito/docs/guidelines/DEFINITION_OF_DONE.md)**: Criterios no negociables para considerar completada una tarea.
* **[Release Process & Versioning Standards](file:///Users/jhonatan/Documents/pollito/docs/guidelines/RELEASE_PROCESS.md)**: Versionado SemVer, changelog atómico y tags de release.

---

## 🔒 4. Documentación Técnica Interna (`docs/internal/` — Privada / Gitignored)

* **[Technical Guide to Building Enterprise-Grade Slack Applications](file:///Users/jhonatan/Documents/pollito/docs/internal/technical-guide-building-slack-apps.md)**:  
  Manual maestro exhaustivo de arquitectura empresarial en Slack (756 líneas). Abarca arquitectura de plataforma, modelos de despliegue, seguridad criptográfica, diseño avanzado de Block Kit, agentes de IA/MCP, gobernanza en Enterprise Grid/GovSlack y políticas de cumplimiento para el Slack Marketplace. *(Protegido por `.gitignore`, no se sube a GitHub).*

---

## 🤖 5. Matriz de Subagentes Especializados

* **`slack_buddy`**: Arquitecto de plataforma Slack, Bolt framework, vistas Block Kit, seguridad criptográfica, OAuth 2.0 y resiliencia de eventos.
* **`wordsmith`**: Director editorial, redactor de conversión, auditor de Anti-AI Slop, higiene de Conventional Commits y curaduría de changelogs bajo Keep a Changelog 1.1.0.


