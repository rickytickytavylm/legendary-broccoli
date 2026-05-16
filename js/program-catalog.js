(function initProgramCatalog() {
  const PROGRAMS = [
    { href: '/psihosomatika/', title: 'Психосоматика', desc: 'Связь эмоций, стресса и телесных симптомов', image: '/assets/webp/psysomatic.webp', wide: true, endpoint: '/content/psihosomatika-lessons' },
    { href: '/yoga/', title: 'Мини-йога', desc: 'Мягкие практики дыхания и движения', image: '/assets/webp/mini-yoga.webp', endpoint: '/content/yoga-lessons' },
    { href: '/dermer/', title: 'Работа с травмами', desc: 'Практический курс о кризисах и восстановлении опоры', image: '/assets/webp/geshtalt.webp', endpoint: '/content/dermer-lessons' },
    { href: '/geshtalt/', title: 'Гештальт-подход', desc: 'Контакт, границы, эмоции и возвращение к себе', image: '/assets/webp/courses.webp', wide: true, endpoint: '/content/geshtalt-lessons' },
    { href: '#', title: 'Сценарий', desc: 'Ваш личный план', image: '/assets/webp/scenario.webp', badge: 'Скоро', disabled: true },
    { href: '/gipnoz/', title: 'Гипноз', desc: 'Техники и практики гипнотерапии', image: '/assets/webp/hipno.webp', endpoint: '/content/gipnoz-lessons' },
    { href: '/superviziya/', title: 'Супервизия', desc: 'Профессиональная поддержка психологов', image: '/assets/webp/supervision.webp', badge: 'Для профессионалов', endpoint: '/content/superviziya-lessons' },
    { href: '/master/', title: 'Мастер Коммуникаций', desc: 'Развитие навыков общения', image: '/assets/webp/masterofcommication.webp', endpoint: '/content/master-lessons' },
    { href: '/terapiya/', title: 'Телесная терапия', desc: 'Практики, которые возвращают внимание в тело', image: '/assets/webp/theraphy.webp', wide: true },
    { href: '/antologiya/', title: 'Антология', desc: 'Сборник материалов и практик', image: '/assets/webp/antology.webp', wide: true, endpoint: '/content/antologiya-lessons' },
    { href: '/sozavisimost/', title: 'Созависимость', desc: 'Работа с созависимыми отношениями', image: '/assets/webp/coda2.webp', endpoint: '/content/sozavisimost-lessons' },
    { href: '/mj/', title: 'Мужское и Женское', desc: 'Психология отношений и природа полов', image: '/assets/webp/man_woman.webp', full: true, endpoint: '/content/mj-lessons' },
  ];
  const MARATHON_RAIL = [
    { href: '/marathons/#section-samoocenka', title: 'Самооценка', desc: 'Внутренняя опора, самоценность и мягкая пересборка отношения к себе', image: '/assets/webp/myself_mar.webp' },
    { href: '/marathons/#section-konflikty', title: 'Конфликты', desc: 'Границы и разговор о сложном без разрушения контакта', image: '/assets/webp/conflicts.webp' },
    { href: '/marathons/#section-rezakina', title: 'Материнство и опора', desc: 'Беременность, эмоциональное состояние мамы, привязанность и родительское выгорание', image: '/assets/webp/maraphones.webp' },
  ];
  const RESOURCE_RAIL = [
    { href: '/profiling/', title: 'Профайлинг', desc: 'Психологический портрет личности и точка входа в самопонимание', image: '/assets/webp/way_block.webp' },
    { href: '#', title: 'Приложение', desc: 'Установите Систему на экран телефона для быстрого доступа', image: '/assets/webp/app.webp', disabled: true },
    { href: 'https://t.me/obrazmisl', title: 'Отдел заботы', desc: 'Поможем с доступом, оплатой, курсами и навигацией', image: '/assets/webp/hope.webp', external: true },
  ];

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function flattenLessons(data) {
    if (!Array.isArray(data)) return [];
    if (data.every((item) => Array.isArray(item.lessons))) {
      return data.flatMap((section) => section.lessons || []);
    }
    return data;
  }

  function arrow() {
    return '<div class="card-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>';
  }

  function card(program, mode) {
    const classes = [
      mode === 'rail' ? 'program-rail-card' : 'bento-card',
      program.wide && mode !== 'rail' ? 'wide' : '',
      program.full && mode !== 'rail' ? 'program-card-full' : '',
      'card-hover',
      program.disabled ? 'disabled' : '',
    ].filter(Boolean).join(' ');
    const tag = program.disabled ? 'div' : 'a';
    const href = program.disabled ? '' : ` href="${program.href}"`;
    const badge = program.badge
      ? `<span class="${program.badge === 'Скоро' ? 'card-badge' : 'card-badge-glass'}">${program.badge}</span>`
      : '';
    const external = program.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<${tag}${href}${external} class="${classes}" data-program-card data-endpoint="${program.endpoint || ''}">
      ${badge}
      <div class="card-bg" style="background: url('${program.image}') center/cover no-repeat;"></div>
      <div class="card-overlay"></div>
      <div class="card-content">
        <div class="card-text">
          <h3>${program.title}</h3>
          <p>${program.desc}</p>
        </div>
      </div>
      ${program.disabled ? '' : arrow()}
    </${tag}>`;
  }

  function renderRailItems(root, items, allHref, allLabel, allTitle) {
    root.innerHTML = items.map((program) => card(program, 'rail')).join('') +
      `<a href="${allHref}" class="program-rail-card program-rail-all">
        <div class="card-bg" style="background: url('/assets/webp/open_all.webp') center/cover no-repeat;"></div>
        <div class="card-overlay"></div>
        <span>${allLabel}</span>
        <strong>${allTitle}</strong>
        ${arrow()}
      </a>`;
  }

  function renderRail(target, limit) {
    const root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!root) return;
    renderRailItems(root, PROGRAMS.slice(0, limit || 4), '/programs/', 'Все программы', 'Открыть каталог');
  }

  function renderWebinarRail(target) {
    const root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!root) return;
    root.innerHTML = card({
      href: '#',
      title: 'Вебинары',
      desc: 'Живые эфиры, разборы и записи встреч появятся в отдельном разделе',
      image: '/assets/webp/supervision.webp',
      badge: 'Скоро',
      disabled: true,
    }, 'rail');
  }

  function renderMarathonRail(target) {
    const root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!root) return;
    renderRailItems(root, MARATHON_RAIL, '/marathons/', 'Марафоны', 'Открыть все');
  }

  function renderResourceRail(target) {
    const root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!root) return;
    root.innerHTML = RESOURCE_RAIL.map((program) => card(program, 'rail')).join('');
  }

  function renderGrid(target) {
    const root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!root) return;
    root.innerHTML = PROGRAMS.map((program) => card(program, 'grid')).join('');
  }

  function setupSearch(options) {
    const input = document.querySelector(options.input);
    const grid = document.querySelector(options.grid);
    if (!input || !grid) return;
    const empty = document.querySelector(options.empty);
    const title = document.querySelector(options.title);
    const desc = document.querySelector(options.desc);
    const cards = Array.from(grid.querySelectorAll('[data-program-card]'));
    const items = cards.map((node) => ({
      node,
      endpoint: node.dataset.endpoint,
      title: node.querySelector('h3')?.textContent || '',
      desc: node.querySelector('p')?.textContent || '',
      haystack: normalize([node.querySelector('h3')?.textContent, node.querySelector('p')?.textContent].join(' ')),
    }));

    function apply() {
      const query = normalize(input.value);
      let visible = 0;
      items.forEach((item) => {
        const matches = !query || item.haystack.includes(query);
        item.node.classList.toggle('program-search-hidden', !matches);
        if (matches) visible += 1;
      });
      if (empty) empty.classList.toggle('visible', Boolean(query) && visible === 0);
      if (title) title.textContent = query ? 'Подходящие программы' : 'Все программы';
      if (desc) desc.textContent = query
        ? (visible ? `Найдено программ: ${visible}` : 'Совпадений пока нет. Попробуйте другое слово или тему')
        : 'Каталог курсов, практик и программ Системы';
    }

    async function enrich() {
      if (!window.API || !window.API.request) return;
      await Promise.all(items.map(async (item) => {
        if (!item.endpoint) return;
        try {
          const data = await window.API.request('GET', item.endpoint);
          const lessonText = flattenLessons(data)
            .map((lesson) => [lesson.title, lesson.description, lesson.duration].filter(Boolean).join(' '))
            .join(' ');
          item.haystack = normalize([item.title, item.desc, lessonText].join(' '));
        } catch (e) {}
      }));
      apply();
    }

    input.addEventListener('input', apply);
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      input.blur();
    });
    input.addEventListener('search', () => input.blur());
    input.addEventListener('focus', () => document.body.classList.add('program-search-focused'));
    input.addEventListener('blur', () => {
      window.setTimeout(() => document.body.classList.remove('program-search-focused'), 80);
    });
    apply();
    enrich();
  }

  window.ProgramCatalog = { programs: PROGRAMS, renderRail, renderWebinarRail, renderMarathonRail, renderResourceRail, renderGrid, setupSearch };
})();
