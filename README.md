# 🐣 Pollito — Slack Polling & Consensus Bot

Pollito es una aplicación nativa de Slack para votaciones de equipo rápidas (públicas y anónimas mediante doble urna criptográfica), con barras de progreso en vivo, cierre automático por quórum o temporizador y sin costo.

* **Dominio oficial en producción**: [pollito.tbelt.online](https://pollito.tbelt.online)
* **Verificación de salud**: [`https://pollito.tbelt.online/healthz`](https://pollito.tbelt.online/healthz)

---

## 📚 Documentación y Operaciones

Toda la información técnica detallada sobre infraestructura, despliegue y credenciales se encuentra documentada en:

* **[Manual de Operaciones y Arquitectura (`OPERATIONS.md`)](OPERATIONS.md)**:
  * Arquitectura técnica y modos de transporte (HTTP Nativo vs Socket Mode).
  * Guía de credenciales, tokens y dónde encontrarlos en la consola de Slack.
  * Ingestión segura bajo el **Blind-Secret Protocol** (scripts interactivos con `read -s`).
  * Administración del servidor VPS (`mi-vps`), Nginx, logs y comandos de PM2.
  * Pipeline de CI/CD en GitHub Actions con compuerta de humo y rollback automático.
  * Configuración de la Slack App y scopes requeridos en `manifest.json`.
  * Modelo de datos Prisma/SQLite y diseño de doble urna anónima.

---

## 🛠️ Stack Tecnológico

* **Runtime**: Node.js 22 + TypeScript
* **Framework Slack**: `@slack/bolt` (modo HTTP ExpressReceiver en producción)
* **Base de Datos**: SQLite en modo WAL + Prisma ORM
* **Servidor Web & Proxy**: Nginx + SSL Let's Encrypt + Cloudflare
* **Process Manager**: PM2 en `mi-vps` (proceso `pollito` en puerto 3015)
* **CI/CD**: GitHub Actions con Self-Hosted Runner en VPS

---

## 🚀 Desarrollo Local y Pruebas

```bash
# Instalar dependencias
pnpm install

# Generar cliente de base de datos
pnpm db:generate
pnpm db:push

# Ejecutar suite de pruebas (Vitest + Anti-AI Slop Gate)
pnpm test

# Compilar TypeScript
pnpm build
```
