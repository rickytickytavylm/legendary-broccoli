/**
 * API Client for Система Молодцова
 * JWT auth, automatic refresh, video streaming
 */
const API_BASE = window.API_BASE || (location.hostname === 'localhost' ? 'http://localhost:3000/api' : 'https://api.sistema-molodtsov.ru/api');
const API_ORIGIN = new URL(API_BASE, location.href).origin;

class ApiClient {
  constructor() {
    this.base = API_BASE;
    this.accessToken = localStorage.getItem('accessToken') || null;
    this.refreshPromise = null;
  }

  getAuthHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (this.accessToken) h['Authorization'] = 'Bearer ' + this.accessToken;
    return h;
  }

  async request(method, path, body, opts = {}) {
    const url = this.base + path;
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
    return res.json();
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

  setTokens(tokens) {
    this.accessToken = tokens.access;
    localStorage.setItem('accessToken', tokens.access);
    localStorage.setItem('refreshToken', tokens.refresh);
  }

  logout() {
    this.accessToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  isLoggedIn() {
    return !!this.accessToken;
  }

  // --- Auth ---
  register(data) { return this.request('POST', '/auth/register', data); }
  login(data)    { return this.request('POST', '/auth/login', data); }
  requestPhoneCode(data) { return this.request('POST', '/auth/phone/request', data); }
  verifyPhoneCode(data) { return this.request('POST', '/auth/phone/verify', data); }
  requestMagicLink(data) { return this.request('POST', '/auth/magic/request', data); }
  verifyMagicLink(token) { return this.request('POST', '/auth/magic/verify', { token }); }
  me()           { return this.request('GET', '/auth/me'); }
  logoutApi()    { return this.request('POST', '/auth/logout', { refreshToken: localStorage.getItem('refreshToken') }); }
  telegramAuth(initData) { return this.request('POST', '/telegram/auth', { initData }); }

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
  async getVideoStream(slug) {
    try {
      const hls = await this.getHlsToken(slug);
      if (hls && hls.token) {
        return {
          type: 'hls',
          url: this.base + '/video/hls.m3u8?token=' + encodeURIComponent(hls.token),
          expires_in: hls.expires_in,
        };
      }
    } catch (err) {
      if (err.code !== 'HLS_NOT_READY' && err.status !== 404) throw err;
    }

    const mp4 = await this.getVideoPresign(slug);
    return { type: 'mp4', url: mp4.url, expires_in: mp4.expires_in };
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

window.attachVideoSource = async function attachVideoSource(video, slug, currentHls, setHls) {
  const stream = await window.API.getVideoStream(slug);
  const previousHls = currentHls || video._hlsInstance;
  if (previousHls && typeof previousHls.destroy === 'function') previousHls.destroy();
  video._hlsInstance = null;
  if (setHls) setHls(null);
  video.removeAttribute('src');
  video.load();

  if (stream.type === 'hls') {
    stream.url = new URL(stream.url, API_ORIGIN).href;
    const ua = navigator.userAgent || '';
    const isAppleNativeHls = /iPad|iPhone|iPod/.test(ua) || (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|YaBrowser|Edg|OPR|Firefox/.test(ua));
    if (isAppleNativeHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = stream.url;
      video.load();
    } else {
      const Hls = await window.ensureHlsJs();
      if (!Hls || !Hls.isSupported()) throw new Error('HLS is not supported');
      const hls = new Hls({ enableWorker: true, autoStartLoad: true });
      video._hlsInstance = hls;
      if (setHls) setHls(hls);
      await new Promise((resolve, reject) => {
        let settled = false;
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
          console.warn('HLS error', data);
          if (data && data.fatal) {
            reject(new Error(data.details || data.type || 'HLS error'));
          }
        });
        hls.attachMedia(video);
        setTimeout(done, 2500);
      });
    }
  } else {
    video.src = new URL(stream.url, API_ORIGIN).href;
    video.load();
  }

  video.dataset.streamType = stream.type;
  return stream;
};
