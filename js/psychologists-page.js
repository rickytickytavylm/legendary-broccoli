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
      <a class="today-psychologist-slot" href="/psychologists/${escapeHtml(person.slug)}/">
        <span class="today-psychologist-photo">
          <img ${imageAttrs(person)}>
        </span>
        <span class="today-psychologist-meta">
          <strong>${escapeHtml(person.name)}</strong>
          <span class="today-psychologist-badge">${escapeHtml(person.experience)}</span>
          <em>${escapeHtml(person.railText)}</em>
        </span>
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
    page.innerHTML = `
      <section class="psych-detail-hero">
        <div class="psych-detail-photo">
          <img ${imageAttrs(person, 'loading="eager"')}>
        </div>
        <div class="psych-detail-copy">
          <a class="psych-back-link" href="/psychologists/">← Все психологи</a>
          <p class="psych-card-kicker">${escapeHtml(person.role)}</p>
          <h1>${escapeHtml(person.name)}</h1>
          <p class="psych-detail-lead">${escapeHtml(person.intro)}</p>
          <div class="psych-tags">${tagList(person.approaches, 7)}</div>
          <div class="psych-detail-actions">
            <a class="psych-secondary-btn" href="/account/">Связаться с куратором</a>
          </div>
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
    `;
    bindImageFallbacks(page);
  }

  renderHomeRail();
  renderListPage();
  renderDetailPage();
})();
