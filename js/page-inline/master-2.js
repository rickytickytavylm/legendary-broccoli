(async () => {
      const videoContainer = document.getElementById('video-container');
      const lessonsList    = document.getElementById('lessons-list');
      const infoBlock      = document.getElementById('lesson-info-block');
      const lessonTitleEl  = document.getElementById('lesson-title-main');
      const lessonDescEl   = document.getElementById('lesson-desc-main');
      const COURSE_OVERVIEW = 'Программа о том, как человек строит контакт: в семье, паре, работе и сложных разговорах. Внутри — роли, сценарии, страхи, обиды и практические навыки коммуникации, которые помогают говорить яснее, слышать точнее и выходить из привычных конфликтных кругов.';
      const countEl        = document.getElementById('course-lessons-count');
      const totalCountEl   = document.getElementById('total-count');

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

      function getBadgeLabel(weekNum) {
        if (weekNum === 0) return 'Вводные';
        return 'Урок ' + weekNum;
      }

      function renderGroups(groups) {
        let totalLessons = 0;
        groups.forEach(g => totalLessons += g.lessons.length);
        countEl.textContent = totalLessons + ' ' + (totalLessons === 1 ? 'занятие' : totalLessons < 5 ? 'занятия' : 'занятий');
        totalCountEl.textContent = totalLessons + ' занятий';

        lessonsList.innerHTML = '';
        groups.forEach((group, gi) => {
          const el = document.createElement('div');
          el.className = 'week-group' + (gi === 0 ? ' open' : '');

          el.innerHTML = `
            <div class="week-header">
              <div class="week-header-left">
                <span class="week-badge">${getBadgeLabel(group.week_num)}</span>
                <span class="week-title">${escapeHtml(group.week_title)}</span>
              </div>
              <div class="u-flex-center-gap">
                <span class="week-count">${group.lessons.length} зан.</span>
                <svg class="week-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            <div class="week-lessons"></div>
          `;

          const weekLessonsEl = el.querySelector('.week-lessons');
          group.lessons.forEach((lesson, li) => {
            const isFirst = gi === 0 && li === 0;
            const item = document.createElement('div');
            item.className = 'lesson-item' + (isFirst ? ' active' : '');
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

          el.querySelector('.week-header').addEventListener('click', () => {
            el.classList.toggle('open');
          });

          lessonsList.appendChild(el);
        });
      }

      try {
        lessonsList.innerHTML = Array.from({length: 6}, () => `
          <div class="skeleton-lesson">
            <div class="skeleton-num skeleton-pulse"></div>
            <div class="skeleton-info">
              <div class="skeleton-title skeleton-pulse"></div>
              <div class="skeleton-dur skeleton-pulse"></div>
            </div>
          </div>
        `).join('');

        const groups = await window.API.request('GET', '/content/master-lessons');
        if (window.CourseAI) await window.CourseAI.init('master', groups);
        renderGroups(groups);

        if (groups[0] && groups[0].lessons[0]) {
          if (lessonTitleEl) lessonTitleEl.textContent = groups[0].lessons[0].title;
          if (lessonDescEl) lessonDescEl.textContent = window.CourseAI ? window.CourseAI.summary(groups[0].lessons[0]) || '' : '';
          if (window.CourseAI) window.CourseAI.load(groups[0].lessons[0]);
          if (window.setupVideoPreview) {
            window.setupVideoPreview(videoContainer, {
              poster: '/assets/webp/masterofcommication.webp',
              onStart: () => loadLesson(groups[0].lessons[0]),
            });
          } else {
            loadLesson(groups[0].lessons[0]);
          }
        }
      } catch(e) {
        lessonsList.innerHTML = '<p class="u-error-list">Не удалось загрузить уроки</p>';
      }
    })();
