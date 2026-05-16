(function initMeditationsPage() {
  const list = document.getElementById('meditations-list');
  const count = document.querySelector('[data-meditations-count]');
  const artwork = '/assets/webp/mmeditation.webp';
  const spaceTrackTitle = 'Взгляд из космоса';
  let tracks = [];
  let currentIndex = 0;
  let audio = null;
  let card = null;
  let previewVideo = null;
  let playerVideo = null;
  let playerHls = null;
  let previewHls = null;

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
      <video class="meditation-space-video meditation-space-video-player" muted playsinline loop preload="metadata" aria-hidden="true"></video>
      <div class="audio-mode-shell">
        <div class="audio-mode-topbar">
          <button type="button" class="audio-mode-close" data-close aria-label="Закрыть аудиоплеер">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <div class="audio-mode-eyebrow">Медитация</div>
          <span></span>
        </div>
        <div class="audio-mode-art"><video class="meditation-space-video meditation-space-video-art" muted playsinline loop preload="metadata" aria-hidden="true"></video><img src="${artwork}" alt="" loading="lazy" decoding="async"></div>
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
    playerVideo = card.querySelector('.meditation-space-video-player');

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
    card.querySelector('[data-progress]').addEventListener('click', (event) => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      audio.currentTime = ((event.clientX - rect.left) / rect.width) * audio.duration;
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

  function attachHls(video, onReady) {
    if (!video || !window.API?.getMeditationBackgroundHlsUrl) return null;
    const src = window.API.getMeditationBackgroundHlsUrl();
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', onReady, { once: true });
      return null;
    }
    if (window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(window.Hls.Events.MANIFEST_PARSED, onReady);
      return hls;
    }
    return null;
  }

  function startVideo(video) {
    if (!video) return;
    video.play().catch(() => {});
  }

  function stopVideo(video) {
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  }

  function ensurePreviewVideo() {
    const preview = document.querySelector('.meditation-player-preview');
    if (!preview || previewVideo) return;
    previewVideo = document.createElement('video');
    previewVideo.className = 'meditation-space-video meditation-space-video-preview';
    previewVideo.muted = true;
    previewVideo.playsInline = true;
    previewVideo.loop = true;
    previewVideo.preload = 'metadata';
    previewVideo.setAttribute('aria-hidden', 'true');
    preview.prepend(previewVideo);
    previewHls = attachHls(previewVideo, () => startVideo(previewVideo));
  }

  function setSpaceMode(enabled) {
    ensurePlayer();
    const artVideo = card.querySelector('.meditation-space-video-art');
    card.classList.toggle('meditation-space-active', enabled);
    if (!playerHls && enabled) {
      playerHls = attachHls(playerVideo, () => startVideo(playerVideo));
      attachHls(artVideo, () => startVideo(artVideo));
    }
    if (enabled) {
      startVideo(playerVideo);
      startVideo(artVideo);
    } else {
      stopVideo(playerVideo);
      stopVideo(artVideo);
    }
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
    const spaceTrack = isSpaceTrack(track);
    list.querySelectorAll('.meditation-track').forEach((node, nodeIndex) => {
      node.classList.toggle('active', nodeIndex === index);
    });
    card.querySelector('[data-title]').textContent = track.title || 'Медитация';
    setSpaceMode(spaceTrack);
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
      ensurePreviewVideo();
      const data = await window.API.getMeditations();
      render(data);
    } catch (e) {
      list.innerHTML = '<p class="meditation-error">Не удалось загрузить медитации.</p>';
    }
  }

  init();
}());
