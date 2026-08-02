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
        <button class="psych-book-btn" type="button" data-psych-book>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="20" height="20"><path d="M21.94 4.34a1.5 1.5 0 0 0-1.6-.23L3.3 11.2c-1.06.44-1.02 1.98.06 2.36l4.2 1.47 1.6 5.02c.26.82 1.32 1.02 1.87.36l2.3-2.77 4.2 3.1c.62.46 1.51.13 1.69-.62l3.06-13.6a1.5 1.5 0 0 0-.34-1.36ZM9.7 14.1l8.2-6.06-6.5 7.06-.2 2.94-1.5-3.94Z"/></svg>
          <span>Записаться на консультацию</span>
        </button>
      </div>
    `;
    bindImageFallbacks(page);
    bindBookButton(page, person);
  }

  const BOOK_CONTACTS = {
    telegram: 'https://t.me/ZabolotnovK',
    max: 'https://max.ru/u/f9LHodD0cOLdTeQ_WDJ5-fOVSCctL0CWxtpGZR_UjpMwwb9VlX6qWKYjJpU',
  };

  function trackBookEvent(action, person, channel) {
    try {
      if (window.API && typeof window.API.trackActivity === 'function') {
        window.API.trackActivity('psych_book_click', {
          entity_type: 'psychologist',
          entity_id: person && person.slug ? person.slug : null,
          metadata: {
            action,
            channel: channel || null,
            psychologist: person && person.name ? person.name : null,
          },
        });
      }
    } catch (e) { /* tracking is best-effort */ }
  }

  function closeBookModal() {
    const modal = document.querySelector('.psych-book-modal');
    if (modal) modal.remove();
    document.body.classList.remove('psych-book-modal-open');
    document.removeEventListener('keydown', onBookModalKeydown);
  }

  function onBookModalKeydown(event) {
    if (event.key === 'Escape') closeBookModal();
  }

  function openBookModal(person) {
    if (document.querySelector('.psych-book-modal')) return;
    trackBookEvent('open', person);

    const modal = document.createElement('div');
    modal.className = 'psych-book-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Записаться на консультацию');
    modal.innerHTML = `
      <div class="psych-book-backdrop" data-book-close></div>
      <div class="psych-book-sheet" role="document">
        <button class="psych-book-x" type="button" data-book-close aria-label="Закрыть">&times;</button>
        <p class="psych-book-eyebrow">Контакты специалиста по подбору</p>
        <h3 class="psych-book-title">Поможем выбрать формат и записать</h3>
        <p class="psych-book-sub">Напишите удобным способом — подскажем по запросу, стоимости и подберём время.</p>
        <div class="psych-book-options">
          <a class="psych-book-option psych-book-option-tg" href="${escapeHtml(BOOK_CONTACTS.telegram)}" target="_blank" rel="noopener noreferrer" data-book-channel="telegram">
            <span class="psych-book-option-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M21.94 4.34a1.5 1.5 0 0 0-1.6-.23L3.3 11.2c-1.06.44-1.02 1.98.06 2.36l4.2 1.47 1.6 5.02c.26.82 1.32 1.02 1.87.36l2.3-2.77 4.2 3.1c.62.46 1.51.13 1.69-.62l3.06-13.6a1.5 1.5 0 0 0-.34-1.36ZM9.7 14.1l8.2-6.06-6.5 7.06-.2 2.94-1.5-3.94Z"/></svg>
            </span>
            <span class="psych-book-option-copy">
              <strong>Telegram</strong>
              <small>Написать в Телеграм</small>
            </span>
            <span class="psych-book-option-arrow" aria-hidden="true">↗</span>
          </a>
          <a class="psych-book-option psych-book-option-max" href="${escapeHtml(BOOK_CONTACTS.max)}" target="_blank" rel="noopener noreferrer" data-book-channel="max">
            <span class="psych-book-option-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z"/></svg>
            </span>
            <span class="psych-book-option-copy">
              <strong>MAX</strong>
              <small>Написать в мессенджере MAX</small>
            </span>
            <span class="psych-book-option-arrow" aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    `;

    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-book-close]')) {
        event.preventDefault();
        closeBookModal();
        return;
      }
      const option = event.target.closest('[data-book-channel]');
      if (option) {
        trackBookEvent('contact', person, option.getAttribute('data-book-channel'));
      }
    });

    document.body.appendChild(modal);
    document.body.classList.add('psych-book-modal-open');
    document.addEventListener('keydown', onBookModalKeydown);
  }

  function bindBookButton(page, person) {
    const btn = page.querySelector('[data-psych-book]');
    if (!btn) return;
    btn.addEventListener('click', () => openBookModal(person));
  }

  renderHomeRail();
  renderListPage();
  renderDetailPage();
})();
