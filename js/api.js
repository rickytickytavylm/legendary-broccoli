/**
 * API Client for Система Молодцова
 * JWT auth, automatic refresh, video streaming
 */
const API_BASE = window.API_BASE || (location.hostname === 'localhost' ? 'http://localhost:3000/api' : 'https://api.sistema-molodtsov.ru/api');
const API_ORIGIN = new URL(API_BASE, location.href).origin;
const CONTENT_CACHE_TTL = 5 * 60 * 1000;

class ApiClient {
  constructor() {
    this.base = API_BASE;
    this.accessToken = localStorage.getItem('accessToken') || null;
    this.refreshPromise = null;
    this.mePromise = null;
    this.meCache = null;
    this.meCacheAt = 0;
  }

  getAuthHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (this.accessToken) h['Authorization'] = 'Bearer ' + this.accessToken;
    return h;
  }

  getContentCacheKey(path) {
    const authPart = this.accessToken ? this.accessToken.slice(-16) : 'guest';
    return 'sistema:content-cache:' + authPart + ':' + path;
  }

  getMeCacheKey() {
    const authPart = this.accessToken ? this.accessToken.slice(-16) : 'guest';
    return 'sistema:me-cache:' + authPart;
  }

  readMeCache(ttl) {
    if (this.meCache && Date.now() - this.meCacheAt < ttl) return this.meCache;
    try {
      const raw = sessionStorage.getItem(this.getMeCacheKey());
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || Date.now() - cached.savedAt > ttl) return null;
      this.meCache = cached.data;
      this.meCacheAt = cached.savedAt;
      return cached.data;
    } catch (e) {
      return null;
    }
  }

  writeMeCache(data) {
    this.meCache = data;
    this.meCacheAt = Date.now();
    try {
      sessionStorage.setItem(this.getMeCacheKey(), JSON.stringify({
        savedAt: this.meCacheAt,
        data,
      }));
    } catch (e) {}
  }

  readContentCache(path) {
    try {
      const raw = sessionStorage.getItem(this.getContentCacheKey(path));
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || Date.now() - cached.savedAt > CONTENT_CACHE_TTL) return null;
      return cached.data;
    } catch (e) {
      return null;
    }
  }

  writeContentCache(path, data) {
    try {
      sessionStorage.setItem(this.getContentCacheKey(path), JSON.stringify({
        savedAt: Date.now(),
        data,
      }));
    } catch (e) {}
  }

  refreshContentCache(path, url, init) {
    fetch(url, init)
      .then((res) => (res.ok && res.status !== 204 ? res.json() : null))
      .then((data) => {
        if (data !== null) this.writeContentCache(path, data);
      })
      .catch(() => {});
  }

  async request(method, path, body, opts = {}) {
    const url = this.base + path;
    const canUseContentCache = method === 'GET' && path.startsWith('/content/');
    const cachedContent = canUseContentCache ? this.readContentCache(path) : null;
    const init = {
      method,
      headers: { ...this.getAuthHeaders(), ...opts.headers },
      credentials: 'include',
      cache: 'no-store',
    };
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
      init.body = JSON.stringify(body);
    } else if (body) {
      init.body = body;
    }

    if (cachedContent !== null && !opts.fresh) {
      this.refreshContentCache(path, url, init);
      return cachedContent;
    }

    let res = await fetch(url, init);

    // Access token expired — try refresh once
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      if (data.code === 'TOKEN_EXPIRED') {
        const refreshed = await this._doRefresh();
        if (refreshed) {
          init.headers['Authorization'] = 'Bearer ' + this.accessToken;
          res = await fetch(url, init);
        }
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Network error' }));
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    const data = await res.json();
    if (canUseContentCache) this.writeContentCache(path, data);
    return data;
  }

  async _doRefresh() {
    if (this.refreshPromise) return this.refreshPromise;
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    this.refreshPromise = (async () => {
      try {
        const res = await fetch(this.base + '/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) throw new Error('Refresh failed');
        const data = await res.json();
        this.setTokens(data.tokens);
        return true;
      } catch (e) {
        this.logout();
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }

  async restoreSession() {
    if (!localStorage.getItem('refreshToken')) return null;
    if (!this.accessToken) {
      const refreshed = await this._doRefresh();
      if (!refreshed) return null;
    }
    try {
      const data = await this.me();
      return data.user || null;
    } catch (err) {
      return null;
    }
  }

  setTokens(tokens) {
    this.accessToken = tokens.access;
    this.mePromise = null;
    this.meCache = null;
    this.meCacheAt = 0;
    localStorage.setItem('accessToken', tokens.access);
    localStorage.setItem('refreshToken', tokens.refresh);
  }

  logout() {
    this.accessToken = null;
    this.mePromise = null;
    this.meCache = null;
    this.meCacheAt = 0;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    try {
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith('sistema:content-cache:'))
        .forEach((key) => sessionStorage.removeItem(key));
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith('sistema:me-cache:'))
        .forEach((key) => sessionStorage.removeItem(key));
    } catch (e) {}
  }

  isLoggedIn() {
    return !!this.accessToken;
  }

  // --- Auth ---
  register(data) { return this.request('POST', '/auth/register', data); }
  login(data)    { return this.request('POST', '/auth/login', data); }
  requestPhoneCode(data) { return this.request('POST', '/auth/phone/request', data); }
  requestPhoneCall(data) { return this.request('POST', '/auth/phone/request-call', data); }
  verifyPhoneCode(data) { return this.request('POST', '/auth/phone/verify', data); }
  requestMagicLink(data) { return this.request('POST', '/auth/magic/request', data); }
  verifyMagicLink(token) { return this.request('POST', '/auth/magic/verify', { token }); }
  me(opts = {}) {
    const ttl = opts.ttl || 60 * 1000;
    const cached = !opts.fresh ? this.readMeCache(ttl) : null;
    if (cached) return Promise.resolve(cached);
    if (!opts.fresh && this.mePromise) return this.mePromise;
    this.mePromise = this.request('GET', '/auth/me')
      .then((data) => {
        this.writeMeCache(data);
        return data;
      })
      .catch((err) => {
        if (err && err.status === 429 && this.meCache) return this.meCache;
        throw err;
      })
      .finally(() => {
        this.mePromise = null;
      });
    return this.mePromise;
  }
  logoutApi()    { return this.request('POST', '/auth/logout', { refreshToken: localStorage.getItem('refreshToken') }); }
  telegramAuth(initData) { return this.request('POST', '/telegram/auth', { initData }); }
  telegramLoginWidget(data) { return this.request('POST', '/telegram/login-widget', data); }
  yandexLoginUrl(returnTo = location.pathname + location.search + location.hash) {
    return this.base + '/yandex/login?returnTo=' + encodeURIComponent(returnTo || '/');
  }

  // --- Content ---
  getCategories()  { return this.request('GET', '/content/categories'); }
  getPrograms(q)   { return this.request('GET', '/content/programs?' + new URLSearchParams(q)); }
  getProgram(slug) { return this.request('GET', '/content/programs/' + slug); }
  getLesson(id)    { return this.request('GET', '/content/lessons/' + id); }
  saveProgress(data) { return this.request('POST', '/content/progress', data); }

  // --- Video ---
  getVideoToken(lessonId) { return this.request('POST', '/video/token', { lesson_id: lessonId }); }
  async getVideoPresign(slug) {
    try {
      return await this.request('GET', '/video/presign?slug=' + encodeURIComponent(slug));
    } catch (err) {
      if (err.code === 'LOGIN_REQUIRED' || err.code === 'NO_SUBSCRIPTION') {
        if (window.showAccessPrompt) window.showAccessPrompt(err.code);
      }
      throw err;
    }
  }
  async getHlsToken(slug) {
    try {
      return await this.request('GET', '/video/hls-token?slug=' + encodeURIComponent(slug));
    } catch (err) {
      if (err.code === 'LOGIN_REQUIRED' || err.code === 'NO_SUBSCRIPTION') {
        if (window.showAccessPrompt) window.showAccessPrompt(err.code);
      }
      throw err;
    }
  }
  async getVideoStream(slug, opts = {}) {
    try {
      const hls = await this.getHlsToken(slug);
      if (hls && hls.token) {
        const qs = new URLSearchParams({ token: hls.token });
        if (opts.delivery === 'proxy') qs.set('delivery', 'proxy');
        return {
          type: 'hls',
          url: this.base + '/video/hls.m3u8?' + qs.toString(),
          expires_in: hls.expires_in,
        };
      }
    } catch (err) {
      if (err.code !== 'HLS_NOT_READY' && err.status !== 404) throw err;
    }

    const mp4 = await this.getVideoPresign(slug);
    return { type: 'mp4', url: mp4.url, expires_in: mp4.expires_in };
  }
  async getAudioStream(slug) {
    try {
      const audio = await this.request('GET', '/video/audio-token?slug=' + encodeURIComponent(slug));
      return {
        type: 'audio-hls',
        url: this.base + '/video/audio.m3u8?token=' + encodeURIComponent(audio.token),
        expires_in: audio.expires_in,
      };
    } catch (err) {
      if (err.code === 'LOGIN_REQUIRED' || err.code === 'NO_SUBSCRIPTION') {
        if (window.showAccessPrompt) window.showAccessPrompt(err.code);
      }
      throw err;
    }
  }

  // --- Payment ---
  getPlans()       { return this.request('GET', '/payment/plans'); }
  createPayment(data) { return this.request('POST', '/payment/create', data); }
  getSubscription() { return this.request('GET', '/payment/subscription'); }

  // --- AI ---
  getAiUsage() { return this.request('GET', '/ai/usage'); }
  getAiHistory(limit = 80) { return this.request('GET', '/ai/history?limit=' + encodeURIComponent(limit)); }
  sendAiMessage(message) { return this.request('POST', '/ai/message', { message }); }
  async streamAiMessage(message, handlers = {}) {
    const res = await fetch(this.base + '/ai/message/stream', {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({ message }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Network error' }));
      err.status = res.status;
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const handleEvent = (rawEvent) => {
      const lines = rawEvent.split('\n');
      const eventLine = lines.find((line) => line.startsWith('event:'));
      const dataLine = lines.find((line) => line.startsWith('data:'));
      if (!eventLine || !dataLine) return;

      const event = eventLine.slice(6).trim();
      const data = JSON.parse(dataLine.slice(5).trim());
      if (event === 'delta' && handlers.onDelta) handlers.onDelta(data.text || '');
      if (event === 'usage' && handlers.onUsage) handlers.onUsage(data);
      if (event === 'done' && handlers.onDone) handlers.onDone(data);
      if (event === 'error') throw Object.assign(new Error(data.error || 'AI stream error'), data);
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      events.forEach(handleEvent);
    }
  }
}

window.API = new ApiClient();

function isAppleTouchVideoDevice() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  return /iPad|iPhone|iPod/i.test(ua) ||
    (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function shouldPreferMp4ForSlug(slug) {
  return false;
}

window.ensureHlsJs = function ensureHlsJs() {
  if (window.Hls) return Promise.resolve(window.Hls);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-hls-loader="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Hls));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';
    script.async = true;
    script.dataset.hlsLoader = 'true';
    script.onload = () => resolve(window.Hls);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

function ensureAudioMode(video, slug) {
  const container = video.closest('.video-container');
  if (!container) return null;
  if (container._audioMode) return container._audioMode;
  const layout = container.closest('.course-layout') || container.parentElement || document;

  const card = document.createElement('div');
  card.className = 'audio-mode-card hidden';
  card.innerHTML = `
    <div class="audio-mode-shell">
      <div class="audio-mode-topbar">
        <button type="button" class="audio-mode-close" data-audio-close aria-label="Закрыть аудиоплеер">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="audio-mode-eyebrow">Аудиоурок</div>
        <button type="button" class="audio-mode-menu" data-audio-chapters-toggle aria-label="Главы и таймкоды">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>
        </button>
      </div>
      <div class="audio-mode-art">
        <img src="/assets/webp/logo2.webp" alt="" loading="lazy" decoding="async">
      </div>
      <div class="audio-mode-body">
        <div class="audio-mode-meta">
          <div class="audio-mode-title">Слушать урок</div>
          <div class="audio-mode-artist">Система Молодцова</div>
        </div>
        <div class="audio-mode-progress" data-audio-progress><span></span></div>
        <div class="audio-mode-time"><span data-audio-current>0:00</span><span data-audio-duration>0:00</span></div>
        <div class="audio-mode-controls">
          <button type="button" data-audio-track="-1" aria-label="Предыдущий урок">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6v12l-8.5-6L19 6zM7 6h2v12H7z"/></svg>
          </button>
          <button type="button" data-audio-seek="-15" aria-label="Назад на 15 секунд"><span>-15</span></button>
          <button type="button" class="audio-mode-play" data-audio-play aria-label="Воспроизвести">
            <svg class="audio-icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7L8 5z"/></svg>
            <svg class="audio-icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>
          </button>
          <button type="button" data-audio-seek="15" aria-label="Вперёд на 15 секунд"><span>+15</span></button>
          <button type="button" data-audio-track="1" aria-label="Следующий урок">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18V6l8.5 6L5 18zM15 6h2v12h-2z"/></svg>
          </button>
        </div>
        <button type="button" class="audio-mode-chapters-btn" data-audio-chapters-toggle-secondary>Главы и таймкоды</button>
        <div class="audio-mode-chapters hidden" data-audio-chapters></div>
      </div>
    </div>
  `;

  const inline = document.createElement('button');
  inline.type = 'button';
  inline.className = 'audio-inline-card hidden';
  inline.innerHTML = `
    <span class="audio-inline-art"><img src="/assets/webp/logo2.webp" alt="" loading="lazy" decoding="async"></span>
    <span class="audio-inline-copy">
      <span class="audio-inline-kicker">Аудиоверсия</span>
      <strong>Слушать урок</strong>
      <small>Откроется отдельный аудиоплеер</small>
    </span>
  `;

  const existingToggle = container.previousElementSibling && container.previousElementSibling.matches('.media-mode-switch')
    ? container.previousElementSibling
    : null;
  let toggle = existingToggle || document.createElement('div');
  if (existingToggle) {
    const freshToggle = existingToggle.cloneNode(false);
    existingToggle.replaceWith(freshToggle);
    toggle = freshToggle;
  }
  toggle.className = 'media-mode-switch';
  toggle.innerHTML = `
    <button type="button" class="active" data-media-mode="video">Видео</button>
    <button type="button" data-media-mode="audio">Аудио</button>
  `;

  if (!toggle.parentElement) container.insertAdjacentElement('beforebegin', toggle);
  container.appendChild(inline);
  document.body.appendChild(card);

  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  audio.playsInline = true;
  audio.dataset.slug = slug || '';
  card.appendChild(audio);

  const current = card.querySelector('[data-audio-current]');
  const duration = card.querySelector('[data-audio-duration]');
  const progressTrack = card.querySelector('[data-audio-progress]');
  const progress = progressTrack.querySelector('span');
  const play = card.querySelector('[data-audio-play]');
  const title = card.querySelector('.audio-mode-title');
  const modeButtons = toggle.querySelectorAll('[data-media-mode]');
  const chaptersToggle = card.querySelector('[data-audio-chapters-toggle]');
  const chaptersToggleSecondary = card.querySelector('[data-audio-chapters-toggle-secondary]');
  const chaptersPanel = card.querySelector('[data-audio-chapters]');
  let chapters = [];

  function getLessonTitle() {
    return layout.querySelector('.lesson-item.active .lesson-title')?.textContent?.trim() ||
      layout.querySelector('.now-playing')?.textContent?.trim() ||
      document.querySelector('.lesson-item.active .lesson-title')?.textContent?.trim() ||
      'Слушать урок';
  }

  function setTitle() {
    const lessonTitle = getLessonTitle();
    title.textContent = lessonTitle;
    inline.querySelector('strong').textContent = lessonTitle;
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

  function fmt(value) {
    if (!Number.isFinite(value) || value <= 0) return '0:00';
    const total = Math.floor(value);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
  }

  function setMode(mode) {
    const audioMode = mode === 'audio';
    inline.classList.toggle('hidden', !audioMode);
    container.classList.toggle('audio-inline-active', audioMode);
    modeButtons.forEach((button) => button.classList.toggle('active', button.dataset.mediaMode === mode));
    if (audioMode) {
      video.pause();
      setTitle();
    } else {
      closePlayer();
    }
  }

  async function openPlayer(autoplay = true) {
    card.classList.remove('hidden');
    document.body.classList.add('audio-player-open');
    video.pause();
    setTitle();
    await loadAudio();
    if (autoplay) audio.play().catch(() => {});
  }

  function closePlayer() {
    card.classList.add('hidden');
    document.body.classList.remove('audio-player-open');
    audio.pause();
  }

  async function loadAudio() {
    if (audio.dataset.loading === 'true' || audio.getAttribute('src')) return;
    audio.dataset.loading = 'true';
    try {
      const stream = await window.API.getAudioStream(audio.dataset.slug);
      const url = new URL(stream.url, API_ORIGIN).href;
      const Hls = await window.ensureHlsJs().catch(() => null);
      if (Hls && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: false, lowLatencyMode: false });
        audio._hlsInstance = hls;
        hls.loadSource(url);
        hls.attachMedia(audio);
      } else if (audio.canPlayType('application/vnd.apple.mpegurl') || audio.canPlayType('application/x-mpegURL')) {
        audio.setAttribute('src', url);
        audio.load();
      } else {
        throw new Error('Audio HLS is not supported');
      }
      setTitle();
    } catch (err) {
      title.textContent = 'Аудио пока недоступно';
    } finally {
      audio.dataset.loading = 'false';
    }
  }

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mediaMode));
  });
  inline.addEventListener('click', () => openPlayer(true));
  card.querySelector('[data-audio-close]')?.addEventListener('click', closePlayer);
  function toggleChapters() {
    chaptersPanel.classList.toggle('hidden');
  }
  chaptersToggle?.addEventListener('click', toggleChapters);
  chaptersToggleSecondary?.addEventListener('click', toggleChapters);
  play.addEventListener('click', async () => {
    if (audio.paused) {
      await loadAudio();
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  });
  card.querySelectorAll('[data-audio-seek]').forEach((button) => {
    button.addEventListener('click', () => {
      audio.currentTime = Math.max(0, Math.min((audio.duration || Infinity), audio.currentTime + Number(button.dataset.audioSeek || 0)));
    });
  });
  progressTrack?.addEventListener('click', (event) => {
    if (!audio.duration) return;
    const rect = progressTrack.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
  });
  card.querySelectorAll('[data-audio-track]').forEach((button) => {
    button.addEventListener('click', () => {
      const direction = Number(button.dataset.audioTrack || 0);
      const active = layout.querySelector('.lesson-item.active') || document.querySelector('.lesson-item.active');
      const items = active?.parentElement ? Array.from(active.parentElement.querySelectorAll('.lesson-item')) : [];
      const index = items.indexOf(active);
      const next = items[index + direction];
      if (next) next.click();
    });
  });
  function renderChapters(nextChapters) {
    chapters = Array.isArray(nextChapters) ? nextChapters : [];
    if (!chapters.length) {
      chaptersToggle.hidden = true;
      chaptersToggleSecondary.hidden = true;
      chaptersPanel.innerHTML = '';
      chaptersPanel.classList.add('hidden');
      return;
    }
    chaptersToggle.hidden = false;
    chaptersToggleSecondary.hidden = false;
    chaptersPanel.innerHTML = chapters.map((chapter) => `
      <button type="button" data-audio-chapter="${Number(chapter.start_seconds) || 0}">
        <span>${escapeHtml(chapter.start_time || '')}</span>
        <strong>${escapeHtml(chapter.title || 'Глава')}</strong>
      </button>
    `).join('');
  }
  chaptersPanel.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-audio-chapter]');
    if (!button) return;
    await loadAudio();
    audio.currentTime = Math.max(0, Number(button.dataset.audioChapter) || 0);
    audio.play().catch(() => {});
  });
  window.addEventListener('course-ai:chapters', (event) => {
    renderChapters(event.detail && event.detail.chapters);
  });
  audio.addEventListener('play', () => {
    play.setAttribute('aria-label', 'Пауза');
    card.classList.add('is-playing');
  });
  audio.addEventListener('pause', () => {
    play.setAttribute('aria-label', 'Воспроизвести');
    card.classList.remove('is-playing');
  });
  audio.addEventListener('timeupdate', () => {
    current.textContent = fmt(audio.currentTime);
    const pct = audio.duration ? Math.min(100, Math.max(0, (audio.currentTime / audio.duration) * 100)) : 0;
    progress.style.width = `${pct}%`;
  });
  audio.addEventListener('durationchange', () => {
    duration.textContent = fmt(audio.duration);
  });

  const api = {
    setSlug(nextSlug) {
      if (audio.dataset.slug === nextSlug) return;
      if (audio._hlsInstance && typeof audio._hlsInstance.destroy === 'function') audio._hlsInstance.destroy();
      audio._hlsInstance = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      delete audio.dataset.loading;
      audio.dataset.slug = nextSlug || '';
      progress.style.width = '0%';
      current.textContent = '0:00';
      duration.textContent = '0:00';
      setTitle();
      if (document.body.classList.contains('audio-player-open')) {
        loadAudio().then(() => audio.play().catch(() => {}));
      }
    },
    setMode,
    openPlayer,
    renderChapters,
  };
  container._audioMode = api;
  return api;
}

window.prepareAudioMode = function prepareAudioMode(container, slug) {
  const root = typeof container === 'string' ? document.querySelector(container) : container;
  const video = root ? root.querySelector('video') : null;
  if (!video || !slug) return null;
  const audioMode = ensureAudioMode(video, slug);
  if (audioMode) {
    video._audioMode = audioMode;
    audioMode.setSlug(slug);
  }
  return audioMode;
};

window.attachVideoSource = async function attachVideoSource(video, slug, currentHls, setHls) {
  video.setAttribute('controls', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  const audioMode = ensureAudioMode(video, slug);
  if (audioMode) {
    video._audioMode = audioMode;
    audioMode.setSlug(slug);
  }

  if (shouldPreferMp4ForSlug(slug)) {
    const previousHls = currentHls || video._hlsInstance;
    if (previousHls && typeof previousHls.destroy === 'function') previousHls.destroy();
    video._hlsInstance = null;
    if (setHls) setHls(null);
    if (video.getAttribute('src')) video.removeAttribute('src');

    const mp4 = await window.API.getVideoPresign(slug);
    video.dataset.streamFallback = isAppleTouchVideoDevice() ? 'apple-mp4' : 'mp4';
    video.dataset.streamType = 'mp4';
    video.src = new URL(mp4.url, API_ORIGIN).href;
    video.load();
    return { type: 'mp4', url: video.src, expires_in: mp4.expires_in };
  }

  const stream = await window.API.getVideoStream(slug);
  const previousHls = currentHls || video._hlsInstance;
  if (previousHls && typeof previousHls.destroy === 'function') previousHls.destroy();
  video._hlsInstance = null;
  if (setHls) setHls(null);
  if (video.getAttribute('src')) video.removeAttribute('src');

  if (stream.type === 'hls') {
    stream.url = new URL(stream.url, API_ORIGIN).href;
    const Hls = await window.ensureHlsJs().catch(() => null);
    if (Hls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false,
        autoStartLoad: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        manifestLoadingTimeOut: 12000,
        manifestLoadingMaxRetry: 2,
        manifestLoadingRetryDelay: 700,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 4,
        fragLoadingRetryDelay: 700,
      });
      video._hlsInstance = hls;
      if (setHls) setHls(hls);
      await new Promise((resolve, reject) => {
        let settled = false;
        let mediaRecoveryTried = false;
        let tokenRefreshing = false;
        let proxyFallbackTried = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(stream.url);
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          hls.startLoad(0);
          done();
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (!data) return;

          // 401 on segment or manifest — token expired, refresh it
          const is401 = data.response && (data.response.code === 401 || data.response.status === 401);
          if (is401 && !tokenRefreshing) {
            tokenRefreshing = true;
            window.API.getVideoStream(slug)
              .then((newStream) => {
                if (newStream && newStream.url) {
                  const currentTime = video.currentTime || 0;
                  hls.stopLoad();
                  hls.loadSource(new URL(newStream.url, API_ORIGIN).href);
                  hls.startLoad(currentTime);
                }
                tokenRefreshing = false;
              })
              .catch(() => {
                tokenRefreshing = false;
              });
            return;
          }

          if (!data.fatal) return;

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (!proxyFallbackTried) {
              proxyFallbackTried = true;
              window.API.getVideoStream(slug, { delivery: 'proxy' })
                .then((proxyStream) => {
                  if (proxyStream && proxyStream.url) {
                    const currentTime = video.currentTime || 0;
                    video.dataset.streamFallback = 'proxy-hls';
                    hls.stopLoad();
                    hls.loadSource(new URL(proxyStream.url, API_ORIGIN).href);
                    hls.startLoad(currentTime);
                  }
                })
                .catch(() => {
                  hls.startLoad();
                });
              return;
            }
            hls.startLoad();
            return;
          }

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecoveryTried) {
            mediaRecoveryTried = true;
            hls.recoverMediaError();
            return;
          }

          console.error('HLS fatal error', data);
          reject(new Error(data.details || data.type || 'HLS error'));
        });
        hls.attachMedia(video);
        setTimeout(done, 2500);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl') || video.canPlayType('application/x-mpegURL')) {
      let fallbackStarted = false;
      const fallbackToMp4 = async () => {
        if (fallbackStarted || video.dataset.streamFallback === 'mp4') return;
        fallbackStarted = true;
        try {
          const mp4 = await window.API.getVideoPresign(slug);
          video.dataset.streamFallback = 'mp4';
          video.src = new URL(mp4.url, API_ORIGIN).href;
          video.load();
        } catch (err) {}
      };
      video.addEventListener('error', fallbackToMp4, { once: true });
      video.src = stream.url;
      video.load();

      const stalledTimer = setTimeout(() => {
        if (video.readyState < 2 && !fallbackStarted) fallbackToMp4();
      }, 6000);
      video.addEventListener('playing', () => clearTimeout(stalledTimer), { once: true });
      video.addEventListener('canplay', () => clearTimeout(stalledTimer), { once: true });
    } else {
      throw new Error('HLS is not supported');
    }
  } else {
    video.src = new URL(stream.url, API_ORIGIN).href;
    video.load();
  }

  video.dataset.streamType = stream.type;
  return stream;
};
