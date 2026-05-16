function pluralLessons(n) {
  if (n === 1) return 'урок';
  if (n >= 2 && n <= 4) return 'урока';
  return 'уроков';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function getSectionDescription(section) {
  const descriptions = {
    samoocenka: 'Блок о самооценке, внутренней опоре и привычных способах оценивать себя через чужую реакцию. Помогает мягко пересобрать отношение к себе и увидеть, где самоценность подменяется доказательством.',
    konflikty: 'Марафон о конфликтах, границах и способах говорить о сложном без разрушения контакта. Фокус на понимании своих реакций, позиции другого человека и более зрелой коммуникации.',
    rezakina: 'Практический блок о психологической готовности к материнству, беременности как кризисном периоде, эмоциональном состоянии мамы, привязанности, страхах и родительском выгорании.',
  };
  return descriptions[section.id] || 'Короткая прикладная программа по отдельной психологической теме. Формат помогает быстро войти в материал и пройти несколько последовательных шагов.';
}

function getSectionPoster(section) {
  const posters = {
    samoocenka: '/assets/webp/myself_mar.webp',
    konflikty: '/assets/webp/conflicts.webp',
    rezakina: '/assets/webp/maraphones.webp',
  };
  return posters[section.id] || '/assets/webp/maraphones.webp';
}

function initSection(section, idx, autoLoad) {
  const secId = section.id;
  const lessons = section.lessons;
  const videoId = `video-${secId}`;
  const containerId = `container-${secId}`;
  const listId = `list-${secId}`;
  const loaderId = `loader-${secId}`;
  const nowId = `now-${secId}`;
  const sectionPoster = getSectionPoster(section);

  let hlsInstance = null;

  function showLoader() {
    const vid = document.getElementById(videoId);
    if (vid) vid.setAttribute('controls', '');
    const loader = document.getElementById(loaderId);
    if (loader) loader.classList.remove('hidden');
  }

  function hideLoader() {
    const loader = document.getElementById(loaderId);
    if (loader) loader.classList.add('hidden');
    const vid = document.getElementById(videoId);
    if (vid) vid.setAttribute('controls', '');
  }

  function renderLessonAI(lesson) {
    if (window.CourseAI) window.CourseAI.load(lesson, { container: document.getElementById(containerId) });
  }

  async function loadLesson(lesson) {
    try {
      showLoader();
      const vid = document.getElementById(videoId);
      if (!vid) return;
      const preview = document.getElementById(containerId)?.querySelector('.video-preview-overlay');
      if (preview) preview.classList.add('hidden');
      await window.attachVideoSource(vid, lesson.video_slug, hlsInstance, (next) => { hlsInstance = next; });
      vid.addEventListener('loadedmetadata', hideLoader, { once: true });
      vid.addEventListener('canplay', hideLoader, { once: true });
      hideLoader();
      const nowEl = document.getElementById(nowId);
      if (nowEl) nowEl.textContent = lesson.ai_title || lesson.title;
      renderLessonAI(lesson);
    } catch (e) {
      hideLoader();
    }
  }

  const listEl = document.getElementById(listId);
  listEl.innerHTML = lessons.map((l, i) => `
    <div class="lesson-item ${i === 0 ? 'active' : ''}" data-idx="${i}">
      <div class="lesson-number">${i + 1}</div>
      <div class="lesson-info">
        <div class="lesson-title">${escapeHtml(l.title)}</div>
        <div class="lesson-dur">${escapeHtml(l.duration || '')}</div>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('.lesson-item').forEach(item => {
    item.addEventListener('click', () => {
      listEl.querySelectorAll('.lesson-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const lesson = lessons[parseInt(item.dataset.idx)];
      renderLessonAI(lesson);
      loadLesson(lesson);
    });
  });

  renderLessonAI(lessons[0]);

  if (window.setupVideoPreview) {
    window.setupVideoPreview(document.getElementById(containerId), {
      poster: sectionPoster,
      audioSlug: lessons[0]?.video_slug,
      onStart: () => loadLesson(lessons[0]),
    });
  } else if (autoLoad) {
    loadLesson(lessons[0]);
  }
}

async function initMarathons() {
  const container = document.getElementById('marathons-container');
  try {
    const data = await window.API.request('GET', '/content/marathons-lessons');
    if (window.CourseAI) await window.CourseAI.init('marathons', data);
    if (!Array.isArray(data) || data.length === 0) throw new Error('No data');

    container.innerHTML = data.map((section, idx) => `
      ${idx > 0 ? '<hr class="section-divider">' : ''}
      <div class="marathon-section" id="section-${escapeHtml(section.id)}">
        <div class="marathon-section-header">
          <h2 class="marathon-section-title">${escapeHtml(section.title)}</h2>
          <div class="marathon-section-meta">${section.lessons.length} ${pluralLessons(section.lessons.length)} · Марафон</div>
          <p class="marathon-section-desc">${escapeHtml(getSectionDescription(section))}</p>
        </div>
        <div class="course-layout">
          <div class="course-main">
            <div class="video-container" id="container-${escapeHtml(section.id)}">
              <video id="video-${escapeHtml(section.id)}" preload="none" class="u-video-fill"></video>
              <div class="watermark"><img src="/assets/webp/logo2.webp" alt="" loading="lazy" decoding="async"></div>
              <div class="video-loader hidden" id="loader-${escapeHtml(section.id)}"><div class="apple-spinner">${'<span></span>'.repeat(8)}</div></div>
            </div>
            <div class="now-playing" id="now-${escapeHtml(section.id)}"></div>
          </div>
          <div class="course-sidebar">
            <div class="sidebar-header">
              <h3>Уроки</h3>
              <span class="lessons-count">${section.lessons.length} ${pluralLessons(section.lessons.length)}</span>
            </div>
            <div id="list-${escapeHtml(section.id)}"></div>
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('video').forEach((video) => {
      video.addEventListener('contextmenu', (event) => event.preventDefault());
    });
    data.forEach((section, idx) => initSection(section, idx, idx === 0));
    if (window.location.hash) {
      window.requestAnimationFrame(() => {
        document.querySelector(window.location.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  } catch (e) {
    container.innerHTML = '<p class="u-error-muted">Не удалось загрузить марафоны</p>';
  }
}

initMarathons();
