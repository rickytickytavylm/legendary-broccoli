(function initCourseAI() {
  const state = { course: '', byId: new Map(), byVideo: new Map() };

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/\\/g, '/')
      .replace(/ё/g, 'е')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[^\p{L}\p{N}]+/gu, '');
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

  function flattenLessons(data) {
    if (!Array.isArray(data)) return [];
    if (data.every((item) => Array.isArray(item.lessons))) {
      return data.flatMap((group) => group.lessons || []);
    }
    return data;
  }

  function findIndexItem(lesson) {
    return state.byId.get(String(lesson?.id)) || state.byVideo.get(normalize(lesson?.video_slug));
  }

  function applyIndex(lesson, item) {
    if (!lesson || !item || !item.has_ai) return;
    lesson.ai_index = item;
    lesson.ai_title = item.ai_title || lesson.title;
    lesson.ai_short_summary = item.short_summary || '';
    lesson.title = lesson.ai_title || lesson.title;
    lesson.duration = item.duration || '';
  }

  function ensurePanels(target) {
    const video = target || document.getElementById('video-container');
    const main = video ? video.closest('.course-main') : document.querySelector('.course-main');
    if (!main || !video) return {};

    let timeline = target ? main.querySelector('.ai-timeline-panel') : document.getElementById('ai-timeline-panel');
    if (!timeline) {
      timeline = document.createElement('section');
      if (!target) timeline.id = 'ai-timeline-panel';
      timeline.className = 'ai-timeline-panel';
      timeline.setAttribute('aria-label', 'Таймкоды урока');
      video.insertAdjacentElement('afterend', timeline);
    }

    let panel = target ? main.querySelector('.ai-lesson-panel') : document.getElementById('ai-lesson-panel');
    if (!panel) {
      panel = document.createElement('section');
      if (!target) panel.id = 'ai-lesson-panel';
      panel.className = 'ai-lesson-panel';
      panel.setAttribute('aria-live', 'polite');
      timeline.insertAdjacentElement('afterend', panel);
    }

    return { timeline, panel };
  }

  function jumpTo(seconds, target) {
    const video = target?.querySelector('video') ||
      target?.closest('.course-main')?.querySelector('video') ||
      document.getElementById('course-video') ||
      document.querySelector('.course-main video');
    if (!video || !Number.isFinite(seconds)) return;
    video.setAttribute('controls', '');
    video.currentTime = Math.max(0, seconds);
    const play = video.play ? video.play() : null;
    if (play && typeof play.catch === 'function') play.catch(() => {});
    video.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function render(data, target) {
    const { timeline, panel } = ensurePanels(target);
    if (!timeline || !panel) return;
    const ai = data?.ai;
    if (!ai) {
      timeline.classList.remove('visible');
      panel.classList.remove('visible', 'expanded');
      timeline.innerHTML = '';
      panel.innerHTML = '';
      return;
    }

    const chapters = Array.isArray(ai.chapters) ? ai.chapters : [];
    const chapterSlug = data?.lesson?.video_slug || data?.source?.key;
    if (chapterSlug) {
      window.__courseAIChaptersByVideoSlug = window.__courseAIChaptersByVideoSlug || {};
      window.__courseAIChaptersByVideoSlug[normalize(chapterSlug)] = chapters;
    }
    window.dispatchEvent(new CustomEvent('course-ai:chapters', {
      detail: {
        lessonId: data?.lesson?.id,
        videoSlug: chapterSlug,
        chapters,
      },
    }));
    timeline.classList.toggle('visible', chapters.length > 0);
    timeline.innerHTML = chapters.length ? `
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
    ` : '';
    timeline.querySelectorAll('.ai-time-chip').forEach((button) => {
      button.addEventListener('click', () => jumpTo(Number(button.dataset.seconds), target));
    });

    panel.classList.add('visible');
    panel.classList.remove('expanded');
    panel.innerHTML = `
      <div class="ai-lesson-inner">
        <span class="ai-lesson-badge">Ai разбор</span>
        <h3 class="ai-lesson-title">${escapeHtml(ai.clean_title || ai.title || 'Разбор урока')}</h3>
        <p class="ai-lesson-summary">${escapeHtml(ai.short_summary || '')}</p>
        <div class="ai-lesson-actions">
          <button type="button" class="ai-toggle-btn">Открыть разбор</button>
        </div>
        <div class="ai-expanded">
          <h4 class="ai-section-title">Саммари урока</h4>
          <div class="ai-rich-text">${escapeHtml(ai.summary || '')}</div>
          <h4 class="ai-section-title u-mt-20">Что важно вынести</h4>
          <div class="ai-rich-text">${escapeHtml(ai.lesson_card?.why_watch || ai.audience_value || '')}</div>
        </div>
      </div>
    `;
    const toggle = panel.querySelector('.ai-toggle-btn');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const expanded = panel.classList.toggle('expanded');
        toggle.textContent = expanded ? 'Свернуть разбор' : 'Открыть разбор';
      });
    }
  }

  async function init(course, lessonsOrGroups) {
    state.course = course;
    state.byId = new Map();
    state.byVideo = new Map();

    try {
      const res = await fetch(`/data/ai/${course}/index.json?v=2`, { cache: 'force-cache' });
      if (!res.ok) return lessonsOrGroups;
      const index = await res.json();
      (index.lessons || []).forEach((item) => {
        if (item.id != null) state.byId.set(String(item.id), item);
        if (item.video_slug) state.byVideo.set(normalize(item.video_slug), item);
      });
      flattenLessons(lessonsOrGroups).forEach((lesson) => applyIndex(lesson, findIndexItem(lesson)));
    } catch (e) {}
    return lessonsOrGroups;
  }

  async function load(lesson, options = {}) {
    const target = options.container || null;
    const item = lesson?.ai_index || findIndexItem(lesson);
    const desc = document.getElementById('course-desc') || document.getElementById('lesson-desc-main');
    if (desc) desc.textContent = lesson?.ai_short_summary || item?.short_summary || '';
    if (!item?.has_ai || !item.file || !state.course) {
      render(null, target);
      return;
    }
    try {
      const res = await fetch(`/data/ai/${state.course}/${item.file}?v=2`, { cache: 'force-cache' });
      if (!res.ok) return render(null, target);
      render(await res.json(), target);
    } catch (e) {
      render(null, target);
    }
  }

  window.CourseAI = {
    init,
    load,
    summary(lesson) {
      return lesson?.ai_short_summary || lesson?.ai_index?.short_summary || '';
    },
  };
})();
