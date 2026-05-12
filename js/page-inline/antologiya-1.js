function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (char) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        }[char]));
      }
    function pluralLessons(n) {
      if (n === 1) return 'урок';
      if (n >= 2 && n <= 4) return 'урока';
      return 'уроков';
    }

    function getSectionDescription(section) {
      return 'Антология — библиотека избранных материалов системы. Это не один линейный курс, а собрание тем и записей, к которым удобно возвращаться для расширения контекста, повторения и самостоятельного изучения.';
    }

    function initSection(section, autoLoad) {
      const secId = section.id;
      const lessons = section.lessons;
      const containerId = `container-${secId}`;
      const videoId = `video-${secId}`;
      const loaderId = `loader-${secId}`;
      const nowId = `now-${secId}`;
      const listId = `list-${secId}`;

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

      function captureFirstFrame(video) {
        video.addEventListener('loadedmetadata', () => {
          video.currentTime = 0.1;
        }, { once: true });
        video.addEventListener('seeked', () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;
            canvas.getContext('2d').drawImage(video, 0, 0);
            const poster = canvas.toDataURL('image/jpeg', 0.8);
            if (poster && poster.length > 100) video.poster = poster;
          } catch (e) {}
        }, { once: true });
      }

      async function loadLesson(lesson) {
        try {
          showLoader();
          const vid = document.getElementById(videoId);
          if (!vid) return;
          await window.attachVideoSource(vid, lesson.video_slug, hlsInstance, (next) => { hlsInstance = next; });
          vid.addEventListener('loadedmetadata', hideLoader, { once: true });
          vid.addEventListener('canplay', hideLoader, { once: true });
          hideLoader();
          const nowEl = document.getElementById(nowId);
          if (nowEl) nowEl.textContent = lesson.ai_title || lesson.title;
          if (window.CourseAI) window.CourseAI.load(lesson, { container: document.getElementById(containerId) });
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
          loadLesson(lessons[parseInt(item.dataset.idx)]);
        });
      });

      if (autoLoad) {
        if (window.setupVideoPreview) {
          window.setupVideoPreview(document.getElementById(containerId), {
            poster: '/assets/webp/antology.webp',
            onStart: () => loadLesson(lessons[0]),
          });
        } else {
          loadLesson(lessons[0]);
        }
      }
    }

    async function init() {
      const container = document.getElementById('antologiya-container');
      try {
        const data = await window.API.request('GET', '/content/antologiya-lessons');
        if (window.CourseAI) await window.CourseAI.init('antologiya', data);
        if (!Array.isArray(data) || data.length === 0) throw new Error('No data');

        container.innerHTML = data.map((section, idx) => `
          ${idx > 0 ? '<hr class="section-divider">' : ''}
          <div class="marathon-section" id="section-${escapeHtml(section.id)}">
            <div class="marathon-section-header">
              <h2 class="marathon-section-title">${escapeHtml(section.title)}</h2>
              <div class="marathon-section-meta">${section.lessons.length} ${pluralLessons(section.lessons.length)} · Антология</div>
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

        data.forEach((section) => initSection(section, true));
      } catch (e) {
        container.innerHTML = '<p class="u-error-muted">Не удалось загрузить материалы</p>';
      }
    }

    init();
