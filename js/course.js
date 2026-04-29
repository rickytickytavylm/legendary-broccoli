document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');
  const lessonId = urlParams.get('lesson');

  if (!slug) {
    window.location.href = 'courses.html';
    return;
  }

  const lessonsList = document.getElementById('lessons-list');
  const videoContainer = document.querySelector('.video-container');
  const courseTitle = document.getElementById('course-title');
  const courseDesc = document.getElementById('course-desc');
  const lessonsCount = document.getElementById('course-lessons-count');
  const infoBlock = document.getElementById('lesson-info-block');
  const lessonTitleMain = document.getElementById('lesson-title-main');
  const lessonDescMain = document.getElementById('lesson-desc-main');
  let program = null;
  let lessons = [];
  let hls = null;

  function showError(msg) {
    courseTitle.textContent = 'Ошибка';
    courseDesc.textContent = msg;
    infoBlock.style.display = 'none';
  }

  function destroyHls() {
    if (hls) { hls.destroy(); hls = null; }
  }

  function setupHls(video, src) {
    destroyHls();
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      hls = new Hls({ xhrSetup: (xhr) => { xhr.withCredentials = false; } });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else {
      showError('Ваш браузер не поддерживает HLS. Используйте Safari или Chrome.');
    }
  }

  function showLockedOverlay(lesson, isFirst) {
    destroyHls();
    videoContainer.innerHTML = `
      <div class="video-locked" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;min-height:240px;background:linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.02));border-radius:16px;padding:32px;text-align:center;border:1px solid rgba(255,255,255,.06)">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <h3 style="margin:0;font-size:18px;color:#fff;font-weight:600">${isFirst ? 'Авторизуйтесь' : 'Требуется подписка'}</h3>
        <p style="margin:0;font-size:14px;color:rgba(255,255,255,.5);max-width:280px">
          ${isFirst
            ? 'Первый урок бесплатный. Войдите, чтобы продолжить.'
            : 'Этот урок доступен только по подписке. Оформите доступ, чтобы смотреть все материалы.'}
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
  }

  async function loadLesson(lesson, isFirst) {
    try {
      const res = await window.API.getLesson(lesson.id);
      if (!res.lesson) throw new Error('No lesson data');

      // Restore video element if replaced by locked overlay
      if (!document.getElementById('course-video')) {
        videoContainer.innerHTML = '<video id="course-video" controls preload="metadata" style="width:100%;border-radius:16px"></video>';
      }
      const video = document.getElementById('course-video');

      // Get streaming token
      const tokenRes = await window.API.getVideoToken(lesson.id);
      const streamUrl = tokenRes.stream_url || tokenRes.mp4_url;
      if (!streamUrl) throw new Error('No stream');

      // Build absolute URL
      const videoUrl = streamUrl.startsWith('http')
        ? streamUrl
        : (window.API_BASE || '').replace('/api', '') + streamUrl;

      if (tokenRes.stream_url) {
        setupHls(video, videoUrl);
      } else {
        destroyHls();
        video.src = videoUrl;
      }

      if (infoBlock) infoBlock.style.display = 'flex';
      if (lessonTitleMain) lessonTitleMain.textContent = lesson.title || '';
      if (lessonDescMain) lessonDescMain.textContent = lesson.description || '';
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        if (infoBlock) infoBlock.style.display = 'none';
        showLockedOverlay(lesson, isFirst);
      } else {
        showError('Не удалось загрузить видео');
      }
    }
  }

  function renderLessonsList(activeLessonId) {
    lessonsList.innerHTML = '';
    lessons.forEach((l, i) => {
      const isFirst = i === 0;
      const el = document.createElement('div');
      const isActive = (activeLessonId ? l.id == activeLessonId : isFirst);
      el.className = 'lesson-item' + (isActive ? ' active' : '');
      el.innerHTML = `
        <div class="lesson-number">${isFirst ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>' : (i + 1)}</div>
        <div class="lesson-info">
          <div class="lesson-title">${l.title}</div>
          <div class="lesson-dur">${l.duration || ''}</div>
        </div>
        ${isFirst ? '' : '<div class="lesson-lock"><svg viewBox="0 0 24 24" width="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>'}
      `;
      el.addEventListener('click', () => {
        document.querySelectorAll('.lesson-item').forEach(x => x.classList.remove('active'));
        el.classList.add('active');
        loadLesson(l, isFirst);
      });
      lessonsList.appendChild(el);
    });
  }

  // Load program
  try {
    const data = await window.API.getProgram(slug);
    program = data.program;
    lessons = data.lessons || [];

    courseTitle.textContent = program.title;
    courseDesc.textContent = program.description || '';
    lessonsCount.textContent = lessons.length + ' ' + (lessons.length === 1 ? 'урок' : lessons.length < 5 ? 'урока' : 'уроков');

    renderLessonsList(lessonId);

    // Load first lesson by default (or specified lesson)
    const targetLesson = lessonId
      ? lessons.find(l => l.id == lessonId)
      : lessons[0];
    if (targetLesson) {
      loadLesson(targetLesson, targetLesson === lessons[0]);
    }
  } catch (err) {
    showError('Курс не найден или недоступен');
  }
});