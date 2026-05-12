(async function() {
      const lessonsList = document.getElementById('lessons-list');
      const videoContainer = document.getElementById('video-container');
      const courseTitle = document.getElementById('course-title');
      const courseDesc = document.getElementById('course-desc');
      const lessonsCount = document.getElementById('course-lessons-count');
      const infoBlock = document.getElementById('lesson-info-block');
      const lessonTitleMain = document.getElementById('lesson-title-main');
      const lessonDescMain = document.getElementById('lesson-desc-main');
      const aiTimelinePanel = document.getElementById('ai-timeline-panel');
      const aiPanel = document.getElementById('ai-lesson-panel');
      let lessons = [];
      let hlsInstance = null;
      const COURSE_OVERVIEW = 'Гештальт-подход помогает увидеть, как человек теряет контакт с собой, прячет потребности, обрывает чувства и повторяет незавершённые сценарии. Внутри курса — теория, практика и терапевтические разборы, которые переводят осознавание из красивого слова в рабочий инструмент: яснее чувствовать, точнее выбирать и честнее строить отношения.';
      const aiLessonIndex = new Map();

      function pluralLessons(n) {
        if (n === 1) return 'урок';
        if (n >= 2 && n <= 4) return 'урока';
        return 'уроков';
      }

      function renderSkeletons(n = 6) {
        lessonsList.innerHTML = Array.from({ length: n }, () => `
          <div class="skeleton-lesson">
            <div class="skeleton-num skeleton-pulse"></div>
            <div class="skeleton-info">
              <div class="skeleton-title skeleton-pulse"></div>
              <div class="skeleton-dur skeleton-pulse"></div>
            </div>
          </div>
        `).join('');
      }

      function showVideoLoader() {
        const vid = document.getElementById('course-video');
        if (vid) vid.setAttribute('controls', '');
        let loader = document.getElementById('video-loader');
        if (!loader) {
          loader = document.createElement('div');
          loader.id = 'video-loader';
          loader.className = 'video-loader';
          loader.innerHTML = `<div class="apple-spinner">${'<span></span>'.repeat(8)}</div>`;
          videoContainer.appendChild(loader);
        }
        loader.classList.remove('hidden');
      }

      function hideVideoLoader() {
        const loader = document.getElementById('video-loader');
        if (loader) loader.classList.add('hidden');
        const vid = document.getElementById('course-video');
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
      function showError(msg) {
        if (courseTitle) courseTitle.textContent = 'Ошибка';
        if (courseDesc) courseDesc.textContent = msg;
        if (aiPanel) {
          aiPanel.classList.add('visible');
          aiPanel.innerHTML = '<div class="ai-lesson-inner"><h3 class="ai-lesson-title">Ошибка</h3><p class="ai-lesson-summary">' + escapeHtml(msg) + '</p></div>';
        }
        if (infoBlock) infoBlock.style.display = 'none';
      }

      function destroyHls() {
        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
      }


      function restoreVideoEl() {
        if (!document.getElementById('course-video')) {
          videoContainer.innerHTML = '<video id="course-video" controls preload="metadata" class="u-video-fill"></video><div class="watermark"><img src="/assets/webp/logo2.webp" alt="" loading="lazy" decoding="async"></div>';
        }
        return document.getElementById('course-video');
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

      function lessonAiUrl(lesson) {
        return lesson.ai_index && lesson.ai_index.file ? `/data/ai/geshtalt/${lesson.ai_index.file}?v=2` : `/data/ai/geshtalt/lesson-${String(Number(lesson.id) || 0).padStart(3, '0')}.json?v=2`;
      }

      function lessonDisplayTitle(lesson) {
        return lesson.ai_title || lesson.title || '';
      }

      async function loadAiIndex() {
        try {
          const res = await fetch('/data/ai/geshtalt/index.json?v=2', { cache: 'force-cache' });
          if (!res.ok) return;
          const data = await res.json();
          (data.lessons || []).forEach((item) => {
            if (item && item.id != null) aiLessonIndex.set(Number(item.id), item);
          });
        } catch (e) {}
      }

      function applyAiTitles() {
        lessons = lessons.map((lesson) => {
          const ai = aiLessonIndex.get(Number(lesson.id));
          return ai && ai.has_ai ? {
            ...lesson,
            ai_index: ai,
            ai_title: ai.ai_title || lesson.title,
            ai_short_summary: ai.short_summary || '',
            duration: ai.duration || '',
          } : lesson;
        });
      }

      function jumpToAiChapter(seconds) {
        const video = document.getElementById('course-video');
        if (!video || !Number.isFinite(seconds)) return;
        video.setAttribute('controls', '');
        video.currentTime = Math.max(0, seconds);
        const playPromise = video.play ? video.play() : null;
        if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
        video.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      function renderAiAnalysis(data) {
        if (!data || !data.ai) return;
        const ai = data.ai;
        const chapters = Array.isArray(ai.chapters) ? ai.chapters : [];
        if (aiTimelinePanel) {
          aiTimelinePanel.classList.add('visible');
          aiTimelinePanel.innerHTML = `
            <div class="course-ai-section-head">
              <h3>Таймкоды</h3>
              <p>Нажмите, чтобы перейти к моменту</p>
            </div>
            <div class="ai-lesson-timeline">
              ${chapters.map((chapter) => `
                <button type="button" class="ai-time-chip" data-seconds="${Number(chapter.start_seconds) || 0}">
                  <span class="ai-time-chip-time">${escapeHtml(chapter.start_time || '')}</span>
                  <span class="ai-time-chip-title">${escapeHtml(chapter.title || '')}</span>
                </button>
              `).join('')}
            </div>
          `;
          aiTimelinePanel.querySelectorAll('.ai-time-chip').forEach((button) => {
            button.addEventListener('click', () => jumpToAiChapter(Number(button.dataset.seconds)));
          });
        }

        if (!aiPanel) return;
        aiPanel.classList.add('visible');
        aiPanel.classList.remove('expanded');
        aiPanel.innerHTML = `
          <div class="ai-lesson-inner">
            <span class="ai-lesson-badge">Ai разбор</span>
            <h3 class="ai-lesson-title">${escapeHtml(ai.clean_title || ai.title || 'Разбор урока')}</h3>
            <p class="ai-lesson-summary">${escapeHtml(ai.short_summary || '')}</p>
            <div class="ai-lesson-actions">
              <button type="button" class="ai-toggle-btn" id="ai-toggle-btn">Открыть разбор</button>
            </div>
            <div class="ai-expanded" id="ai-expanded">
              <h4 class="ai-section-title">Саммари урока</h4>
              <div class="ai-rich-text">${escapeHtml(ai.summary || '')}</div>
              <h4 class="ai-section-title u-mt-20">Что важно вынести</h4>
              <div class="ai-rich-text">${escapeHtml(ai.lesson_card && ai.lesson_card.why_watch ? ai.lesson_card.why_watch : '')}</div>
            </div>
          </div>
        `;

        const toggle = document.getElementById('ai-toggle-btn');
        if (toggle) {
          toggle.addEventListener('click', () => {
            const expanded = aiPanel.classList.toggle('expanded');
            toggle.textContent = expanded ? 'Свернуть разбор' : 'Открыть разбор';
          });
        }

      }

      async function loadAiAnalysis(lesson) {
        if (aiTimelinePanel) {
          aiTimelinePanel.classList.remove('visible');
          aiTimelinePanel.innerHTML = '';
        }
        if (aiPanel) {
          aiPanel.classList.remove('visible', 'expanded');
          aiPanel.innerHTML = '';
        }
        try {
          const res = await fetch(lessonAiUrl(lesson), { cache: 'force-cache' });
          if (!res.ok) return;
          renderAiAnalysis(await res.json());
        } catch (e) {}
      }

      async function loadLesson(lesson, isFirst) {
        try {
          showVideoLoader();

          const video = restoreVideoEl();

          await window.attachVideoSource(video, lesson.video_slug, hlsInstance, (next) => { hlsInstance = next; });
          video.addEventListener('loadedmetadata', hideVideoLoader, { once: true });
          video.addEventListener('canplay', hideVideoLoader, { once: true });
          hideVideoLoader();

        } catch (err) {
          hideVideoLoader();
          showError('Не удалось загрузить видео');
        }
      }

      function renderLessonsList() {
        lessonsList.innerHTML = lessons.map((lesson, idx) => `
          <div class="lesson-item ${idx === 0 ? 'active' : ''}" data-id="${escapeHtml(lesson.id)}">
            <div class="lesson-number">${idx + 1}</div>
            <div class="lesson-info">
              <div class="lesson-title">${escapeHtml(lessonDisplayTitle(lesson))}</div>
              <div class="lesson-dur">${escapeHtml(lesson.duration || '')}</div>
            </div>
          </div>
        `).join('');

        lessonsList.querySelectorAll('.lesson-item').forEach((item, idx) => {
          item.addEventListener('click', () => {
            const lessonId = parseInt(item.dataset.id);
            const lesson = lessons.find(l => l.id === lessonId);
            if (lesson) {
              lessonsList.querySelectorAll('.lesson-item').forEach(i => i.classList.remove('active'));
              item.classList.add('active');
              loadAiAnalysis(lesson);
              loadLesson(lesson, idx === 0);
            }
          });
        });
      }

      try {
        renderSkeletons(8);
        const lessons_data = await window.API.request('GET', '/content/geshtalt-lessons');
        lessons = Array.isArray(lessons_data) ? lessons_data : [];
        await loadAiIndex();
        applyAiTitles();

        if (courseTitle) courseTitle.textContent = 'Гештальт-подход';
        if (courseDesc) courseDesc.textContent = window.CourseAI ? window.CourseAI.summary(lessons[0]) || COURSE_OVERVIEW : COURSE_OVERVIEW;
        lessonsCount.textContent = lessons.length + ' ' + pluralLessons(lessons.length);

        renderLessonsList();
        if (lessons[0]) loadAiAnalysis(lessons[0]);

        if (lessons[0]) {
          if (window.setupVideoPreview) {
            hideVideoLoader();
            window.setupVideoPreview(videoContainer, {
              poster: '/assets/webp/geshtalt-prew.webp',
              audioPoster: '/assets/webp/courses.webp',
              onStart: () => loadLesson(lessons[0], true),
            });
          } else {
            loadLesson(lessons[0], true);
          }
        }
      } catch (err) {
        showError('Курс не найден или недоступен');
      }
    })();
