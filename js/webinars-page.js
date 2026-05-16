function webinarPlural(n) {
  if (n === 1) return 'запись';
  if (n >= 2 && n <= 4) return 'записи';
  return 'записей';
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

function initWebinarSection(section) {
  const lessons = section.lessons || [];
  const sectionId = section.id || 'webinars';
  const video = document.getElementById(`video-${sectionId}`);
  const loader = document.getElementById(`loader-${sectionId}`);
  const list = document.getElementById(`list-${sectionId}`);
  const now = document.getElementById(`now-${sectionId}`);
  let hlsInstance = null;

  function setLoading(loading) {
    if (loader) loader.classList.toggle('hidden', !loading);
  }

  async function loadLesson(lesson) {
    if (!video || !lesson?.video_slug) return;
    try {
      setLoading(true);
      await window.attachVideoSource(video, lesson.video_slug, hlsInstance, (next) => { hlsInstance = next; });
      video.setAttribute('controls', '');
      video.addEventListener('loadedmetadata', () => setLoading(false), { once: true });
      video.addEventListener('canplay', () => setLoading(false), { once: true });
      if (now) now.textContent = lesson.title || '';
      setLoading(false);
    } catch (e) {
      setLoading(false);
      if (now) now.textContent = 'Видео появится после загрузки и HLS-конвертации.';
    }
  }

  list.innerHTML = lessons.map((lesson, index) => `
    <div class="lesson-item ${index === 0 ? 'active' : ''}" data-idx="${index}">
      <div class="lesson-number">${index + 1}</div>
      <div class="lesson-info">
        <div class="lesson-title">${escapeHtml(lesson.title)}</div>
        <div class="lesson-dur">${escapeHtml(lesson.duration || 'Вебинар')}</div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.lesson-item').forEach((item) => {
    item.addEventListener('click', () => {
      list.querySelectorAll('.lesson-item').forEach((node) => node.classList.remove('active'));
      item.classList.add('active');
      loadLesson(lessons[Number(item.dataset.idx) || 0]);
    });
  });

  if (window.setupVideoPreview) {
    window.setupVideoPreview(document.getElementById(`container-${sectionId}`), {
      poster: '/assets/webp/hope.webp',
      audioSlug: lessons[0]?.video_slug,
      onStart: () => loadLesson(lessons[0]),
    });
  } else {
    loadLesson(lessons[0]);
  }
}

async function initWebinars() {
  const container = document.getElementById('webinars-container');
  try {
    const data = await window.API.request('GET', '/content/webinars-lessons');
    if (!Array.isArray(data) || data.length === 0) throw new Error('No webinars data');

    container.innerHTML = data.map((section) => {
      const sectionId = escapeHtml(section.id || 'webinars');
      const lessons = section.lessons || [];
      return `
        <section class="webinars-section" id="section-${sectionId}">
          <div class="webinars-section-header">
            <h2 class="webinars-section-title">${escapeHtml(section.title || 'Записи вебинаров')}</h2>
            <p class="webinars-section-desc">Три записи из публичной папки. Сейчас готовим streaming-версии и транскрибацию, чтобы добавить таймкоды и AI-разборы.</p>
          </div>
          <div class="course-layout">
            <div class="course-main">
              <div class="video-container" id="container-${sectionId}">
                <video id="video-${sectionId}" preload="none" class="u-video-fill"></video>
                <div class="watermark"><img src="/assets/webp/logo2.webp" alt="" loading="lazy" decoding="async"></div>
                <div class="video-loader hidden" id="loader-${sectionId}"><div class="apple-spinner">${'<span></span>'.repeat(8)}</div></div>
              </div>
              <div class="now-playing" id="now-${sectionId}">${escapeHtml(lessons[0]?.title || '')}</div>
            </div>
            <div class="course-sidebar">
              <div class="sidebar-header">
                <h3>Записи</h3>
                <span class="lessons-count">${lessons.length} ${webinarPlural(lessons.length)}</span>
              </div>
              <div id="list-${sectionId}"></div>
            </div>
          </div>
        </section>
      `;
    }).join('');

    data.forEach(initWebinarSection);
  } catch (e) {
    container.innerHTML = '<p class="u-error-muted">Не удалось загрузить вебинары</p>';
  }
}

initWebinars();
