function eventYogaPlural(n) {
  if (n === 1) return 'урок';
  if (n >= 2 && n <= 4) return 'урока';
  return 'уроков';
}

function eventYogaEscapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function eventYogaSectionDescription(section) {
  const descriptions = {
    'yoga-students-course': 'Базовый модуль для учащихся: теория, практика, дыхание, типология характеров, фасции, чакры и методология ведения.',
    'yoga-module-2': 'Продолжение ивента: сеттинг, практики, эмоциональные нарушения, коммуникация, отношения, потребности, диагностика и пранаямы.',
  };
  return descriptions[section.id] || section.description || 'Материалы ивента в формате последовательных видео-уроков.';
}

function eventYogaPoster(section) {
  if (section.id === 'yoga-module-2') return '/assets/webp/event-yoga-logo.webp';
  return '/assets/webp/event-yoga-logo.webp';
}

function eventYogaIsAppleTouchDevice() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  return /iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function initEventYogaSection(section, sectionIndex) {
  const lessons = section.lessons || [];
  const sectionId = section.id || `event-yoga-${sectionIndex || 0}`;
  const video = document.getElementById(`video-${sectionId}`);
  const loader = document.getElementById(`loader-${sectionId}`);
  const list = document.getElementById(`list-${sectionId}`);
  const now = document.getElementById(`now-${sectionId}`);
  const container = document.getElementById(`container-${sectionId}`);
  const sectionEl = document.getElementById(`section-${sectionId}`);
  let hlsInstance = null;

  function setLoading(loading) {
    if (loader) loader.classList.toggle('hidden', !loading);
  }

  function showAccessError() {
    if (now) now.textContent = 'Материал доступен внутри Системы. Войдите или оформите доступ.';
    if (typeof window.showAccessPrompt === 'function') window.showAccessPrompt('NO_SUBSCRIPTION');
  }

  function setVideoMessage(message) {
    if (now) now.textContent = message || '';
  }

  function waitForEvent(target, eventName, timeoutMs = 9000) {
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        resolve({ type: 'timeout' });
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        target.removeEventListener(eventName, onEvent);
        target.removeEventListener('error', onError);
      };
      const onEvent = () => {
        if (done) return;
        done = true;
        cleanup();
        resolve({ type: eventName });
      };
      const onError = () => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error('Video element failed to load'));
      };
      target.addEventListener(eventName, onEvent, { once: true });
      target.addEventListener('error', onError, { once: true });
    });
  }

  async function loadLesson(lesson, options = {}) {
    if (!video || !lesson || !lesson.video_slug) return;
    try {
      setLoading(true);
      const preview = container?.querySelector('.video-preview-overlay');
      if (preview && options.hidePreview !== false) preview.classList.add('hidden');
      if (video.getAttribute('src')) video.removeAttribute('src');
      video.removeAttribute('poster');
      video.pause();
      video.load();

      await window.attachVideoSource(video, lesson.video_slug, hlsInstance, (next) => { hlsInstance = next; });
      video.setAttribute('preload', 'metadata');
      video.onerror = () => {
        setLoading(false);
        setVideoMessage('Не удалось открыть видео. Попробуйте обновить страницу или выбрать урок ещё раз.');
      };
      setVideoMessage(lesson.title || '');

      await waitForEvent(video, 'loadedmetadata').catch(() => null);
      setLoading(false);
      if (preview && options.hidePreview !== false) preview.classList.add('hidden');

      if (options.autoplay && typeof video.play === 'function') {
        await video.play().catch(() => {
          if (!eventYogaIsAppleTouchDevice() && preview) preview.classList.remove('hidden');
        });
      }
    } catch (err) {
      setLoading(false);
      if (err && (err.status === 403 || err.code === 'NO_SUBSCRIPTION')) {
        showAccessError();
        return;
      }
      if (now) now.textContent = 'Видео временно недоступно. Попробуйте обновить страницу или выбрать урок ещё раз.';
    }
  }

  function setupEventYogaPreview() {
    if (!container || !video || container.dataset.eventYogaPreviewReady === 'true') return;
    container.dataset.eventYogaPreviewReady = 'true';

    video.removeAttribute('controls');
    video.setAttribute('preload', 'none');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'video-preview-overlay';
    preview.setAttribute('aria-label', 'Смотреть видео');
    preview.style.backgroundImage = `url('${eventYogaPoster(section)}')`;
    preview.innerHTML = `
      <span class="video-preview-action" aria-hidden="true">
        <span class="video-preview-icon"></span>
        <span class="video-preview-status">
          <span class="video-preview-ring"></span>
          <span>Загрузка</span>
        </span>
      </span>
    `;
    container.appendChild(preview);

    let loadStarted = false;
    preview.addEventListener('click', async () => {
      if (loadStarted) return;
      loadStarted = true;
      preview.classList.add('loading');
      try {
        await loadLesson(lessons[0], {
          autoplay: !eventYogaIsAppleTouchDevice(),
          hidePreview: true,
        });
        preview.classList.remove('loading');
        preview.classList.add('hidden');
      } catch (err) {
        loadStarted = false;
        preview.classList.remove('loading');
        preview.classList.remove('hidden');
      }
    });
  }

  list.innerHTML = lessons.map((lesson, index) => `
    <button class="lesson-item ${index === 0 ? 'active' : ''}" type="button" data-idx="${index}">
      <div class="lesson-number">${index + 1}</div>
      <div class="lesson-info">
        <div class="lesson-title">${eventYogaEscapeHtml(lesson.title)}</div>
        <div class="lesson-dur">${eventYogaEscapeHtml(lesson.duration || 'Видео')}</div>
      </div>
    </button>
  `).join('');

  list.querySelectorAll('.lesson-item').forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      list.querySelectorAll('.lesson-item').forEach((node) => node.classList.remove('active'));
      item.classList.add('active');
      item.blur();
      loadLesson(lessons[Number(item.dataset.idx) || 0], {
        autoplay: !eventYogaIsAppleTouchDevice(),
        hidePreview: true,
      });
      window.requestAnimationFrame(() => {
        const scrollTarget = sectionEl || container || video;
        if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  });

  if (video) video.addEventListener('contextmenu', (event) => event.preventDefault());

  setupEventYogaPreview();
}

async function initEventYoga() {
  const container = document.getElementById('event-yoga-container');
  if (!container) return;
  try {
    const data = await window.API.request('GET', '/content/event-yoga-lessons');
    if (!Array.isArray(data) || data.length === 0) throw new Error('No event data');

    container.innerHTML = data.map((section, index) => {
      const sectionId = eventYogaEscapeHtml(section.id || `event-yoga-${index}`);
      const lessons = section.lessons || [];
      return `
        ${index > 0 ? '<hr class="section-divider">' : ''}
        <section class="event-yoga-section" id="section-${sectionId}">
          <div class="event-yoga-section-header">
            <span>${index === 0 ? 'Модуль 1' : 'Модуль 2'}</span>
            <h2>${eventYogaEscapeHtml(section.title)}</h2>
            <p>${eventYogaEscapeHtml(eventYogaSectionDescription(section))}</p>
          </div>
          <div class="event-yoga-layout">
            <div class="event-yoga-main">
              <div class="video-container event-yoga-video" id="container-${sectionId}">
                <video id="video-${sectionId}" preload="none" class="u-video-fill"></video>
                <div class="watermark"><img src="/assets/webp/logo2.webp" alt="" loading="lazy" decoding="async"></div>
                <div class="video-loader hidden" id="loader-${sectionId}"><div class="apple-spinner">${'<span></span>'.repeat(8)}</div></div>
              </div>
              <div class="now-playing" id="now-${sectionId}">${eventYogaEscapeHtml(lessons[0]?.title || '')}</div>
            </div>
            <aside class="event-yoga-sidebar">
              <div class="sidebar-header">
                <h3>Уроки</h3>
                <span class="lessons-count">${lessons.length} ${eventYogaPlural(lessons.length)}</span>
              </div>
              <div class="event-yoga-list" id="list-${sectionId}"></div>
            </aside>
          </div>
        </section>
      `;
    }).join('');

    data.forEach(initEventYogaSection);
    if (window.location.hash) {
      window.requestAnimationFrame(() => {
        document.querySelector(window.location.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  } catch (err) {
    container.innerHTML = '<p class="u-error-muted">Не удалось загрузить ивент</p>';
  }
}

initEventYoga();
