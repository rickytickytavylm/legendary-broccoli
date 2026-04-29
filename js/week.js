(async function() {
  const params = new URLSearchParams(window.location.search);
  const programSlug = params.get('program') || 'dermer';
  const videoContainer = document.getElementById('video-container');
  const accordion = document.getElementById('weeks-accordion');
  const lessonsCount = document.getElementById('lessons-count');
  const courseMeta = document.getElementById('course-meta');
  const infoBlock = document.getElementById('lesson-info-block');
  const lessonTitleMain = document.getElementById('lesson-title-main');
  const lessonDescMain = document.getElementById('lesson-desc-main');

  function showError(msg) {
    courseMeta.textContent = msg;
    if (infoBlock) infoBlock.style.display = 'none';
  }

  function showLockedOverlay(lesson, isFirst) {
    videoContainer.innerHTML = `
      <div class="video-locked">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <h3 style="margin:0;font-size:18px;color:#fff;font-weight:600">${isFirst ? 'Авторизуйтесь' : 'Требуется подписка'}</h3>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,.5);max-width:280px">
          ${isFirst ? 'Первый урок бесплатный. Войдите, чтобы продолжить.' : 'Этот урок доступен только по подписке.'}
        </p>
        <button class="btn btn-primary" id="btn-auth-or-sub" style="padding:12px 24px;border-radius:12px;font-size:14px">
          ${isFirst ? 'Войти' : 'Оформить подписку'}
        </button>
      </div>
    `;
    document.getElementById('btn-auth-or-sub').addEventListener('click', () => {
      if (isFirst) window.openAuthModal('login');
      else window.location.href = 'subscription.html';
    });
    if (infoBlock) infoBlock.style.display = 'none';
  }

  async function loadLesson(lesson, isFirst) {
    try {
      if (!document.getElementById('course-video')) {
        videoContainer.innerHTML = '<video id="course-video" controls preload="metadata" style="width:100%;height:100%;display:block;border-radius:16px;"></video><div class="watermark"><img src="assets/logo2.png" alt=""></div>';
      }
      const video = document.getElementById('course-video');

      let url;
      if (lesson.url) {
        // Static JSON (geshtalt) — direct URL
        url = lesson.url;
      } else {
        // API mode (other programs)
        const res = await window.API.getLesson(lesson.id);
        if (!res.lesson) throw new Error('No lesson data');
        const tokenRes = await window.API.getVideoToken(lesson.id);
        const streamUrl = tokenRes.stream_url || tokenRes.mp4_url;
        if (!streamUrl) throw new Error('No stream');
        url = streamUrl.startsWith('http')
          ? streamUrl
          : (window.API_BASE || '').replace('/api', '') + streamUrl;
      }

      if (url.includes('.m3u8') && typeof Hls !== 'undefined' && Hls.isSupported()) {
        const hls = new Hls({ xhrSetup: (xhr) => { xhr.withCredentials = false; } });
        hls.loadSource(url);
        hls.attachMedia(video);
      } else {
        video.src = url;
      }
      video.play().catch(() => {});

      if (infoBlock) infoBlock.style.display = 'flex';
      if (lessonTitleMain) lessonTitleMain.textContent = lesson.title || '';
      if (lessonDescMain) lessonDescMain.textContent = lesson.description || '';
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        showLockedOverlay(lesson, isFirst);
      } else {
        showError('Не удалось загрузить видео');
      }
    }
  }

  function renderWeeks(lessons) {
    const weeks = {};
    lessons.forEach(l => {
      const wn = l.week_num || 0;
      if (!weeks[wn]) weeks[wn] = [];
      weeks[wn].push(l);
    });
    const weekKeys = Object.keys(weeks).sort((a,b)=>parseInt(a)-parseInt(b));

    accordion.innerHTML = '';
    weekKeys.forEach((wk, wi) => {
      const group = document.createElement('div');
      group.className = 'week-group';
      const toggle = document.createElement('button');
      toggle.className = 'week-toggle' + (wi === 0 ? ' open' : '');
      toggle.innerHTML = `<span>Неделя ${wk}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
      const content = document.createElement('div');
      content.className = 'week-content' + (wi === 0 ? ' open' : '');
      weeks[wk].forEach((l, i) => {
        const isFirst = wi===0 && i===0;
        const row = document.createElement('div');
        row.className = 'lesson-row' + (isFirst ? ' active' : '');
        row.dataset.id = l.id;
        row.innerHTML = `
          <div class="l-num">${i+1}</div>
          <div class="l-info">
            <div class="l-title">${l.title}</div>
            <div class="l-dur">${l.duration || ''}</div>
          </div>
          ${isFirst ? '' : '<div class="l-lock"><svg viewBox="0 0 24 24" width="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>'}
        `;
        row.addEventListener('click', () => {
          document.querySelectorAll('.lesson-row').forEach(r => r.classList.remove('active'));
          row.classList.add('active');
          loadLesson(l, isFirst);
        });
        content.appendChild(row);
      });
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('open');
        content.classList.toggle('open');
      });
      group.appendChild(toggle);
      group.appendChild(content);
      accordion.appendChild(group);
    });
  }

  try {
    let lessons;
    if (programSlug === 'geshtalt') {
      const res = await fetch('https://web-production-3cb7a.up.railway.app/api/content/geshtalt-lessons');
      lessons = await res.json();
    } else {
      const data = await window.API.getProgram(programSlug);
      lessons = data.lessons || [];
    }

    lessonsCount.textContent = lessons.length + ' ' + (lessons.length === 1 ? 'урок' : lessons.length < 5 ? 'урока' : 'уроков');
    document.title = 'Гештальт — Система Молодцова';

    renderWeeks(lessons);

    const targetLesson = lessons[0];
    if (targetLesson) {
      loadLesson(targetLesson, true);
    }
  } catch (err) {
    showError('Курс не найден или недоступен');
  }
})();
