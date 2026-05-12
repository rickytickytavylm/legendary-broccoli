(async () => {
      const videoContainer = document.getElementById('video-container');
      const lessonsList    = document.getElementById('lessons-list');
      const infoBlock      = document.getElementById('lesson-info-block');
      const lessonTitleEl  = document.getElementById('lesson-title-main');
      const lessonDescEl   = document.getElementById('lesson-desc-main');
      const COURSE_OVERVIEW = 'Практический курс о кризисах, травматическом опыте и восстановлении внутренней опоры. Материалы помогают понять, как формируются защитные реакции, где человек застревает после сильных переживаний и как выстраивать бережный путь возвращения к устойчивости, ясности и живому контакту с собой.';
      const FIRST_LESSON_POSTER = '/assets/webp/pane-prew.webp';
      const countEl        = document.getElementById('course-lessons-count');
      const totalCountEl   = document.getElementById('total-count');

      // в"Ђв"Ђ Loader helpers в"Ђв"Ђ
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

      // в"Ђв"Ђ Load lesson в"Ђв"Ђ
      async function loadLesson(lesson) {
        showVideoLoader();
        try {
          const video = document.getElementById('course-video');
          const firstLesson = lesson && lesson._isFirstLesson;
          video.poster = firstLesson ? FIRST_LESSON_POSTER : '';
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

      // в"Ђв"Ђ Render weeks в"Ђв"Ђ
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
                <span class="week-badge">Неделя ${week.week}</span>
                <span class="week-title">${week.title}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="week-count">${week.lessons.length} ур.</span>
                <svg class="week-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            <div class="week-lessons"></div>
          `;

          const weekLessonsEl = group.querySelector('.week-lessons');
          week.lessons.forEach((lesson, li) => {
            const isFirst = wi === 0 && li === 0;
            if (isFirst) lesson._isFirstLesson = true;
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
            const wasOpen = group.classList.contains('open');
            group.classList.toggle('open');
            if (!wasOpen) {
              setTimeout(() => {
                group.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }, 60);
            }
          });

          lessonsList.appendChild(group);
        });
      }

      // в"Ђв"Ђ Boot в"Ђв"Ђ
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

        const weeks = await window.API.request('GET', '/content/dermer-lessons');
        if (window.CourseAI) await window.CourseAI.init('dermer', weeks);
        renderWeeks(weeks);

        // Prepare first lesson without touching the video stream until play.
        if (weeks[0] && weeks[0].lessons[0]) {
          if (lessonTitleEl) lessonTitleEl.textContent = weeks[0].lessons[0].title;
          if (lessonDescEl) lessonDescEl.textContent = window.CourseAI ? window.CourseAI.summary(weeks[0].lessons[0]) || '' : '';
          if (window.CourseAI) window.CourseAI.load(weeks[0].lessons[0]);
          if (window.setupVideoPreview) {
            window.setupVideoPreview(videoContainer, {
              poster: '/assets/webp/pane-prew.webp',
              audioPoster: '/assets/webp/geshtalt.webp',
              onStart: () => loadLesson(weeks[0].lessons[0]),
            });
          } else {
            loadLesson(weeks[0].lessons[0]);
          }
        }
      } catch(e) {
        lessonsList.innerHTML = '<p style="padding:20px;color:rgba(255,255,255,.4);font-size:14px;">Не удалось загрузить уроки</p>';
      }
    })();
