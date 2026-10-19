import type { MessageCatalog } from '../index.js';

/**
 * Catálogo en español para Pollito.
 * Sigue las directrices del proyecto:
 * - 100% tuteo ("tú", "tu", "elige", "crea").
 * - Puntuación y ortografía RAE (apertura de signos ¿ y ¡, mayúsculas correctas).
 * - Cero AI slop (tono directo, humano y profesional).
 * - Paridad estricta de claves y sintaxis ICU ({name}, {count, plural, one {..} other {..}}).
 */
export const es: MessageCatalog = {
  // ── Compartidos ────────────────────────────────────────────────────────
  'common.cancel': 'Cancelar',
  'common.close': 'Cerrar',
  'common.delete': 'Eliminar',
  'common.public': 'Pública',
  'common.anonymous': 'Anónima',
  'common.untitledPoll': 'Votación sin título',

  'status.quorumReached': 'Quórum alcanzado',
  'status.active': 'Activa',
  'status.timeExpired': 'Tiempo agotado',
  'status.closed': 'Cerrada',

  // ── Tarjeta de mensaje de votación ─────────────────────────────────────
  'poll.status.active': 'Votación activa',
  'poll.status.quorumReached': 'Quórum alcanzado • Cerrada',
  'poll.status.timeExpired': 'Límite de tiempo alcanzado • Cerrada',
  'poll.status.closed': 'Votación cerrada',
  'poll.status.approachingQuorum': 'Cerca del quórum objetivo',
  'poll.ballot.anonymous': 'Voto anónimo',
  'poll.ballot.public': 'Voto público',
  'poll.choice.multiple': 'Opción múltiple',
  'poll.choice.single': 'Opción única',
  'poll.context.status': '{mascot} *Estado:* {status} • *Tipo:* {ballot} • {choice}',
  'poll.option.votes': '{count, plural, one {*#* voto} other {*#* votos}}',
  'poll.option.moreVoters': '+{count} más',
  'poll.vote.button': 'Votar {number}',
  'poll.nudge.button': 'Recordar a quienes faltan',
  'poll.nudge.confirmTitle': '¿Enviar recordatorio a quienes faltan?',
  'poll.nudge.confirmBody':
    'Pollito enviará un mensaje directo privado a los miembros de este canal que aún no han votado. Solo quien creó la votación puede enviar recordatorios, y cada votación permite uno cada {hours, plural, one {hora} other {# horas}}.',
  'poll.nudge.confirmSubmit': 'Enviar recordatorios',
  'poll.close.button': 'Cerrar votación',
  'poll.close.confirmTitle': '¿Cerrar esta votación ahora?',
  'poll.close.confirmBody':
    'La votación terminará de inmediato y los resultados finales se publicarán en el hilo.',
  'poll.close.confirmDeny': 'Mantener abierta',
  'poll.footer.participants': 'Total de participantes: {count}',
  'poll.footer.participantsNoQuorum': 'Total de participantes: {count} • Sin quórum requerido',
  'poll.footer.quorumPercent':
    'Quórum objetivo: {target}% ({votes}/{eligible} miembros • {reached}% alcanzado)',
  'poll.footer.quorumCount':
    'Quórum objetivo: {target, plural, one {# voto} other {# votos}} ({votes}/{target} alcanzado)',
  'poll.footer.closes': 'Cierra: {date}',
  'poll.footer.closed': 'Cerrada: {date}',
  'poll.footer.meta': 'Creada por <@{creatorId}> • ID: {pollId}',
  'poll.fallback.active': 'Votación: {question}',
  'poll.fallback.closed': '[Cerrada] Votación: {question}',
  'poll.fallback.launching': 'Iniciando votación: {question}...',
  'poll.fallback.creating': 'Creando votación: {question}...',

  // ── Anuncios de cierre ─────────────────────────────────────────────────
  'closure.title.quorum': '🎉 *Quórum alcanzado. Votación cerrada*',
  'closure.title.closed': '🔒 *Votación cerrada por quien la creó*',
  'closure.title.expired': '⏰ *Votación cerrada. Tiempo agotado*',
  'closure.body.quorum':
    '*{question}* alcanzó el quórum objetivo con {count, plural, one {*#* participante} other {*#* participantes}}.',
  'closure.body.closed':
    '*{question}* ya está cerrada con {count, plural, one {*#* participante en total} other {*#* participantes en total}}.',
  'closure.body.closedEmpty': '*{question}* se cerró sin votos registrados.',
  'closure.body.expired':
    '*{question}* concluyó con {count, plural, one {*#* participante en total} other {*#* participantes en total}}.',
  'closure.body.expiredEmpty': '*{question}* concluyó sin votos registrados.',
  'closure.outcome.winner':
    'Ganadora: *{option}* ({votes, plural, one {# voto} other {# votos}}).',
  'closure.outcome.tie':
    'Resultado: Empate entre {options} ({votes, plural, one {# voto} other {# votos}} cada una).',

  // ── Recordatorios y notificaciones ───────────────────────────────────
  'nudge.dm':
    '👋 <@{creatorId}> espera tu voto en *{question}* en <#{channelId}>.',
  'nudge.sent':
    '📬 Se enviaron recordatorios privados a {count, plural, one {# compañero} other {# compañeros}}.',
  'nudge.nonePending': '¡No hay votos pendientes! Todo el equipo ya emitió su voto.',
  'nudge.disabled': 'Los recordatorios están desactivados en este espacio de trabajo.',
  'nudge.channelTooLarge': 'Los recordatorios no están disponibles en canales de más de {max} miembros.',
  'nudge.cooldown': 'Ya se envió un recordatorio en {hours, plural, one {la última hora} other {las últimas # horas}}.',
  'nudge.noPoll': 'No se encontró ninguna votación activa que hayas creado en este canal.',
  'vote.recorded': 'Tu voto ha sido registrado.',
  'vote.recordedAnonymous': 'Tu voto anónimo ha sido registrado.',
  'huddle.reminder.fallback':
    '🗳️ El Huddle terminó y *{question}* sigue abierta. <{permalink}|Votar en el hilo>',
  'huddle.reminder.body':
    '🗳️ *El Huddle terminó.*\n*<{permalink}|{question}>* sigue abierta para votar en el hilo.',
  'huddle.reminder.button': 'Ir a la votación',

  // ── Respuestas a comandos de barra ─────────────────────────────────────
  'command.help':
    '*Ayuda rápida de Pollito*\n\n• `/pollito`: Abre el creador de votaciones.\n• `/pollito "Pregunta" "Opción 1" "Opción 2"`: Crea una votación rápida al instante.\n• `/pollito huddle`: Abre el creador para publicar en el Huddle activo.\n• `/pollito huddle "Pregunta" "Opción 1" "Opción 2"`: Publica de inmediato en el Huddle.\n• `/pollito close [id-votación]`: Cierra una votación activa que hayas creado.\n• `/pollito nudge [id-votación]`: Envía recordatorios privados a quienes faltan por votar.\n• `/pollito report`: Abre las estadísticas de tus votaciones o del espacio de trabajo.\n• Visita la pestaña Inicio de la app para ver resultados y plantillas.',
  'command.noHuddle':
    'No se detectó ningún Huddle activo en este canal. Inicia un Huddle primero o usa `/pollito huddle` para abrir el creador.',
  'command.inviteBot':
    'Primero invita a Pollito a este canal. Escribe `/invite @Pollito` y vuelve a ejecutar {command}.',
  'command.report.summary':
    '*Estadísticas de Pollito ({scope, select, workspace {Espacio de trabajo} other {Tus votaciones}})*: {total, plural, one {*#* votación} other {*#* votaciones}} (*{active}* activas, *{quorums}* con quórum alcanzado, *{avg}%* de participación promedio).',
  'command.pollClosed': 'Votación cerrada correctamente: *{question}*',

  // ── Errores de cara al usuario ─────────────────────────────────────────
  'error.workspaceIdMissing': 'Algo salió mal. Inténtalo de nuevo.',
  'error.activePollInChannel':
    'Ya hay una votación activa en este canal. Ciérrala primero o elige otro canal.',
  'error.pollNotFound': 'Votación no encontrada.',
  'error.pollClosed': 'Esta votación está cerrada y ya no acepta votos.',
  'error.invalidOption': 'Opción de votación no válida.',
  'error.alreadyVoted': 'Ya has votado en esta votación.',
  'error.alreadyVotedOption': 'Ya has votado por esta opción.',
  'error.voteRetriesExhausted': 'No fue posible registrar tu voto. Inténtalo de nuevo en un momento.',
  'error.closeCreatorOnly': 'Solo quien creó la votación puede cerrarla manualmente.',
  'error.nudgeCreatorOnly': 'Solo quien creó la votación puede enviar recordatorios.',
  'error.detailsForbidden':
    'Solo quien creó la votación o un administrador pueden ver los detalles completos.',
  'error.pollDeleteForbidden':
    'Solo quien creó la votación o un administrador pueden eliminarla.',
  'error.templateNameRequired': 'El nombre de la plantilla es obligatorio.',
  'error.templateNotFound': 'Plantilla no encontrada.',
  'error.templateNotAccessible': 'Plantilla no encontrada o no accesible.',
  'error.templateEditForbidden':
    'Solo el propietario de la plantilla o un administrador pueden editarla.',
  'error.templateDeleteForbidden': 'Solo el propietario de la plantilla puede eliminarla.',
  'error.templateShareForbidden': 'Solo el propietario de la plantilla puede modificar sus permisos.',
  'error.generic.vote': 'Ocurrió un error al registrar tu voto.',
  'error.generic.close': 'Ocurrió un error al cerrar la votación.',
  'error.generic.delete': 'No se pudo eliminar la votación.',
  'error.generic.nudge': 'Ocurrió un error al enviar los recordatorios.',
  'error.generic.details': 'No se pudieron abrir los detalles de la votación.',
  'error.generic.command': 'Ocurrió un error al procesar el comando.',
  'error.unknownReason': 'Algo salió mal',
  'poll.create.notInChannel':
    'Pollito no está en <#{channelId}>. Invita a la app escribiendo `/invite @Pollito` en ese canal y vuelve a iniciar tu votación.',
  'poll.create.failed': 'No se pudo crear la votación: {reason}.',
  'poll.create.reserveFailed': 'No se pudo publicar la votación en el canal. Inténtalo de nuevo.',

  // ── Validación de formularios ──────────────────────────────────────────
  'validation.channelRequired': 'Elige un canal para esta votación',
  'validation.questionRequired': 'Escribe la pregunta de la votación',
  'validation.questionMax': 'La pregunta no debe superar los {max} caracteres',
  'validation.optionRequired': 'La opción {number} es obligatoria',
  'validation.optionMax': 'La opción {number} no debe superar los {max} caracteres',
  'validation.quorumInteger': 'El quórum objetivo debe ser un número entero entre 51 y 100',
  'validation.quorumMin': 'El quórum debe superar la mitad (entre 51% y 100%)',
  'validation.quorumMax': 'El quórum objetivo debe estar entre 51 y 100',
  'validation.invalidHuddleLink':
    'Enlace o marca temporal de hilo no válida. Pega un enlace de mensaje de Slack (.../archives/C.../p1234567890123456) o un thread_ts (1234567890.123456).',
  'validation.noActiveHuddle':
    'No se detectó ningún Huddle activo en este canal. Inicia un Huddle primero o pega el enlace del mensaje aquí.',
  'validation.templateNameRequired': 'Asigna un nombre a esta plantilla.',
  'validation.maxNudgeRange':
    'El tamaño máximo de canal para recordatorios debe ser un número entero entre 5 y 500.',
  'validation.selectPollToDelete': 'Selecciona al menos una votación para eliminar.',

  // ── Guía rápida ────────────────────────────────────────────────────────
  'guide.title': 'Guía rápida de Pollito',
  'guide.close': 'Entendido',
  'guide.header.how': 'Cómo funciona Pollito',
  'guide.step1':
    '*1. Lanza en un canal o hilo de Huddle*\nAbre el creador interactivo con `/pollito`, pasa opciones directamente para una votación instantánea o usa `/pollito huddle` para publicar dentro del Huddle activo.',
  'guide.step2':
    '*2. Votaciones anónimas y quórum*\nEn las votaciones anónimas nadie puede ver quién votó por qué. Define un quórum de 51% o más para cerrar la votación en cuanto vote suficiente gente del canal, o elige "Sin quórum requerido" para votaciones informales.',
  'guide.step3':
    '*3. Recordatorios y resultados*\nSolo quien creó la votación puede enviar recordatorios privados a quienes faltan, en canales por debajo del límite de tamaño definido en Ajustes y con un recordatorio cada {hours, plural, one {hora} other {# horas}}. Quien crea una votación ve sus resultados completos. Los administradores y gestores de Pollito ven los de todo el espacio.',
  'guide.header.commands': 'Referencia de comandos de barra',
  'guide.cmd.builder': '• `/pollito`: Abre el creador interactivo para el canal actual',
  'guide.cmd.instant': '• `/pollito "Pregunta" "Opción 1" "Opción 2"`: Lanza una votación rápida en el canal',
  'guide.cmd.huddleBuilder':
    '• `/pollito huddle`: Abre el creador orientado al hilo del Huddle en este canal',
  'guide.cmd.huddleInstant':
    '• `/pollito huddle "Pregunta" "Opción 1" "Opción 2"`: Lanza una votación rápida en el Huddle',
  'guide.cmd.close': '• `/pollito close [id-votación]`: Cierra una votación activa que hayas creado',
  'guide.cmd.nudge':
    '• `/pollito nudge [id-votación]`: Envía recordatorios privados a quienes faltan',
  'guide.cmd.report': '• `/pollito report`: Consulta tus resultados y el informe de participación',

  // ── Analítica y desglose de votación ──────────────────────────────────
  'analytics.title': 'Resultados y estadísticas',
  'analytics.scope.personal':
    'Resultados de tus votaciones y participación en {days, plural, one {el último día} other {los últimos # días}}. Solo aparecen votaciones que creaste tú. La vista global está reservada a administradores y gestores de Pollito.',
  'analytics.scope.workspace':
    'Resultados y participación en todo el espacio de trabajo en {days, plural, one {el último día} other {los últimos # días}}.',
  'analytics.metric.quorum':
    '*Con quórum alcanzado*\n*{rate}%* de las votaciones ({count})',
  'analytics.metric.participation':
    '*Participación promedio*\n*{pct}%* entre miembros convocados',
  'analytics.metric.ballots':
    '*Votos emitidos*\n{votes, plural, one {*#* voto} other {*#* votos}} en {polls, plural, one {*#* votación} other {*#* votaciones}}',
  'analytics.metric.privacy':
    '*Públicas y anónimas*\n*{publicCount}* públicas • *{anonymousCount}* anónimas',
  'analytics.export.button': 'Personalizar y exportar CSV',
  'analytics.recent.header': 'Resultados de votaciones recientes',
  'analytics.empty': 'No hay votaciones registradas en este período.',
  'analytics.outcome.none': 'Sin votos registrados',
  'analytics.outcome.tiedLead': 'Empate en cabeza: {options} ({votes})',
  'analytics.outcome.leading': 'En cabeza: *{option}* ({votes})',
  'analytics.outcome.tie': 'Empate: {options} ({votes})',
  'analytics.outcome.winner': 'Ganadora: *{option}* ({votes})',
  'analytics.poll.summary':
    'Canal: <#{channelId}> • *{status}* • *{mode}* • {participants, plural, one {*#* participante} other {*#* participantes}} • {outcome}',
  'detail.title': 'Desglose de resultados',
  'detail.fallbackQuestion': 'Resultados de la votación',
  'detail.mode.anonymous': 'Anónima',
  'detail.field.channel': '*Canal*\n<#{channelId}>',
  'detail.field.status': '*Estado y resultado*\n{status} • {outcome}',
  'detail.field.ballot': '*Modalidad de voto*\n{mode} • {choice}',
  'detail.field.quorum': '*Quórum y participación*\n{summary}',
  'detail.quorum.none': 'Sin quórum requerido',
  'detail.quorum.full':
    'Objetivo: {target}% • Alcanzado: {achieved}% ({votes}/{eligible} miembros)',
  'detail.quorum.partial': 'Objetivo: {target}% • Participantes: {count}',
  'detail.footer': 'Creada por <@{creatorId}> • ID de votación: {pollId}',

  // ── Inicio de la App (App Home) ────────────────────────────────────────
  'home.title': 'Pollito',
  'home.greeting.user':
    'Hola, <@{userId}>. Votaciones de equipo, umbrales de consenso y resultados en un solo lugar.',
  'home.greeting.anonymous': 'Votaciones de equipo, progreso y umbrales de consenso en un solo lugar.',
  'home.button.launch': 'Nueva votación',
  'home.button.analytics': 'Resultados y estadísticas',
  'home.button.templates': 'Plantillas',
  'home.button.guide': 'Guía',
  'home.button.settings': 'Ajustes',
  'home.button.exportCsv': 'Exportar CSV',
  'home.button.docs': 'Documentación',
  'home.button.manageHistory': 'Elegir votaciones para eliminar',
  'home.button.clearClosed': 'Limpiar votaciones cerradas',
  'home.button.viewResults': 'Ver resultados',
  'home.stat.active': '*{count}*\nVotaciones activas',
  'home.stat.quorums': '*{count}*\nQuórums alcanzados',
  'home.stat.closed': '*{count}*\nVotaciones cerradas',
  'home.stat.participation': '*{pct}%*\nParticipación promedio',
  'home.templates.intro': '*Plantillas rápidas*\nInicia una votación recurrente con un solo clic.',
  'home.templates.emptyManager':
    '*Plantillas rápidas*\nTodavía no hay plantillas compartidas. Como administrador, puedes crear plantillas para que el equipo las lance en un clic.',
  'home.templates.emptyMember':
    '*Plantillas rápidas*\nTodavía nadie ha compartido plantillas con el espacio. Abre *Plantillas* arriba para crear las tuyas.',
  'home.templates.add': '+ Añadir plantilla',
  'home.templates.addWorkspace': '+ Añadir plantilla del espacio',
  'home.recent.header': 'Votaciones recientes',
  'home.recent.empty':
    '_Todavía no hay votaciones. Escribe `/pollito` en cualquier canal o pulsa "Nueva votación" arriba._',
  'home.recent.meta':
    '<#{channelId}> • {votes, plural, one {# voto} other {# votos}} • {status}{role}',
  'home.role.creator': ' • La creaste tú',
  'home.role.participant': ' • Participante',
  'home.delete.confirmTitle': '¿Eliminar esta votación?',
  'home.delete.confirmBody':
    'Esto eliminará de forma permanente el registro de App Home y de las estadísticas del espacio.',
  'home.clear.confirmTitle': '¿Limpiar votaciones cerradas?',
  'home.clear.confirmBody': 'Esto eliminará de forma permanente las votaciones finalizadas de tu historial.',
  'home.footer': 'Votaciones públicas y anónimas • Soporte para quórum y Huddles',

  // ── Exportación CSV e historial ────────────────────────────────────────
  'csv.title': 'Exportar votaciones a CSV',
  'csv.intro':
    'Filtra las votaciones por fecha, estado o preguntas específicas, y copia el contenido CSV:',
  'csv.status.all': 'Todos los estados',
  'csv.status.quorumReached': 'Solo con quórum alcanzado',
  'csv.status.closed': 'Solo cerradas',
  'csv.status.active': 'Solo activas',
  'csv.startDate.placeholder': 'Elige fecha inicial',
  'csv.startDate.label': 'Fecha inicial (opcional)',
  'csv.endDate.placeholder': 'Elige fecha final',
  'csv.endDate.label': 'Fecha final (opcional)',
  'csv.statusFilter.label': 'Filtro por estado',
  'csv.polls.placeholder': 'Todas las del rango (o elige específicas)',
  'csv.polls.label': 'Votaciones específicas a exportar',
  'csv.apply': 'Aplicar filtros',
  'history.title': 'Gestionar historial de votaciones',
  'history.submit': 'Eliminar seleccionadas',
  'history.intro':
    'Selecciona una o más votaciones para eliminarlas permanentemente del historial y estadísticas:',
  'history.placeholder': 'Elige votaciones a eliminar',
  'history.label': 'Votaciones a eliminar',

  // ── Plantillas ─────────────────────────────────────────────────────────
  'templates.title': 'Plantillas de votación',
  'templates.intro':
    'Guarda preguntas habituales, reglas de quórum y opciones de privacidad como plantillas reutilizables.',
  'templates.button.newWorkspace': '+ Crear plantilla del espacio',
  'templates.button.new': '+ Nueva plantilla',
  'templates.tab.mine': 'Mis plantillas ({count})',
  'templates.tab.workspace': 'Plantillas del espacio ({count})',
  'templates.delete.prompt': '*¿Eliminar la plantilla "{name}"?*\nEsta acción no se puede deshacer.',
  'templates.delete.fallbackName': 'Plantilla seleccionada',
  'templates.delete.confirm': 'Confirmar eliminación',
  'templates.menu.launch': 'Lanzar votación',
  'templates.menu.edit': 'Editar plantilla',
  'templates.menu.share': 'Compartir con el equipo',
  'templates.menu.unshare': 'Dejar de compartir',
  'templates.menu.duplicate': 'Duplicar a mis plantillas',
  'templates.menu.delete': 'Eliminar',
  'templates.menu.unpublish': 'Despublicar (Admin)',
  'templates.row.shared': ' • *Compartida*',
  'templates.row.summary':
    '*{name}*{shared}\n_{question}_\n{count, plural, one {# opción} other {# opciones}} • {privacy} • {quorum}',
  'templates.row.noQuorum': 'Sin quórum',
  'templates.row.quorum': '{target}% de quórum',
  'templates.empty.mine':
    '_Aún no tienes plantillas guardadas. Marca "Guardar como plantilla reutilizable" al crear una votación o duplica una del equipo._',
  'templates.empty.workspace':
    '_Todavía no hay plantillas compartidas en el espacio de trabajo. Cualquier miembro puede crear una y compartirla con los demás._',

  // ── Ajustes del espacio de trabajo ─────────────────────────────────────
  'settings.title': 'Ajustes del espacio de trabajo',
  'settings.submit': 'Guardar ajustes',
  'settings.readOnly.body':
    '*Vista de solo lectura*\nLos ajustes del espacio de trabajo solo pueden cambiarlos los administradores de Slack y los gestores de Pollito.',
  'settings.value.concurrencyMultiple': 'Se permiten varias votaciones activas a la vez',
  'settings.value.concurrencySingle': 'Solo 1 votación activa por canal',
  'settings.value.privacyAnonymous': 'Anónima',
  'settings.value.privacyPublic': 'Pública',
  'settings.value.quorumNone': 'Sin quórum',
  'settings.value.nudgesEnabled': 'Activados (en canales de hasta {max} miembros)',
  'settings.value.nudgesDisabled': 'Desactivados',
  'settings.value.managersNone': 'Ninguno asignado',
  'settings.value.localeAuto': 'Automático (sigue el idioma de Slack de cada persona)',
  'settings.field.concurrency': '*Concurrencia por canal*\n{value}',
  'settings.field.privacy': '*Privacidad por defecto*\n{value}',
  'settings.field.quorum': '*Quórum por defecto*\n{value}',
  'settings.field.nudges': '*Recordatorios*\n{value}',
  'settings.field.managers': '*Gestores de Pollito*\n{value}',
  'settings.field.locale': '*Idioma del espacio*\n{value}',
  'settings.option.concurrency': '*Permitir varias votaciones activas en el mismo canal*',
  'settings.option.concurrencyHint': 'Desmarcado por defecto: una sola votación activa por canal.',
  'settings.option.anonymous': '*Voto anónimo por defecto*',
  'settings.option.nudges': '*Permitir que quien crea la votación envíe recordatorios a quienes faltan*',
  'settings.quorum.none': 'Sin quórum requerido',
  'settings.quorum.51': '51% (mayoría)',
  'settings.quorum.66': '66% (dos tercios)',
  'settings.quorum.70': '70% (consenso de equipo)',
  'settings.quorum.75': '75% (consenso amplio)',
  'settings.quorum.80': '80% (mayoría fuerte)',
  'settings.quorum.100': '100% (unanimidad)',
  'settings.label.concurrency': 'Concurrencia por canal',
  'settings.label.privacy': 'Privacidad y recordatorios por defecto',
  'settings.label.quorum': 'Umbral de quórum por defecto',
  'settings.label.maxNudge': 'Tamaño máximo de canal para recordatorios',
  'settings.hint.maxNudge':
    'Los canales que superen este número de miembros no mostrarán el botón de recordatorio.',
  'settings.label.managers': 'Gestores de Pollito',
  'settings.placeholder.managers': 'Elige compañeros que puedan gestionar los ajustes del espacio',
  'settings.label.locale': 'Idioma del espacio',
  'settings.hint.locale':
    'Se usa para personas cuyo idioma en Slack no está soportado. De lo contrario, cada quien ve Pollito en su propio idioma de Slack.',
  'settings.locale.auto': 'Automático (sigue el idioma de cada persona en Slack)',
  'settings.locale.en': 'English',
  'settings.locale.es': 'Español',

  // ── Creador de votación y plantilla ───────────────────────────────────
  'cp.title.huddle': 'Crear votación en un Huddle',
  'cp.title.create': 'Crear una votación',
  'cp.title.editTemplate': 'Editar plantilla de votación',
  'cp.title.newTemplate': 'Nueva plantilla de votación',
  'cp.title.newWorkspaceTemplate': 'Nueva plantilla del espacio',
  'cp.submit.launch': 'Lanzar votación',
  'cp.submit.saveTemplate': 'Guardar plantilla',
  'cp.submit.createTemplate': 'Crear plantilla',
  'cp.huddle.inChannel': ' en <#{channelId}>',
  'cp.huddle.bannerActive':
    '🎧 *Destino: Hilo del Huddle activo*{inChannel}\nEsta votación se publicará directamente dentro del Huddle en curso.',
  'cp.huddle.bannerPending':
    '🎧 *Destino: Hilo del Huddle*{inChannel}\nPollito detectará el Huddle al lanzar la votación, o puedes pegar el enlace del mensaje abajo.',
  'cp.channel.placeholder': 'Elige un canal',
  'cp.channel.label': 'Canal',
  'cp.channel.labelTemplate': 'Canal por defecto (opcional)',
  'cp.huddleThread.placeholder': 'En blanco para detectar solo, o pega enlace del mensaje / thread ts',
  'cp.huddleThread.label': 'Enlace o marca temporal del hilo del Huddle (opcional)',
  'cp.question.placeholder': 'Ej. ¿Qué fecha nos viene mejor para la retrospectiva?',
  'cp.question.label': 'Pregunta de la votación',
  'cp.option.label': 'Opción {number}',
  'cp.option.placeholder1': 'Primera opción',
  'cp.option.placeholder2': 'Segunda opción',
  'cp.option.placeholder3': 'Tercera opción (opcional)',
  'cp.option.placeholder4': 'Cuarta opción (opcional)',
  'cp.settings.label': 'Ajustes de la votación',
  'cp.settings.anonymous': '*Voto anónimo*',
  'cp.settings.anonymousHint': 'Nadie puede ver quién votó por qué.',
  'cp.settings.multiple': '*Opción múltiple*',
  'cp.settings.multipleHint': 'Permite al equipo elegir más de una opción.',
  'cp.settings.noQuorum': '*Sin quórum requerido*',
  'cp.settings.noQuorumHint': 'Sin umbral de participación. Se cierra a mano o al vencer el plazo.',
  'cp.settings.forwardHuddle': '*Recordar en el canal cuando termine el Huddle*',
  'cp.settings.forwardHuddleHint': 'Publica un enlace de recordatorio en el canal si la votación sigue abierta al terminar el Huddle.',
  'cp.quorum.label': 'Porcentaje de quórum objetivo (%)',
  'cp.quorum.hint':
    'Mínimo 51% (más de la mitad). Déjalo en blanco o marca "Sin quórum requerido" para votaciones informales.',
  'cp.duration.none': 'Sin límite de tiempo (manual o por quórum)',
  'cp.duration.15m': '15 minutos (Standup rápido)',
  'cp.duration.1h': '1 hora',
  'cp.duration.4h': '4 horas',
  'cp.duration.24h': '24 horas (1 día)',
  'cp.duration.72h': '3 días (72 horas)',
  'cp.duration.7d': '1 semana (7 días)',
  'cp.duration.placeholder': 'Elige la duración',
  'cp.duration.label': 'Duración / Plazo de cierre',
  'cp.duration.hint':
    'Cierra la votación de forma automática cuando este tiempo venza, incluso si no se alcanzó el quórum.',
  'cp.template.name.placeholderNew': 'Ej. Bloqueos de la sincronización diaria',
  'cp.template.name.placeholderOptional': 'Nombre opcional (por defecto toma la pregunta)',
  'cp.template.name.label': 'Nombre de la plantilla',
  'cp.template.availability.label': 'Disponibilidad en el espacio',
  'cp.template.save.label': 'Plantilla reutilizable',
  'cp.template.save': '*Guardar como plantilla reutilizable (solo tú la verás)*',
  'cp.template.saveHint': 'Guarda la pregunta, opciones y quórum en tus Plantillas.',
  'cp.template.share': '*Compartir con el espacio de trabajo*',
  'cp.template.shareHint': 'Cualquier compañero podrá usarla desde Inicio y Plantillas.',
};
