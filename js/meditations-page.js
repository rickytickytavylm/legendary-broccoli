(function initMeditationsPage() {
  const list = document.getElementById('meditations-list');
  const count = document.querySelector('[data-meditations-count]');
  const artwork = '/assets/webp/mmeditation.webp';
  const spaceTrackTitle = 'Взгляд из космоса';
  let tracks = [];
  let currentIndex = 0;
  let audio = null;
  let card = null;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function fmt(value) {
    if (!Number.isFinite(value) || value <= 0) return '0:00';
    const total = Math.floor(value);
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function ensurePlayer() {
    if (card) return;
    card = document.createElement('div');
    card.className = 'audio-mode-card hidden meditation-audio-player';
    card.style.setProperty('--audio-artwork', `url("${artwork}")`);
    card.innerHTML = `
      <div class="audio-mode-shell">
        <div class="audio-mode-topbar">
          <button type="button" class="audio-mode-close" data-close aria-label="Закрыть аудиоплеер">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <div class="audio-mode-eyebrow">Медитация</div>
          <span></span>
        </div>
        <div class="audio-mode-art"><img src="${artwork}" alt="" loading="lazy" decoding="async"></div>
        <div class="audio-mode-body">
          <div class="audio-mode-meta">
            <div class="audio-mode-title" data-title>Медитация</div>
            <div class="audio-mode-artist">Система Молодцова</div>
          </div>
          <div class="audio-mode-progress" data-progress><span></span></div>
          <div class="audio-mode-time"><span data-current>0:00</span><span data-duration>0:00</span></div>
          <div class="audio-mode-controls">
            <button type="button" data-track="-1" aria-label="Предыдущая медитация">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19 20-9-8 9-8v16Z"/><path d="M5 19V5"/></svg>
            </button>
            <button type="button" data-seek="-15" aria-label="Назад на 15 секунд"><span>-15</span></button>
            <button type="button" class="audio-mode-play" data-play aria-label="Воспроизвести">
              <svg class="audio-icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>
              <svg class="audio-icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14"/><path d="M16 5v14"/></svg>
            </button>
            <button type="button" data-seek="15" aria-label="Вперёд на 15 секунд"><span>+15</span></button>
            <button type="button" data-track="1" aria-label="Следующая медитация">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 4 9 8-9 8V4Z"/><path d="M19 5v14"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
    audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.playsInline = true;
    card.appendChild(audio);
    document.body.appendChild(card);

    card.querySelector('[data-close]').addEventListener('click', closePlayer);
    card.querySelector('[data-play]').addEventListener('click', () => {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    });
    card.querySelectorAll('[data-seek]').forEach((button) => {
      button.addEventListener('click', () => {
        audio.currentTime = Math.max(0, Math.min(audio.duration || Infinity, audio.currentTime + Number(button.dataset.seek || 0)));
      });
    });
    card.querySelectorAll('[data-track]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = currentIndex + Number(button.dataset.track || 0);
        openTrack((next + tracks.length) % tracks.length);
      });
    });
    const progressEl = card.querySelector('[data-progress]');
    function seekFromProgressEvent(event) {
      const total = audio.duration;
      if (!Number.isFinite(total) || total <= 0) return;
      const rect = progressEl.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      audio.currentTime = pct * total;
    }
    progressEl.addEventListener('click', (event) => {
      seekFromProgressEvent(event);
    });
    progressEl.addEventListener('pointerdown', (event) => {
      if (event.button > 0) return;
      event.preventDefault();
      try {
        progressEl.setPointerCapture(event.pointerId);
      } catch (e) {}
      seekFromProgressEvent(event);
      const onMove = (moveEvent) => seekFromProgressEvent(moveEvent);
      function onDone(upEvent) {
        seekFromProgressEvent(upEvent);
        try {
          progressEl.releasePointerCapture(event.pointerId);
        } catch (e2) {}
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onDone);
        window.removeEventListener('pointercancel', onDone);
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onDone, { once: true });
      window.addEventListener('pointercancel', onDone, { once: true });
    });
    audio.addEventListener('play', () => card.classList.add('is-playing'));
    audio.addEventListener('pause', () => card.classList.remove('is-playing'));
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('ended', () => openTrack((currentIndex + 1) % tracks.length));
  }

  function isSpaceTrack(track) {
    return String(track?.title || '').trim().toLowerCase() === spaceTrackTitle.toLowerCase();
  }

  function updateProgress() {
    const current = card.querySelector('[data-current]');
    const duration = card.querySelector('[data-duration]');
    const bar = card.querySelector('[data-progress] span');
    const total = audio.duration || 0;
    current.textContent = fmt(audio.currentTime);
    duration.textContent = fmt(total);
    bar.style.width = total ? `${Math.min(100, (audio.currentTime / total) * 100)}%` : '0%';
  }

  function closePlayer() {
    card.classList.add('hidden');
    document.body.classList.remove('audio-player-open');
    audio.pause();
  }

  async function openTrack(index) {
    ensurePlayer();
    currentIndex = index;
    const track = tracks[index];
    list.querySelectorAll('.meditation-track').forEach((node, nodeIndex) => {
      node.classList.toggle('active', nodeIndex === index);
    });
    card.querySelector('[data-title]').textContent = track.title || 'Медитация';
    card.classList.remove('hidden');
    document.body.classList.add('audio-player-open');
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    const data = await window.API.getMeditationAudioUrl(track.audio_key);
    audio.src = data.url;
    audio.load();
    audio.play().catch(() => {});
  }

  function render(data) {
    const section = Array.isArray(data) ? data[0] : null;
    tracks = section?.lessons || [];
    if (count) count.textContent = `${tracks.length} треков`;
    if (!tracks.length) {
      list.innerHTML = '<p class="meditation-error">Медитации пока не найдены.</p>';
      return;
    }
    list.innerHTML = tracks.map((track, index) => `
      <button type="button" class="meditation-track" data-index="${index}">
        <span class="meditation-index${isSpaceTrack(track) ? ' meditation-index-space' : ''}">${index + 1}</span>
        <span>
          <span class="meditation-title">${escapeHtml(track.title)}</span>
          <span class="meditation-duration">${escapeHtml(track.duration || 'Аудио')}</span>
        </span>
        <span class="meditation-play-mini">›</span>
      </button>
    `).join('');
    list.querySelectorAll('.meditation-track').forEach((button) => {
      button.addEventListener('click', () => openTrack(Number(button.dataset.index) || 0));
    });
    const params = new URLSearchParams(window.location.search);
    if (params.get('play') === 'space') {
      const spaceIndex = tracks.findIndex((track) => isSpaceTrack(track));
      if (spaceIndex >= 0) window.setTimeout(() => openTrack(spaceIndex), 180);
    }
  }

  async function init() {
    try {
      const data = await window.API.getMeditations();
      render(data);
    } catch (e) {
      list.innerHTML = '<p class="meditation-error">Не удалось загрузить медитации.</p>';
    }
  }

  init();
}());
