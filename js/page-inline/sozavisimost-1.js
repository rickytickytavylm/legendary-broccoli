function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (char) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        }[char]));
      }
    (async function() {
      const lessonsList = document.getElementById('lessons-list');
      const videoContainer = document.getElementById('video-container');
      const courseTitle = document.getElementById('course-title');
      const courseDesc = document.getElementById('course-desc');
      const lessonsCount = document.getElementById('course-lessons-count');
      let lessons = [];
      let hlsInstance = null;
      const COURSE_OVERVIEW = 'Курс помогает распутывать отношения, где забота превращается в контроль, близость — в тревожное слияние, а любовь — в потерю себя. В фокусе: личные границы, эмоциональная зависимость, взрослая позиция и постепенное возвращение собственной опоры без войны с другим человеком.';

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
        const loader = document.getElementById('video-loader');
        if (loader) loader.classList.remove('hidden');
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

      function destroyHls() {
        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
      }

      function restoreVideoEl() {
        if (!document.getElementById('course-video')) {
          videoContainer.innerHTML = '<video id="course-video" preload="none" style="width:100%;height:100%;display:block;border-radius:16px;"></video><div class="watermark"><img src="/assets/webp/logo2.webp" alt="" loading="lazy" decoding="async"></div><div class="video-loader hidden" id="video-loader"><div class="apple-spinner"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div></div>';
        }
        return document.getElementById('course-video');
      }

      async function loadLesson(lesson) {
        try {
          showVideoLoader();
          const video = restoreVideoEl();
          await window.attachVideoSource(video, lesson.video_slug, hlsInstance, (next) => { hlsInstance = next; });
          video.addEventListener('loadedmetadata', hideVideoLoader, { once: true });
          video.addEventListener('canplay', hideVideoLoader, { once: true });
          hideVideoLoader();
          courseTitle.textContent = lesson.title;
          if (courseDesc) courseDesc.textContent = window.CourseAI ? window.CourseAI.summary(lesson) || '' : '';
          if (window.CourseAI) window.CourseAI.load(lesson);
        } catch (err) {
          hideVideoLoader();
          courseTitle.textContent = 'Ошибка';
          courseDesc.textContent = 'Не удалось загрузить видео';
        }
      }

      function renderLessonsList() {
        lessonsList.innerHTML = lessons.map((lesson, idx) => `
          <div class="lesson-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
            <div class="lesson-number">${idx + 1}</div>
            <div class="lesson-info">
              <div class="lesson-title">${escapeHtml(lesson.title)}</div>
              <div class="lesson-dur">${escapeHtml(lesson.duration || '')}</div>
            </div>
          </div>
        `).join('');

        lessonsList.querySelectorAll('.lesson-item').forEach((item) => {
          item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.idx);
            lessonsList.querySelectorAll('.lesson-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            loadLesson(lessons[idx]);
          });
        });
      }

      try {
        renderSkeletons(6);
        const lessons_data = await window.API.request('GET', '/content/sozavisimost-lessons');
        lessons = Array.isArray(lessons_data) ? lessons_data : [];
        if (window.CourseAI) await window.CourseAI.init('sozavisimost', lessons);

        courseTitle.textContent = lessons[0]?.title || 'Урок 1';
        courseDesc.textContent = window.CourseAI ? window.CourseAI.summary(lessons[0]) || '' : '';
        lessonsCount.textContent = lessons.length + ' ' + pluralLessons(lessons.length);

        renderLessonsList();
        if (lessons[0]) {
          if (window.setupVideoPreview) {
            hideVideoLoader();
            window.setupVideoPreview(videoContainer, {
              poster: '/assets/webp/coda2.webp',
              onStart: () => loadLesson(lessons[0]),
            });
          } else {
            loadLesson(lessons[0]);
          }
          if (window.CourseAI) window.CourseAI.load(lessons[0]);
        }
      } catch (err) {
        courseTitle.textContent = 'Курс не найден';
        courseDesc.textContent = 'Не удалось загрузить данные курса';
      }
    })();
