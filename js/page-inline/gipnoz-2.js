(async () => {
      const videoContainer = document.getElementById('video-container');
      const lessonsList    = document.getElementById('lessons-list');
      const infoBlock      = document.getElementById('lesson-info-block');
      const lessonTitleEl  = document.getElementById('lesson-title-main');
      const lessonDescEl   = document.getElementById('lesson-desc-main');
      const COURSE_OVERVIEW = 'Курс раскрывает гипноз как точную работу с вниманием, внушением и состояниями сознания, а не как сценический эффект. В материалах — принципы транса, терапевтическое применение техник и границы безопасной практики, чтобы инструмент оставался профессиональным и управляемым.';
      const countEl        = document.getElementById('course-lessons-count');
      const totalCountEl   = document.getElementById('total-count');

      // ── Loader helpers ──
      function showVideoLoader() {
        const vid = document.getElementById('course-video');
        if (vid) vid.setAttribute('controls', '');
        let loader = document.getElementById('video-loader');
        if (!loader) {
          loader = document.createElement('div');
          loader.id = 'video-loader';
          loader.className = 'video-loader';
          loader.innerHTML = '<div class="apple-spinner">' + '<span></span>'.repeat(8) + '</div>';
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
            const c = document.createElement('canvas');
            c.width = video.videoWidth || 1280;
            c.height = video.videoHeight || 720;
            c.getContext('2d').drawImage(video, 0, 0);
            const poster = c.toDataURL('image/jpeg', 0.8);
            if (poster && poster.length > 100) video.poster = poster;
          } catch(e) {}
        }, { once: true });
      }

      // ── Load lesson ──
      async function loadLesson(lesson) {
        showVideoLoader();
        try {
          const video = document.getElementById('course-video');
          await window.attachVideoSource(video, lesson.video_slug);
          video.addEventListener('loadedmetadata', hideVideoLoader, { once: true });
          video.addEventListener('canplay', hideVideoLoader, { once: true });
          hideVideoLoader();
          if (infoBlock) infoBlock.style.display = 'flex';
          if (lessonTitleEl) lessonTitleEl.textContent = lesson.title;
          if (lessonDescEl) lessonDescEl.textContent = window.CourseAI ? window.CourseAI.summary(lesson) || '' : '';
          if (window.CourseAI) window.CourseAI.load(lesson);
        } catch(e) {
          hideVideoLoader();
        }
      }

      // ── Render weeks ──
      function renderWeeks(weeks, firstLesson) {
        let totalLessons = 0;
        weeks.forEach(w => totalLessons += w.lessons.length);
        countEl.textContent = totalLessons + ' ' + (totalLessons === 1 ? 'урок' : totalLessons < 5 ? 'урока' : 'уроков');
        totalCountEl.textContent = totalLessons + ' уроков';

        lessonsList.innerHTML = '';
        weeks.forEach((week, wi) => {
          const group = document.createElement('div');
          group.className = 'week-group' + (wi === 0 ? ' open' : '');

          group.innerHTML = `
            <div class="week-header">
              <div class="week-header-left">
                <span class="week-badge">Модуль ${week.week}</span>
                <span class="week-title">${week.title}</span>
              </div>
              <div class="u-flex-center-gap">
                <span class="week-count">${week.lessons.length} ур.</span>
                <svg class="week-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            <div class="week-lessons"></div>
          `;

          const weekLessonsEl = group.querySelector('.week-lessons');
          week.lessons.forEach((lesson, li) => {
            const isFirst = wi === 0 && li === 0;
            const item = document.createElement('div');
            item.className = 'lesson-item' + (isFirst ? ' active' : '');
            item.dataset.id = lesson.id;
            item.innerHTML = `
              <div class="lesson-number">${li + 1}</div>
              <div class="lesson-info">
                <div class="lesson-title">${escapeHtml(lesson.title)}</div>
                <div class="lesson-dur">${escapeHtml(lesson.duration || '')}</div>
              </div>
            `;
            item.addEventListener('click', () => {
              document.querySelectorAll('.lesson-item').forEach(x => x.classList.remove('active'));
              item.classList.add('active');
              loadLesson(lesson);
            });
            weekLessonsEl.appendChild(item);
          });

          group.querySelector('.week-header').addEventListener('click', () => {
            group.classList.toggle('open');
          });

          lessonsList.appendChild(group);
        });
      }

      // ── Boot ──
      try {
        // Skeleton
        lessonsList.innerHTML = Array.from({length: 6}, () => `
          <div class="skeleton-lesson">
            <div class="skeleton-num skeleton-pulse"></div>
            <div class="skeleton-info">
              <div class="skeleton-title skeleton-pulse"></div>
              <div class="skeleton-dur skeleton-pulse"></div>
            </div>
          </div>
        `).join('');

        const weeks = await window.API.request('GET', '/content/gipnoz-lessons');
        if (window.CourseAI) await window.CourseAI.init('gipnoz', weeks);
        renderWeeks(weeks);

        // Prepare first lesson without touching the video stream until play.
        if (weeks[0] && weeks[0].lessons[0]) {
          if (lessonTitleEl) lessonTitleEl.textContent = weeks[0].lessons[0].title;
          if (lessonDescEl) lessonDescEl.textContent = window.CourseAI ? window.CourseAI.summary(weeks[0].lessons[0]) || '' : '';
          if (window.CourseAI) window.CourseAI.load(weeks[0].lessons[0]);
          if (window.setupVideoPreview) {
            window.setupVideoPreview(videoContainer, {
              poster: '/assets/webp/hipno.webp',
              onStart: () => loadLesson(weeks[0].lessons[0]),
            });
          } else {
            loadLesson(weeks[0].lessons[0]);
          }
        }
      } catch(e) {
        lessonsList.innerHTML = '<p class="u-error-list">Не удалось загрузить уроки</p>';
      }
    })();
