(function initPsychologistsUI() {
  const psychologists = window.SISTEMA_PSYCHOLOGISTS || [];

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function imageAttrs(person, extra = 'loading="lazy"') {
    const fallback = person.fallbackImage || '/assets/webp/logo2.webp';
    return `src="${escapeHtml(person.image)}" data-fallback="${escapeHtml(fallback)}" alt="${escapeHtml(person.name)}" ${extra} decoding="async"`;
  }

  function tagList(items, limit) {
    return (items || []).slice(0, limit).map((item) => `<span>${escapeHtml(item)}</span>`).join('');
  }

  function bindImageFallbacks(root = document) {
    root.querySelectorAll('img[data-fallback]').forEach((img) => {
      img.addEventListener('error', () => {
        const fallback = img.getAttribute('data-fallback');
        if (fallback && img.src.indexOf(fallback) === -1) img.src = fallback;
      }, { once: true });
    });
  }

  function renderHomeRail() {
    const rail = document.querySelector('[data-psychologists-rail]');
    if (!rail || !psychologists.length) return;
    rail.innerHTML = psychologists.map((person) => `
      <a class="today-psychologist-slot" href="/psychologists/${escapeHtml(person.slug)}/" style="--card-bg:url('${escapeHtml(person.image)}')">
        <span>${escapeHtml((person.role || 'Психолог').split(',')[0].trim())}</span>
        <strong>${escapeHtml(person.shortName || person.name.split(' ')[0])}</strong>
        <small>${escapeHtml(person.railText || '')}</small>
      </a>
    `).join('');
    bindImageFallbacks(rail);
  }

  function renderListPage() {
    const grid = document.querySelector('[data-psychologists-list]');
    if (!grid || !psychologists.length) return;
    grid.innerHTML = psychologists.map((person) => `
      <article class="psych-list-card">
        <a class="psych-list-photo" href="/psychologists/${escapeHtml(person.slug)}/">
          <img ${imageAttrs(person)}>
        </a>
        <div class="psych-list-copy">
          <p class="psych-card-kicker">${escapeHtml(person.role)} · ${escapeHtml(person.experience)}</p>
          <h2><a href="/psychologists/${escapeHtml(person.slug)}/">${escapeHtml(person.name)}</a></h2>
          <p>${escapeHtml(person.listText)}</p>
          <div class="psych-tags">${tagList(person.approaches, 5)}</div>
          <a class="psych-card-link" href="/psychologists/${escapeHtml(person.slug)}/">Открыть профиль</a>
        </div>
      </article>
    `).join('');
    bindImageFallbacks(grid);
  }

  function renderDetailPage() {
    const page = document.querySelector('[data-psychologist-detail]');
    if (!page) return;
    const slug = page.getAttribute('data-psychologist-detail');
    const person = psychologists.find((item) => item.slug === slug) || psychologists[0];
    if (!person) return;
    document.title = `${person.name} — психолог Системы Молодцова`;
    document.body.classList.add('psychologist-detail-page');
    page.innerHTML = `
      <a class="back-link-glass psych-detail-back-source" href="/psychologists/" aria-label="Назад к психологам">Назад</a>
      <section class="psych-detail-hero">
        <div class="psych-detail-photo">
          <img ${imageAttrs(person, 'loading="eager"')}>
        </div>
        <div class="psych-detail-copy">
          <p class="psych-card-kicker">${escapeHtml(person.role)}</p>
          <h1>${escapeHtml(person.name)}</h1>
          <p class="psych-detail-lead">${escapeHtml(person.intro)}</p>
          <div class="psych-tags">${tagList(person.approaches, 7)}</div>
        </div>
      </section>

      <section class="psych-detail-grid">
        <article class="psych-detail-card">
          <h2>Подход</h2>
          ${(person.details || []).map((item) => `<p>${escapeHtml(item)}</p>`).join('')}
        </article>
        <article class="psych-detail-card">
          <h2>С чем можно обратиться</h2>
          <ul>${(person.requests || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </article>
        ${(person.education || []).length ? `<article class="psych-detail-card">
          <h2>Образование и повышение квалификации</h2>
          <ul>${person.education.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </article>` : ''}
        ${(person.conditions || []).length ? `<article class="psych-detail-card">
          <h2>Условия работы</h2>
          <ul>${person.conditions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </article>` : ''}
      </section>

      <div class="psych-detail-cta">
        <a class="psych-book-btn" href="https://t.me/ZabolotnovK" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="20" height="20"><path d="M21.94 4.34a1.5 1.5 0 0 0-1.6-.23L3.3 11.2c-1.06.44-1.02 1.98.06 2.36l4.2 1.47 1.6 5.02c.26.82 1.32 1.02 1.87.36l2.3-2.77 4.2 3.1c.62.46 1.51.13 1.69-.62l3.06-13.6a1.5 1.5 0 0 0-.34-1.36ZM9.7 14.1l8.2-6.06-6.5 7.06-.2 2.94-1.5-3.94Z"/></svg>
          <span>Записаться на консультацию</span>
        </a>
      </div>
    `;
    bindImageFallbacks(page);
  }

  renderHomeRail();
  renderListPage();
  renderDetailPage();
})();
