(function () {
  const META = {
    hub: {
      title: 'Инструменты',
      kicker: 'Отношения / созависимость',
      subtitle: 'Практичные карточки для работы с оправданиями, границами, формулировками и тяжёлыми мыслями.',
      image: '/assets/webp/new_soc.webp',
    },
    illusions: {
      title: 'Иллюзии зависимого',
      kicker: 'Защитные механизмы',
      subtitle: 'Узнаваемые фразы и оправдания. Переверните карточку — увидите механизм, страхи и пояснение.',
      dataUrl: '/data/leo/illusions.json',
      image: '/assets/webp/coda2.webp',
    },
    dictionary: {
      title: 'Тематический словарь',
      kicker: 'Термины без каши',
      subtitle: 'Короткие объяснения понятий зависимости и психологии — чтобы говорить на одном языке с материалом.',
      dataUrl: '/data/leo/dictionary.json',
      image: '/assets/webp/find_myself.webp',
    },
    'i-statements': {
      title: 'Я-высказывания',
      kicker: 'Коммуникация',
      subtitle: 'Из обвинения — в ясный разговор о своих чувствах и потребностях. Нажмите карточку, чтобы перевернуть.',
      dataUrl: '/data/leo/i-statements.json',
      image: '/assets/webp/man_woman.webp',
    },
    antivirus: {
      title: 'Эмоциональный антивирус',
      kicker: 'Мысли',
      subtitle: 'Негативная мысль → здоровая альтернатива. Переверните карточку, когда мысль «зациклилась».',
      dataUrl: '/data/leo/antivirus.json',
      image: '/assets/webp/ai_back.webp',
    },
  };

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toolIdFromPath() {
    const parts = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts[0] !== 'tools') return 'hub';
    return parts[1] || 'hub';
  }

  function bindFlip(root) {
    root.querySelectorAll('[data-flip]').forEach((card) => {
      const toggle = () => {
        card.classList.toggle('is-flipped');
        card.setAttribute('aria-pressed', card.classList.contains('is-flipped') ? 'true' : 'false');
      };
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      });
    });
  }

  function renderHub(root, tools) {
    root.innerHTML = `
      <a class="tools-back" href="/">← На главную</a>
      <div class="tools-intro">
        <p class="ios-section-kicker">${escapeHtml(META.hub.kicker)}</p>
        <h1>${escapeHtml(META.hub.title)}</h1>
        <p>${escapeHtml(META.hub.subtitle)}</p>
      </div>
      <div class="tools-hub-grid">
        ${tools
          .map(
            (tool) => `
          <a class="tools-hub-card tools-hub-card-${escapeHtml(tool.id)}" href="${escapeHtml(tool.href)}">
            <div class="tools-hub-card-image" aria-hidden="true"></div>
            <div class="tools-hub-card-copy">
              <span>${tool.count} карточек</span>
              <strong>${escapeHtml(tool.title)}</strong>
              <p>${escapeHtml(tool.desc)}</p>
              <i>Открыть <b>↗</b></i>
            </div>
          </a>`
          )
          .join('')}
      </div>
    `;
  }

  function renderIllusions(root, items) {
    const meta = META.illusions;
    const types = ['Все', ...Array.from(new Set(items.map((item) => item.addictionType).filter(Boolean)))];
    let activeType = 'Все';
    if (types.includes('Созависимость')) activeType = 'Созависимость';

    root.innerHTML = `
      <a class="tools-back" href="/tools/">← Все инструменты</a>
      <div class="tools-intro">
        <p class="ios-section-kicker">${escapeHtml(meta.kicker)}</p>
        <h1>${escapeHtml(meta.title)}</h1>
        <p>${escapeHtml(meta.subtitle)}</p>
      </div>
      <div class="tools-toolbar" data-type-filters></div>
      <div class="tools-list" data-list></div>
    `;

    const filters = root.querySelector('[data-type-filters]');
    const list = root.querySelector('[data-list]');

    function paint() {
      filters.innerHTML = types
        .map(
          (type) =>
            `<button type="button" class="tools-chip${type === activeType ? ' is-active' : ''}" data-type="${escapeHtml(type)}">${escapeHtml(type)}</button>`
        )
        .join('');
      const visible = activeType === 'Все' ? items : items.filter((item) => item.addictionType === activeType);
      if (!visible.length) {
        list.innerHTML = '<div class="tools-empty">Нет карточек для этого фильтра.</div>';
        return;
      }
      list.innerHTML = visible
        .map((item) => {
          const fears = (item.fears || []).map((fear) => `<div class="sm-flip-sub">• ${escapeHtml(fear)}</div>`).join('');
          return `
          <article class="sm-flip is-tall" data-flip tabindex="0" role="button" aria-pressed="false">
            <div class="sm-flip-face sm-flip-front">
              <div class="sm-flip-meta">
                <span class="sm-flip-pill">${escapeHtml(item.addictionType || '')}</span>
                <span class="sm-flip-pill is-soft">${escapeHtml(item.mechanism || '')}</span>
              </div>
              <div class="sm-flip-text"><p>${escapeHtml(item.title)}</p></div>
              <div class="sm-flip-hint">Нажмите, чтобы перевернуть</div>
            </div>
            <div class="sm-flip-face sm-flip-back">
              <div class="sm-flip-meta">
                <span class="sm-flip-pill">${escapeHtml(item.mechanism || '')}</span>
              </div>
              <div class="sm-flip-text" style="display:block;text-align:left;overflow:auto">
                <p style="font-size:14.5px;text-align:left">${escapeHtml(item.explanation)}</p>
                ${item.meaning ? `<div class="sm-flip-sub" style="text-align:left"><strong class="sm-flip-section-label">Смысл:</strong> ${escapeHtml(item.meaning)}</div>` : ''}
                ${fears ? `<div class="sm-flip-sub" style="text-align:left;margin-top:8px"><strong class="sm-flip-section-label">Страхи:</strong>${fears}</div>` : ''}
              </div>
              <div class="sm-flip-hint">Нажмите, чтобы вернуть</div>
            </div>
          </article>`;
        })
        .join('');
      bindFlip(list);
    }

    filters.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-type]');
      if (!btn) return;
      activeType = btn.getAttribute('data-type') || 'Все';
      paint();
    });
    paint();
  }

  function renderFlipPairs(root, meta, items, frontKey, backKey, frontLabel, backLabel) {
    root.innerHTML = `
      <a class="tools-back" href="/tools/">← Все инструменты</a>
      <div class="tools-intro">
        <p class="ios-section-kicker">${escapeHtml(meta.kicker)}</p>
        <h1>${escapeHtml(meta.title)}</h1>
        <p>${escapeHtml(meta.subtitle)}</p>
      </div>
      <div class="tools-list">
        ${items
          .map(
            (item) => `
          <article class="sm-flip" data-flip tabindex="0" role="button" aria-pressed="false">
            <div class="sm-flip-face sm-flip-front">
              <div class="sm-flip-meta"><span class="sm-flip-pill is-soft">${escapeHtml(frontLabel)}</span></div>
              <div class="sm-flip-text"><p>${escapeHtml(item[frontKey])}</p></div>
              <div class="sm-flip-hint">Нажмите, чтобы перевернуть</div>
            </div>
            <div class="sm-flip-face sm-flip-back">
              <div class="sm-flip-meta"><span class="sm-flip-pill">${escapeHtml(backLabel)}</span></div>
              <div class="sm-flip-text"><p>${escapeHtml(item[backKey])}</p></div>
              <div class="sm-flip-hint">Нажмите, чтобы вернуть</div>
            </div>
          </article>`
          )
          .join('')}
      </div>
    `;
    bindFlip(root);
  }

  function renderDictionary(root, items) {
    const meta = META.dictionary;
    root.innerHTML = `
      <a class="tools-back" href="/tools/">← Все инструменты</a>
      <div class="tools-intro">
        <p class="ios-section-kicker">${escapeHtml(meta.kicker)}</p>
        <h1>${escapeHtml(meta.title)}</h1>
        <p>${escapeHtml(meta.subtitle)}</p>
      </div>
      <input class="tools-search" type="search" placeholder="Найти термин…" data-search />
      <div class="tools-list" data-list></div>
    `;
    const list = root.querySelector('[data-list]');
    const search = root.querySelector('[data-search]');

    function paint(query) {
      const q = String(query || '').trim().toLowerCase();
      const visible = !q
        ? items
        : items.filter((item) => `${item.title}\n${item.body}`.toLowerCase().includes(q));
      if (!visible.length) {
        list.innerHTML = '<div class="tools-empty">Ничего не найдено.</div>';
        return;
      }
      list.innerHTML = visible
        .map(
          (item) => `
        <article class="sm-dict-card">
          <h3>${escapeHtml(item.title)}</h3>
          <p class="sm-dict-body">${escapeHtml(item.body)}</p>
        </article>`
        )
        .join('');
    }

    search.addEventListener('input', () => paint(search.value));
    paint('');
  }

  async function init() {
    const root = document.querySelector('[data-tools-root]');
    if (!root) return;
    const toolId = toolIdFromPath();
    const meta = META[toolId] || META.hub;

    document.title = `${meta.title} — Система Молодцова`;
    document.body.dataset.tool = toolId;
    document.body.style.setProperty('--tools-page-image', `url('${meta.image}')`);

    try {
      if (toolId === 'hub') {
        const res = await fetch('/data/leo/index.json', { cache: 'no-store' });
        const data = await res.json();
        renderHub(root, data.tools || []);
        return;
      }
      const res = await fetch(meta.dataUrl, { cache: 'no-store' });
      const items = await res.json();
      if (toolId === 'illusions') renderIllusions(root, items);
      else if (toolId === 'dictionary') renderDictionary(root, items);
      else if (toolId === 'i-statements') {
        renderFlipPairs(root, meta, items, 'aggressive', 'iStatement', 'Агрессивная фраза', 'Я-высказывание');
      } else if (toolId === 'antivirus') {
        renderFlipPairs(root, meta, items, 'virus', 'antivirus', 'Мысль-вирус', 'Антивирус');
      }
    } catch (err) {
      root.innerHTML = '<div class="tools-empty">Не удалось загрузить инструменты. Обновите страницу.</div>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
