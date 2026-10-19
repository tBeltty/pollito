(() => {
  const STALE_AFTER_MS = 5 * 60 * 1000;
  const REFRESH_MS = 60 * 1000;

  const copy = {
    en: {
      title: 'Pollito status',
      'loading.title': 'Checking status',
      'loading.sub': 'One moment.',
      'ok.title': 'All systems operational',
      'ok.sub': 'Pollito is running normally.',
      'outage.title': 'Pollito is not responding',
      'outage.sub': 'We are looking into it. This page updates every minute.',
      'unknown.title': 'No data yet',
      'unknown.sub': 'The first check will appear within a minute.',
      'stale.title': 'Status updates are delayed',
      'stale.sub': 'The last check was {time}. Pollito may still be running.',
      'error.title': 'Status is unavailable',
      'error.sub': 'Reload in a moment.',
      'stat.uptime': 'Uptime, 30 days',
      'stat.running': 'Running for',
      'stat.response': 'Response time',
      'days.title': 'Last 90 days',
      'days.start': '90 days ago',
      'days.end': 'Today',
      'days.summary': '{pct} uptime',
      'days.label': 'Daily availability for the last 90 days',
      'events.title': 'Recent events',
      'events.empty': 'No restarts or outages recorded yet.',
      'event.restart': 'Restarted',
      'event.outage': 'Outage',
      'event.ongoing': 'ongoing',
      'foot.note': 'Checked every minute. Days are counted in UTC and times use your local timezone.',
      'foot.support': 'Support',
      noData: 'No data',
    },
    es: {
      title: 'Estado de Pollito',
      'loading.title': 'Comprobando el estado',
      'loading.sub': 'Un momento.',
      'ok.title': 'Todos los sistemas funcionan',
      'ok.sub': 'Pollito funciona con normalidad.',
      'outage.title': 'Pollito no responde',
      'outage.sub': 'Lo estamos revisando. Esta página se actualiza cada minuto.',
      'unknown.title': 'Aún no hay datos',
      'unknown.sub': 'La primera comprobación aparecerá en un minuto.',
      'stale.title': 'Las actualizaciones se están retrasando',
      'stale.sub': 'La última comprobación fue {time}. Puede que Pollito siga funcionando.',
      'error.title': 'Estado no disponible',
      'error.sub': 'Vuelve a cargar en un momento.',
      'stat.uptime': 'Disponibilidad, 30 días',
      'stat.running': 'Activo desde hace',
      'stat.response': 'Tiempo de respuesta',
      'days.title': 'Últimos 90 días',
      'days.start': 'Hace 90 días',
      'days.end': 'Hoy',
      'days.summary': '{pct} de disponibilidad',
      'days.label': 'Disponibilidad diaria de los últimos 90 días',
      'events.title': 'Eventos recientes',
      'events.empty': 'Todavía no hay reinicios ni caídas registrados.',
      'event.restart': 'Reinicio',
      'event.outage': 'Caída',
      'event.ongoing': 'en curso',
      'foot.note': 'Se comprueba cada minuto. Los días se cuentan en UTC y las horas usan tu zona horaria.',
      'foot.support': 'Soporte',
      noData: 'Sin datos',
    },
  };

  const $ = (id) => document.getElementById(id);
  const banner = $('banner');
  const params = new URLSearchParams(location.search);
  let lang = params.get('lang') || localStorage.getItem('status-lang') || (navigator.language || 'en');
  lang = String(lang).toLowerCase().startsWith('es') ? 'es' : 'en';
  let data = null;
  let failed = false;

  const t = (key, vars = {}) =>
    Object.entries(vars).reduce((text, [k, v]) => text.replace(`{${k}}`, v), copy[lang][key] ?? key);

  const percent = (value) =>
    value === null || value === undefined
      ? '-'
      : `${new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(value)}%`;

  function duration(seconds) {
    if (seconds === null || seconds === undefined) return '-';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d} d ${h} h`;
    if (h > 0) return `${h} h ${m} min`;
    return `${Math.max(1, m)} min`;
  }

  const when = (iso) =>
    new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

  const ago = (iso) => {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    if (minutes < 1440) return rtf.format(-Math.round(minutes / 60), 'hour');
    return rtf.format(-Math.round(minutes / 1440), 'day');
  };

  function level(uptime) {
    if (uptime === null) return 'none';
    if (uptime >= 99.9) return 'ok';
    if (uptime >= 99) return 'warn';
    return 'bad';
  }

  function renderBanner() {
    let state = 'loading';
    let key = 'loading';
    let vars = {};
    if (failed && !data) {
      state = 'stale';
      key = 'error';
    } else if (data) {
      const age = Date.now() - new Date(data.generatedAt).getTime();
      if (age > STALE_AFTER_MS) {
        state = 'stale';
        key = 'stale';
        vars = { time: ago(data.generatedAt) };
      } else if (data.state === 'operational') {
        state = 'operational';
        key = 'ok';
      } else if (data.state === 'outage') {
        state = 'outage';
        key = 'outage';
      } else {
        key = 'unknown';
      }
    }
    banner.dataset.state = state;
    $('banner-title').textContent = t(`${key}.title`);
    $('banner-sub').textContent = t(`${key}.sub`, vars);
  }

  function renderData() {
    if (!data) return;
    // A figure without data is hidden instead of showing a dash.
    const stats = [
      ['stat-uptime', data.uptime.d30, percent(data.uptime.d30)],
      ['stat-running', data.runningSeconds, duration(data.runningSeconds)],
      ['stat-response', data.responseMs, `${data.responseMs} ms`],
    ];
    for (const [id, raw, text] of stats) {
      const hasData = raw !== null && raw !== undefined;
      $(id).closest('.stat').hidden = !hasData;
      if (hasData) $(id).textContent = text;
    }
    $('stats').hidden = stats.every(([, raw]) => raw === null || raw === undefined);
    $('days-summary').textContent = t('days.summary', { pct: percent(data.uptime.d90) });

    const bars = $('bars');
    bars.replaceChildren(
      ...data.days.map((day) => {
        const bar = document.createElement('span');
        bar.className = 'bar';
        bar.dataset.level = level(day.uptime);
        bar.title = `${day.date}: ${day.uptime === null ? t('noData') : percent(day.uptime)}`;
        return bar;
      })
    );

    const list = $('events');
    if (data.events.length === 0) {
      const item = document.createElement('li');
      const empty = document.createElement('span');
      empty.className = 'empty';
      empty.textContent = t('events.empty');
      item.append(empty);
      list.replaceChildren(item);
      return;
    }
    list.replaceChildren(
      ...data.events.map((event) => {
        const item = document.createElement('li');
        const what = document.createElement('span');
        what.className = 'what';
        let label = t(`event.${event.type}`);
        if (event.type === 'outage') {
          label += `, ${event.durationSeconds === undefined ? t('event.ongoing') : duration(event.durationSeconds)}`;
        }
        what.textContent = label;
        const time = document.createElement('span');
        time.className = 'when';
        time.textContent = when(event.at);
        item.append(what, time);
        return item;
      })
    );
  }

  function renderStatic() {
    document.documentElement.lang = lang;
    document.title = t('title');
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      if (el.id === 'banner-title' || el.id === 'banner-sub') return;
      el.textContent = t(el.dataset.i18n);
    });
    $('bars').setAttribute('aria-label', t('days.label'));
    $('lang').textContent = lang === 'en' ? 'ES' : 'EN';
  }

  function render() {
    renderStatic();
    renderBanner();
    renderData();
  }

  async function load() {
    try {
      const response = await fetch('status.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      data = await response.json();
      failed = false;
    } catch {
      failed = true;
    }
    render();
  }

  $('lang').addEventListener('click', () => {
    lang = lang === 'en' ? 'es' : 'en';
    localStorage.setItem('status-lang', lang);
    render();
  });

  render();
  load();
  setInterval(load, REFRESH_MS);
})();
