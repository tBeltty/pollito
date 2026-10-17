# Documento de Definición de Producto: Pollito para Slack

## 1. Resumen Ejecutivo y Visión

**Pollito** es una aplicación nativa para Slack diseñada para simplificar y dinamizar la toma de decisiones en equipo. Combina la agilidad de las votaciones instantáneas en canal con un centro de control analítico integrado directamente en la pestaña **App Home** de Slack, sin exigir permisos invasivos, sin depender de servicios externos de IA y con una identidad visual cercana y memorable.

* **Nombre del producto:** Pollito
* **Mascota:** Un pollito tierno (*cute chicken*) con micro-expresiones según el estado de la votación.
* **Comando principal:** `/pollito` o `/poll`
* **Lema:** *Decisiones claras en equipo, sin salir de Slack.*

---

## 2. Diagnóstico del Mercado y Oportunidad

Tras analizar las 10 principales soluciones del Slack Marketplace ([Simple Poll](https://www.google.com/search?q=https%3A%2F%2Fslack.com%2Fmarketplace%2FA0HFW7MR6-simple-poll), [Polly](https://www.google.com/search?q=https%3A%2F%2Fslack.com%2Fmarketplace%2FA04E6JX41-polly), [Standuply](https://www.google.com/search?q=https%3A%2F%2Fslack.com%2Fmarketplace%2FA355V71K7-standuply-poll-survey-todo-bot), [Pulsy](https://www.google.com/search?q=https%3A%2F%2Fslack.com%2Fmarketplace%2FA0693E57F6V-poll-survey-enps-pulsy), [Geekbot](https://www.google.com/search?q=https%3A%2F%2Fslack.com%2Fmarketplace%2FA0H67RAG0-standup-polls-surveys-by-geekbot), [TinyPoll](https://www.google.com/search?q=https%3A%2F%2Fslack.com%2Fmarketplace%2FA094GELN0PQ-polls-and-surveys-by-tinypoll), [Poll App](https://www.google.com/search?q=https%3A%2F%2Fslack.com%2Fmarketplace%2FAEU4ZFWBS-poll-app), [SurveySparrow](https://www.google.com/search?q=https%3A%2F%2Fslack.com%2Fmarketplace%2FAU9Q00XUZ-polls-surveys-by-surveysparrow), [Poll Buddy](https://www.google.com/search?q=https%3A%2F%2Fslack.com%2Fmarketplace%2FA05UGHMU2KV-poll-buddy) y [Poll \& Surveys](https://www.google.com/search?q=https%3A%2F%2Fslack.com%2Fmarketplace%2FA09EUDGD7UY-poll-surveys-simple-polls)), se identificaron tres fricciones críticas:

1. **Precios punitivos:** Las soluciones líderes cobran por todo el tamaño del *workspace* (aunque solo un canal use la app) o imponen límites estrictos por creador de encuestas.
2. **Dashboards externos fragmentados:** Para ver métricas o históricos detallados, la mayoría obliga al usuario a iniciar sesión en un navegador web fuera de Slack.
3. **Falta de mecánicas intermedias:** El mercado ofrece o votaciones triviales de opción múltiple o suites complejas de RR. HH. con evaluaciones de desempeño de 360 grados.

---

## 3. Propuesta de Valor y Pilares de Diferenciación

### Pilar 1: App Home como Dashboard Analítico Completo
En lugar de un Home vacío o con enlaces externos, Pollito convierte la pestaña Home del usuario en una consola de analítica construida con **Slack Block Kit**:

* **Métricas de quórum y participación:** Porcentaje de participación por canal activo (votos emitidos vs. total de miembros del canal).
* **Mapas de actividad horaria:** Identificación de los días y horarios con mayor rapidez de respuesta en el equipo.
* **Histórico auditable de consensos:** Búsqueda rápida de decisiones pasadas organizadas por canal y categoría (fechas, diseño, soporte, social).
* **Exportación instantánea:** Generación directa de reportes descargables en CSV sin salir de la plataforma.

### Pilar 2: Mecánicas de Voto Avanzadas (Sin IA ni dependencias externas)
* **Buscador nativo de horarios (Time-Slot Grid):** Matriz de opciones de días y horas para coordinar reuniones estilo Doodle directamente dentro del mensaje de Slack.
* **Votación por semillas (*Dot Voting*):** Cada votante dispone de una cantidad fija de puntos (ej. 5 semillas 🌾) para repartir entre distintas alternativas, midiendo la intensidad real de preferencia.
* **Cierre por quórum automático:** La votación se da por concluida en cuanto participa un porcentaje objetivo del canal (ej. 80% del equipo), evitando esperas innecesarias.
* **Empujoncito Inteligente (*Smart Nudge*):** Recordatorio automatizado por mensaje directo exclusivamente para los integrantes del canal que no han votado, protegiendo el anonimato de quienes ya lo hicieron.

### Pilar 3: Seguridad y Permisos Mínimos (*Zero Friction IT Approval*)
Pollito no requiere acceso a APIs externas de calendarios ni gestores de tareas. Su superficie de permisos se restringe a lo indispensable para operar en canales y renderizar vistas:

| Scope de OAuth (Bot Token) | Propósito Funcional |
| :--- | :--- |
| `commands` | Registro y ejecución de los comandos `/pollito` y `/poll`. |
| `chat:write` | Publicación y actualización de bloques de votación en canales y DMs. |
| `views:open` | Apertura de modales interactivos para configurar encuestas. |
| `channels:read` & `groups:read` | Consulta de la cantidad de integrantes para calcular porcentajes de quórum. |
| `users:read` | Identificación de usuarios para el envío de recordatorios directos a pendientes. |

---

## 4. Estructura y Vistas de la Interfaz (Slack Block Kit)

### Vista A: Mensaje en Canal (La Votación)
1. **Encabezado:** Avatar de Pollito con el título de la consulta y etiqueta de tipo (ej. `[Anónimo]` o `[Quórum 75%]`).
2. **Cuerpo interactivo:** Botones de opción con barra visual de progreso mediante caracteres de bloque o barras de porcentaje.
3. **Pie de encuesta:** Contador de participantes acumulados, tiempo restante y botón secundario `Ver detalles en Home`.

### Vista B: App Home ("El Nido")
1. **Resumen de Salud del Equipo:**
   * Tasa de participación global del mes.
   * Total de decisiones tomadas.
   * Canal más participativo.
2. **Votaciones Activas en Curso:**
   * Lista de encuestas creadas por el usuario o donde participa.
   * Acciones en un clic: `Enviar Empujoncito`, `Cerrar Votación`, `Extender Plazo`.
3. **Archivo de Decisiones:**
   * Acordeón con las últimas 20 decisiones cerradas y la opción ganadora destacada.
   * Selector de filtro por canal (`#general`, `#producto`, `#ingenieria`).
4. **Centro de Plantillas Rápidas:**
   * Accesos directos: *Votación de Almuerzo*, *Coordinación de Horario*, *Retrospectiva de Sprint*, *Priorización de Tareas*.

---

## 5. Estrategia de Marca y Tono

* **Personalidad:** Eficiente, ligera y cordial. Transmite dinamismo sin saturar los canales de texto innecesario.
* **Estados visuales del personaje:**
  * *Pollito saliendo del cascarón:* Nueva votación iniciada.
  * *Pollito enfocado (con lupa o reloj):* Votación activa esperando quórum.
  * *Pollito celebrando (con serpentinas):* Decisión alcanzada por consenso unánime o meta de quórum cumplida.
* **Equilibrio corporativo:** Los elementos lúdicos se concentran en íconos, encabezados y mensajes de estado. Las tablas numéricas y botones mantienen la sobriedad técnica del diseño de Slack.

---

## 6. Modelo de Negocio Sugerido

Para capturar la demanda insatisfecha por los modelos de Simple Poll y Polly:

* **Nivel Gratuito (Freemium):**
  * Votaciones ilimitadas en canales públicos.
  * Límite de hasta 150 respuestas mensuales acumuladas.
  * Acceso al App Home con métricas de los últimos 14 días.
* **Nivel Pro (Tarifa Plana por Workspace Pequeño/Mediano):**
  * $12 a $19 USD mensuales por equipo (sin importar si el workspace tiene 20 o 500 personas en canales no relacionados).
  * Respuestas ilimitadas y votaciones anónimas protegidas.
  * Dashboards históricos ilimitados en el App Home y exportación CSV.
  * Formatos avanzados (Time-Slot Grid y Dot Voting).

---

## 7. Hoja de Ruta de Desarrollo (MVP)

1. **Sprint 1 (Fundaciones Slack Bolt):**
   * Configuración del manifiesto de la aplicación y autenticación OAuth.
   * Manejo de eventos de comando (`/pollito`) y apertura de modal de creación básico.
2. **Sprint 2 (Interacciones y Persistencia):**
   * Lógica de votación en canal con actualización reactiva del bloque de mensaje.
   * Gestión de estados de voto único, selección múltiple y anonimato en base de datos relacional.
3. **Sprint 3 (App Home Dashboard):**
   * Suscripción al evento `app_home_opened`.
   * Renderizado dinámico de estadísticas de participación y lista de encuestas activas con acciones.
4. **Sprint 4 (Mecánicas de Diferenciación y Lanzamiento):**
   * Implementación de la cuadrícula de horarios (*Time-Slot Grid*) y botón de *Smart Nudge*.
   * Auditoría de seguridad de Slack y publicación en el Slack Marketplace.
