/**
 * API Client for Система Молодцова
 * JWT auth, automatic refresh, video streaming
 */
const API_BASE = window.API_BASE || (location.hostname === 'localhost' ? 'http://localhost:3000/api' : 'https://api.sistema-molodtsov.ru/api');
const API_ORIGIN = new URL(API_BASE, location.href).origin;
const CONTENT_CACHE_TTL = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;
const ACTIVITY_CLICK_MIN_INTERVAL_MS = 650;
const ACCESS_TOKEN_SKEW_SECONDS = 30;

function decodeJwtPayload(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function isAccessTokenExpired(token, skewSeconds = ACCESS_TOKEN_SKEW_SECONDS) {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return false;
  return payload.exp <= Math.floor(Date.now() / 1000) + skewSeconds;
}

function clampActivityText(value, max = 180) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function getPageLabel() {
  const title = document.querySelector('h1')?.textContent || document.title || location.pathname;
  return clampActivityText(title, 140);
}

function getElementLabel(element) {
  if (!element) return '';
  return clampActivityText(
    element.getAttribute('data-track-label') ||
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.innerText ||
    element.textContent ||
    element.value ||
    element.id ||
    element.className,
    160
  );
}

function getElementDescriptor(element) {
  if (!element) return {};
  return {
    tag: String(element.tagName || '').toLowerCase(),
    id: element.id || null,
    class_name: clampActivityText(element.className || '', 160) || null,
    text: getElementLabel(element) || null,
    href: element.getAttribute('href') || null,
    type: element.getAttribute('type') || null,
    name: element.getAttribute('name') || null,
    dataset: {
      track: element.getAttribute('data-track') || null,
      section: element.getAttribute('data-section') || null,
      slug: element.getAttribute('data-slug') || null,
      lesson: element.getAttribute('data-lesson-id') || element.getAttribute('data-lesson') || null,
    },
  };
}

class ApiClient {
  constructor() {
    this.base = API_BASE;
    this.accessToken = localStorage.getItem('accessToken') || null;
    this.refreshPromise = null;
    this.mePromise = null;
    this.meCache = null;
    this.meCacheAt = 0;
    this.subscriptionPromise = null;
    this.subscriptionCache = null;
    this.subscriptionCacheAt = 0;
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

  needsAuthRefresh() {
    if (!localStorage.getItem('refreshToken')) return false;
    return !this.accessToken || isAccessTokenExpired(this.accessToken);
  }

  async ensureFreshAccessToken(opts = {}) {
    if (opts.skipAuthRefresh || !this.needsAuthRefresh()) return !!this.accessToken;
    return this._doRefresh();
  }

  needsRestoredAuth(path, opts = {}) {
    if (opts.requireAuth === true) return true;
    if (opts.requireAuth === false) return false;
    return path.startsWith('/chat/')
      || path === '/payment/subscription'
      || path.startsWith('/payment/create')
      || path.startsWith('/profile/')
      || path.startsWith('/video/hls-token')
      || path.startsWith('/video/audio-token')
      || path.startsWith('/video/presign');
  }

  async fetchWithTimeout(url, init = {}, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
    if (!timeoutMs || typeof AbortController === 'undefined') return fetch(url, init);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: init.signal || controller.signal });
    } catch (err) {
      if (err && err.name === 'AbortError') {
        const timeoutErr = new Error('Request timeout');
        timeoutErr.code = 'REQUEST_TIMEOUT';
        timeoutErr.status = 0;
        timeoutErr.timeoutMs = timeoutMs;
        timeoutErr.url = String(url);
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async request(method, path, body, opts = {}) {
    const trimBase = String(this.base || '').replace(/\/+$/u, '');
    let rel = path.startsWith('/') ? path : '/' + path;
    if (/\/api$/iu.test(trimBase) && /^\/api\//u.test(rel)) {
      rel = rel.replace(/^\/api/u, '') || '/';
    }
    const url = trimBase + rel;
    const canUseContentCache = method === 'GET' && path.startsWith('/content/') && opts.cacheContent === true;
    const cachedContent = canUseContentCache ? this.readContentCache(path) : null;

    // On iOS Safari pages can boot before accessToken is restored from refreshToken.
    // Restore it before calling protected endpoints.
    const shouldRestoreAuth = this.needsRestoredAuth(path, opts);
    if (this.needsAuthRefresh() && !opts.skipAuthRefresh) {
      const refreshed = await this.ensureFreshAccessToken(opts);
      if (!refreshed && shouldRestoreAuth) {
        const err = new Error('Login required');
        err.code = 'LOGIN_REQUIRED';
        err.status = 401;
        throw err;
      }
    }

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

    let res = await this.fetchWithTimeout(url, init, opts);

    // Access token expired — try refresh once
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      if (data.code === 'USER_INVALID' || data.code === 'TOKEN_INVALID' || data.code === 'TOKEN_REVOKED') {
        this.clearLocalState();
        throw Object.assign(data, { status: res.status });
      }
      if ((data.code === 'TOKEN_EXPIRED' || data.code === 'NO_TOKEN') && localStorage.getItem('refreshToken')) {
        const refreshed = await this._doRefresh();
        if (refreshed) {
          init.headers['Authorization'] = 'Bearer ' + this.accessToken;
          res = await this.fetchWithTimeout(url, init, opts);
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
        const res = await this.fetchWithTimeout(this.base + '/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        }, { skipAuthRefresh: true });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const err = Object.assign(new Error(data.error || 'Refresh failed'), data);
          err.status = res.status;
          throw err;
        }
        this.setTokens(data.tokens);
        return true;
      } catch (e) {
        if (e && e.status === 401) this.logout();
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }

  clearContentCache() {
    try {
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith('sistema:content-cache:'))
        .forEach((key) => sessionStorage.removeItem(key));
    } catch (e) {}
  }

  clearSubscriptionCache() {
    this.subscriptionPromise = null;
    this.subscriptionCache = null;
    this.subscriptionCacheAt = 0;
    this.mePromise = null;
    this.meCache = null;
    this.meCacheAt = 0;
    try {
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith('sistema:me-cache:') || key.startsWith('sistema:content-cache:'))
        .forEach((key) => sessionStorage.removeItem(key));
    } catch (e) {}
  }

  async restoreSession() {
    if (!localStorage.getItem('refreshToken')) return null;
    const refreshed = await this.ensureFreshAccessToken();
    if (!refreshed) return null;
    try {
      const data = await this.me();
      return data.user || null;
    } catch (err) {
      if (err && (err.code === 'USER_INVALID' || err.code === 'TOKEN_INVALID' || err.code === 'TOKEN_REVOKED')) {
        this.clearLocalState();
      }
      return null;
    }
  }

  setTokens(tokens) {
    this.accessToken = tokens.access;
    this.mePromise = null;
    this.meCache = null;
    this.meCacheAt = 0;
    this.subscriptionPromise = null;
    this.subscriptionCache = null;
    this.subscriptionCacheAt = 0;
    localStorage.setItem('accessToken', tokens.access);
    localStorage.setItem('refreshToken', tokens.refresh);
  }

  logout() {
    this.accessToken = null;
    this.mePromise = null;
    this.meCache = null;
    this.meCacheAt = 0;
    this.subscriptionPromise = null;
    this.subscriptionCache = null;
    this.subscriptionCacheAt = 0;
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

  clearLocalState() {
    this.logout();
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('sistema:'))
        .forEach((key) => localStorage.removeItem(key));
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith('sistema:'))
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
    if (this.mePromise) return this.mePromise;
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
  updateProfile(data) {
    return this.request('PATCH', '/profile/me', data).then((res) => {
      this.meCache = null;
      this.meCacheAt = 0;
      this.mePromise = null;
      try { sessionStorage.removeItem(this.getMeCacheKey()); } catch (e) {}
      return res;
    });
  }
  logActivity(data) { return this.request('POST', '/profile/activity', data); }
  trackActivity(eventType, data = {}) {
    if (!this.isLoggedIn()) return Promise.resolve({ skipped: true });
    return this.logActivity({
      event_type: eventType,
      entity_type: data.entity_type || null,
      entity_id: data.entity_id || null,
      metadata: {
        path: location.pathname,
        search: location.search || '',
        hash: location.hash || '',
        title: getPageLabel(),
        referrer: document.referrer || '',
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        ...(data.metadata || {}),
      },
    }).catch(() => ({ skipped: true }));
  }
  getMeditations() { return this.request('GET', '/content/meditations-lessons'); }
  getMeditationAudioUrl(key) { return this.request('GET', '/content/meditations-audio-url?key=' + encodeURIComponent(key)); }

  // --- Video ---
  getVideoToken(lessonId) { return this.request('POST', '/video/token', { lesson_id: lessonId }); }
  async getVideoPresign(slug) {
    try {
      return await this.request('GET', '/video/presign?slug=' + encodeURIComponent(slug));
    } catch (err) {
      throw err;
    }
  }
  async getHlsToken(slug) {
    try {
      return await this.request('GET', '/video/hls-token?slug=' + encodeURIComponent(slug));
    } catch (err) {
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
      if (err && (err.code === 'NO_SUBSCRIPTION' || err.status === 403)) {
        if (typeof window.openSubscriptionModalForAccess === 'function') {
          window.openSubscriptionModalForAccess();
        } else {
          window.location.href = '/subscription/';
        }
      }
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
        tracks: Array.isArray(audio.tracks) ? audio.tracks : [],
        duration_seconds: audio.duration_seconds || null,
        expires_in: audio.expires_in,
      };
    } catch (err) {
      throw err;
    }
  }

  // --- Payment ---
  getPlans()       { return this.request('GET', '/payment/plans'); }
  createPayment(data) { return this.request('POST', '/payment/create', data); }
  confirmPayment() {
    return this.request('POST', '/payment/confirm')
      .then((data) => {
        if (data) {
          this.subscriptionCache = data;
          this.subscriptionCacheAt = Date.now();
        }
        this.clearPendingPaymentConfirm();
        return data;
      });
  }
  maybeConfirmPayment() {
    if (!this.hasPendingPaymentConfirm()) return Promise.resolve(null);
    return this.confirmPayment().catch(() => null);
  }
  activateTrial() {
    return this.request('POST', '/payment/activate-trial')
      .then((data) => {
        if (data) {
          this.subscriptionCache = data;
          this.subscriptionCacheAt = Date.now();
          this.subscriptionPromise = null;
          if (data.subscription_active) {
            window.__sistemaSubscriptionActive = true;
            window.__sistemaSubscriptionExpiresAt = data.expires_at
              ? new Date(data.expires_at).getTime() || null
              : null;
          }
        }
        return data;
      });
  }
  isSubscriptionActive(subscription) {
    return !!(subscription && subscription.subscription_active === true);
  }
  markPendingPaymentConfirm() {
    try { sessionStorage.setItem('sistema:pending-payment-confirm', '1'); } catch (e) {}
  }

  clearPendingPaymentConfirm() {
    try { sessionStorage.removeItem('sistema:pending-payment-confirm'); } catch (e) {}
  }

  hasPendingPaymentConfirm() {
    try { return sessionStorage.getItem('sistema:pending-payment-confirm') === '1'; } catch (e) { return false; }
  }

  redirectToPayment(payment) {
    if (!payment || !payment.payment_url) return false;
    this.markPendingPaymentConfirm();
    if (payment.payment_method === 'post' && payment.payment_fields) {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = payment.payment_url;
      form.style.display = 'none';
      Object.entries(payment.payment_fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value == null ? '' : String(value);
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
      return true;
    }
    window.location.href = payment.payment_url;
    return true;
  }
  getSubscription(opts = {}) {
    const ttl = opts.ttl || 55000;
    if (!opts.fresh && this.subscriptionCache && Date.now() - this.subscriptionCacheAt < ttl) {
      return Promise.resolve(this.subscriptionCache);
    }
    if (this.subscriptionPromise && !opts.fresh) return this.subscriptionPromise;

    this.subscriptionPromise = this.request('GET', '/payment/subscription', null, { fresh: true })
      .then((data) => {
        this.subscriptionCache = data;
        this.subscriptionCacheAt = Date.now();
        // Если сервер говорит, что активен пробный период — красим плашку напрямую,
        // не доверяя странице (её renderSubscriptionCard на части устройств не переключает плашку).
        try {
          if (data && data.subscription_active === true && typeof window.paintSubscriptionBadgeDirect === 'function') {
            window.paintSubscriptionBadgeDirect(data);
          }
        } catch (e) {}
        return data;
      })
      .catch((err) => {
        if (err && err.status === 429 && this.subscriptionCache) return this.subscriptionCache;
        throw err;
      })
      .finally(() => {
        this.subscriptionPromise = null;
      });
    return this.subscriptionPromise;
  }

  // --- Profile ---
  deleteAccount() { return this.request('DELETE', '/profile/account'); }

  // --- Chat ---
  getGeneralChat() { return this.request('GET', '/chat/general', null, { fresh: true }); }
  getGeneralChatMessages(limit = 60, beforeId = null, afterId = null) {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (beforeId) qs.set('before_id', String(beforeId));
    if (afterId) qs.set('after_id', String(afterId));
    return this.request('GET', '/chat/general/messages?' + qs.toString(), null, { fresh: true });
  }
  sendGeneralChatMessage(text, opts = {}) {
    return this.request('POST', '/chat/general/messages', {
      type: 'text',
      text,
      reply_to_message_id: opts.reply_to_message_id || null,
    });
  }
  updateGeneralChatMessage(id, text) {
    return this.request('PUT', `/chat/general/messages/${id}`, { type: 'text', text });
  }
  deleteGeneralChatMessage(id) {
    return this.request('DELETE', `/chat/general/messages/${id}`);
  }
  reactGeneralChatMessage(id, emoji) {
    return this.request('POST', `/chat/general/messages/${id}/reactions`, { emoji });
  }

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

window.SISTEMA_LEGAL_LINKS = {
  offer: 'https://sistema-molodtsova.ru/offer/',
  privacy: 'https://sistema-molodtsova.ru/privacy/',
  terms: 'https://sistema-molodtsova.ru/terms/',
  requisites: 'https://sistema-molodtsova.ru/requisites/',
};

window.isPaymentLegalAccepted = function isPaymentLegalAccepted(scope = document) {
  const checkbox = scope?.querySelector?.('[data-payment-legal]');
  return checkbox ? checkbox.checked === true : false;
};

window.requirePaymentLegalAccepted = function requirePaymentLegalAccepted(scope = document) {
  if (window.isPaymentLegalAccepted(scope)) return true;
  alert('Перед оплатой нужно принять условия оферты и пользовательского соглашения.');
  const checkbox = scope?.querySelector?.('[data-payment-legal]');
  if (checkbox && typeof checkbox.focus === 'function') checkbox.focus();
  return false;
};

// === Trial CTA (1-day free trial, no card) ===
// Врезает кнопку триала в любую модалку подписки (.ios-sub-btn-buy / [data-buy]).
// Показывается только если триал ещё доступен (не использован, нет оплаты, доступ неактивен).
function ensureTrialStyles() {
  if (document.getElementById('trial-cta-styles')) return;
  const style = document.createElement('style');
  style.id = 'trial-cta-styles';
  style.textContent = `
    .trial-cta{width:100%;min-height:50px;margin-top:12px;border-radius:999px;
      border:1px solid rgba(255,255,255,.22);
      background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.06));
      backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px) saturate(160%);
      color:#fff;font-size:15px;font-weight:700;letter-spacing:-.01em;
      display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 8px 24px rgba(0,0,0,.25);
      transition:transform .2s ease,background .2s ease,opacity .2s ease}
    .trial-cta:hover{background:linear-gradient(180deg,rgba(255,255,255,.24),rgba(255,255,255,.1));transform:translateY(-1px)}
    .trial-cta:active{transform:translateY(1px)}
    .trial-cta:disabled{opacity:.6;cursor:not-allowed;transform:none}
    .trial-cta .trial-spark{font-size:14px;line-height:1}
    .trial-cta-note{margin:10px 0 0;font-size:11px;line-height:1.4;color:rgba(255,255,255,.4)}
    @media (max-width:520px){.trial-cta{min-height:46px;border-radius:18px;font-size:14px}}
  `;
  document.head.appendChild(style);
}

window.injectTrialOption = async function injectTrialOption(scope, opts = {}) {
  try {
    if (!scope || !window.API) return;
    const buyBtn = scope.querySelector('.ios-sub-btn-buy, [data-buy]');
    if (!buyBtn) return;
    if (scope.querySelector('.trial-cta')) return;

    const loggedIn = window.API.isLoggedIn && window.API.isLoggedIn();
    if (loggedIn) {
      const data = await window.API.getSubscription().catch(() => null);
      if (!data || data.trial_available !== true) return;
    }

    ensureTrialStyles();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'trial-cta';
    btn.setAttribute('data-trial-activate', 'true');
    btn.innerHTML = '<span class="trial-spark">✦</span><span>Попробовать 1 день бесплатно</span>';

    const note = document.createElement('p');
    note.className = 'trial-cta-note';
    note.textContent = 'Полный доступ на 1 день. Без карты и без оплаты.';

    buyBtn.insertAdjacentElement('afterend', btn);
    btn.insertAdjacentElement('afterend', note);

    if (typeof opts.onActivated === 'function') btn.__trialOnActivated = opts.onActivated;
    btn.__trialNote = note;
  } catch (e) {
    /* trial button must not break the modal */
  }
};

window.paintSubscriptionBadgeDirect = function paintSubscriptionBadgeDirect(sub) {
  try {
    const badgeEl = document.getElementById('dash-subscription-badge');
    const statusEl = document.getElementById('dash-subscription-status');
    const actionEl = document.getElementById('dash-subscription-action');
    const benefitsEl = document.getElementById('dash-subscription-benefits');
    if (!badgeEl) return;
    const isActive = !!(sub && sub.subscription_active === true);
    const isTrial = !!(sub && sub.is_trial);
    const expiresRaw = sub && (sub.subscription_expires_at || sub.expires_at);
    
    // БЛОКИРОВКА ПЕРЕРИСОВКИ:
    // Если на карточке УЖЕ нарисован активный триал, мы запрещаем любой функции
    // перерисовывать его обратно в "неактивна" или "доступны первые видео".
    if (badgeEl.textContent === 'пробный период' && !isActive) {
      if (window.sistemaClientLog) window.sistemaClientLog('trial-badge-blocked-downgrade', { sub: sub || null });
      return;
    }

    const paintBenefits = () => {
      if (benefitsEl) {
        benefitsEl.style.display = 'grid';
        benefitsEl.innerHTML = '<span>Открыты все видео-разделы и уроки</span><span>Доступен Общий чат участников</span><span>Доступна Лиза, AI-помощница системы</span>';
      }
    };
    if (isActive && isTrial) {
      badgeEl.textContent = 'пробный период';
      badgeEl.style.background = 'rgba(10, 132, 255, 0.16)';
      badgeEl.style.color = '#5ac8fa';
      badgeEl.style.border = '1px solid rgba(10, 132, 255, 0.28)';
      if (statusEl) {
        let untilStr = '';
        if (expiresRaw) { try { untilStr = ' до ' + new Date(expiresRaw).toLocaleString('ru-RU', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }); } catch (e) {} }
        statusEl.textContent = 'Пробный доступ Pro активен' + untilStr;
      }
      if (actionEl) actionEl.style.display = 'none';
      paintBenefits();
      // Сторож: пока триал активен, не даём ничему перетереть плашку обратно в «неактивна».
      const expiresMs = expiresRaw ? (new Date(expiresRaw).getTime() || 0) : 0;
      window.__sistemaTrialBadgeUntil = expiresMs;
      if (!window.__sistemaTrialBadgeGuard) {
        window.__sistemaTrialBadgeGuard = setInterval(function() {
          const until = window.__sistemaTrialBadgeUntil || 0;
          if (!until || Date.now() >= until) {
            clearInterval(window.__sistemaTrialBadgeGuard);
            window.__sistemaTrialBadgeGuard = null;
            return;
          }
          const b = document.getElementById('dash-subscription-badge');
          if (b && b.textContent !== 'пробный период') {
            window.paintSubscriptionBadgeDirect({ subscription_active: true, is_trial: true, expires_at: new Date(until).toISOString() });
          }
        }, 400);
      }
    } else if (isActive) {
      badgeEl.textContent = 'активна';
      badgeEl.style.background = 'rgba(48, 209, 88, 0.15)';
      badgeEl.style.color = '#30d158';
      badgeEl.style.border = '1px solid rgba(48, 209, 88, 0.2)';
      if (actionEl) actionEl.style.display = 'none';
      paintBenefits();
    }
  } catch (e) {}
};

window.handleTrialActivated = function handleTrialActivated(res, onActivated) {
  const expiresRaw = res && (res.expires_at || res.subscription_expires_at) || null;
  const optimistic = {
    ...(res || {}),
    subscription_active: true,
    is_trial: true,
    access_reason: 'trial',
    trial_started_at: (res && res.trial_started_at) || new Date().toISOString(),
    expires_at: expiresRaw,
    subscription_expires_at: (res && res.subscription_expires_at) || expiresRaw,
    trial_available: false,
    trial_used: true,
  };
  if (window.API) {
    window.API.subscriptionCache = optimistic;
    window.API.subscriptionCacheAt = Date.now();
    window.API.subscriptionPromise = null;
  }
  try { sessionStorage.setItem('sistema:trial-activated-subscription', JSON.stringify(optimistic)); } catch (e) {}
  window.__sistemaSubscriptionActive = true;
  window.__sistemaSubscriptionExpiresAt = expiresRaw ? (new Date(expiresRaw).getTime() || null) : null;
  if (typeof onActivated === 'function') {
    onActivated(optimistic);
  }
  if (typeof window.sistemaRenderSubscriptionCard === 'function') {
    window.sistemaRenderSubscriptionCard(optimistic);
  }
  window.dispatchEvent(new CustomEvent('sistema:subscription-changed', {
    detail: { active: true, expires_at: expiresRaw, subscription: optimistic }
  }));
  // ГАРАНТИРОВАННЫЙ прямой апдейт плашки профиля — ПОСЛЕ всех слушателей,
  // чтобы ничто не перетёрло её обратно в «неактивна».
  window.paintSubscriptionBadgeDirect(optimistic);
  setTimeout(() => window.paintSubscriptionBadgeDirect(optimistic), 50);
  setTimeout(() => {
    if (!window.API) return;
    window.API.getSubscription({ fresh: true })
      .then((fresh) => {
        if (!fresh) return;
        window.API.subscriptionCache = fresh;
        window.API.subscriptionCacheAt = Date.now();
        window.paintSubscriptionBadgeDirect(fresh);
        if (window.sistemaClientLog) window.sistemaClientLog('trial-reconcile', { active: !!fresh.subscription_active, is_trial: !!fresh.is_trial });
        window.dispatchEvent(new CustomEvent('sistema:subscription-changed', {
          detail: { active: !!fresh.subscription_active, expires_at: fresh.expires_at, subscription: fresh }
        }));
      })
      .catch(() => {});
  }, 800);
  return optimistic;
};

window.sistemaClientLog = function sistemaClientLog(step, data) {
  try {
    const payload = Object.assign({ step: step, path: location.pathname, ts: Date.now() }, data || {});
    const url = (window.API && window.API.base ? window.API.base : '/api') + '/payment/client-log';
    const body = JSON.stringify(payload);
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
      body: body,
    }).catch(() => {});
  } catch (e) {}
};

document.addEventListener('click', async function handleTrialClick(event) {
  const btn = event.target && event.target.closest && event.target.closest('[data-trial-activate], .trial-cta');
  if (!btn || !window.API || btn.__trialInFlight) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  window.sistemaClientLog('trial-click', {
    btnClass: btn.className || null,
    hasAttr: btn.hasAttribute && btn.hasAttribute('data-trial-activate'),
    loggedIn: !!(window.API.isLoggedIn && window.API.isLoggedIn()),
  });
  if (!(window.API.isLoggedIn && window.API.isLoggedIn())) {
    if (window.openAuthModal) {
      window.openAuthModal('login');
      window.addEventListener('auth:change', function handler() {
        window.removeEventListener('auth:change', handler);
        setTimeout(() => btn.click(), 0);
      }, { once: true });
    } else {
      alert('Войдите, чтобы активировать пробный период.');
    }
    return;
  }

  const original = btn.innerHTML || btn.textContent;
  btn.__trialInFlight = true;
  btn.disabled = true;
  if (btn.classList && btn.classList.contains('trial-cta')) {
    btn.innerHTML = '<span>Активируем доступ...</span>';
  } else {
    const strong = btn.querySelector && btn.querySelector('strong');
    if (strong) strong.textContent = 'Активируем пробный период...';
  }
  try {
    window.sistemaClientLog('trial-request-start', {});
    const res = await window.API.activateTrial();
    window.sistemaClientLog('trial-response', {
      trial_granted: res && res.trial_granted,
      subscription_active: res && res.subscription_active,
      is_trial: res && res.is_trial,
      expires_at: res && (res.expires_at || res.subscription_expires_at),
    });
    const activated = !!(res && (res.trial_granted === true || res.subscription_active === true));
    if (!activated) {
      window.sistemaClientLog('trial-not-activated', { res: res || null });
      btn.disabled = true;
      if (btn.classList && btn.classList.contains('trial-cta')) {
        btn.innerHTML = '<span>Пробный период уже использован</span>';
        if (btn.__trialNote) btn.__trialNote.textContent = 'Вы уже использовали бесплатный период. Оформите подписку, чтобы продолжить.';
      }
      return;
    }
    window.handleTrialActivated(res, btn.__trialOnActivated);
    setTimeout(() => {
      window.sistemaClientLog('trial-rendered', {
        badge: (document.getElementById('dash-subscription-badge') || {}).textContent || null,
        hasCardFn: typeof window.sistemaRenderSubscriptionCard === 'function',
      });
    }, 120);
  } catch (err) {
    window.sistemaClientLog('trial-error', { error: (err && (err.error || err.message)) || String(err), status: err && err.status });
    btn.disabled = false;
    if (btn.classList && btn.classList.contains('trial-cta')) btn.innerHTML = original;
    alert((err && err.error) || 'Не удалось активировать пробный период. Попробуйте позже.');
  } finally {
    btn.__trialInFlight = false;
  }
}, true);

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
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.4.12/dist/hls.min.js';
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
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="audio-mode-eyebrow">Аудиоурок</div>
        <button type="button" class="audio-mode-menu" data-audio-chapters-toggle aria-label="Главы и таймкоды">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg>
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
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19 20-9-8 9-8v16Z"/><path d="M5 19V5"/></svg>
          </button>
          <button type="button" data-audio-seek="-15" aria-label="Назад на 15 секунд"><span>-15</span></button>
          <button type="button" class="audio-mode-play" data-audio-play aria-label="Воспроизвести">
            <svg class="audio-icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>
            <svg class="audio-icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14"/><path d="M16 5v14"/></svg>
          </button>
          <button type="button" data-audio-seek="15" aria-label="Вперёд на 15 секунд"><span>+15</span></button>
          <button type="button" data-audio-track="1" aria-label="Следующий урок">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 4 9 8-9 8V4Z"/><path d="M19 5v14"/></svg>
          </button>
        </div>
      </div>
      <div class="audio-mode-sheet hidden" data-audio-sheet>
        <div class="audio-mode-sheet-handle" aria-hidden="true"></div>
        <div class="audio-mode-sheet-head">
          <div>
            <span>Главы</span>
            <strong>Таймкоды урока</strong>
          </div>
          <button type="button" data-audio-chapters-close aria-label="Закрыть главы">×</button>
        </div>
        <div class="audio-mode-chapters" data-audio-chapters></div>
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
  const artImage = card.querySelector('.audio-mode-art img');
  const inlineArtImage = inline.querySelector('.audio-inline-art img');
  const modeButtons = toggle.querySelectorAll('[data-media-mode]');
  const chaptersToggle = card.querySelector('[data-audio-chapters-toggle]');
  const chaptersSheet = card.querySelector('[data-audio-sheet]');
  const chaptersPanel = card.querySelector('[data-audio-chapters]');
  let chapters = [];
  let nativeTracks = [];
  let nativeTrackIndex = 0;
  let nativeDuration = 0;

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

  function extractCssUrl(value) {
    const match = String(value || '').match(/url\((['"]?)(.*?)\1\)/i);
    return match ? match[2] : '';
  }

  function getPosterImage() {
    const preview = container.querySelector('.video-preview-overlay');
    return container.dataset.audioPoster ||
      extractCssUrl(preview?.style?.backgroundImage) ||
      video.getAttribute('poster') ||
      '/assets/webp/ai_back.webp';
  }

  function setArtwork() {
    const poster = getPosterImage();
    card.style.setProperty('--audio-artwork', `url("${poster}")`);
    inline.style.setProperty('--audio-artwork', `url("${poster}")`);
    artImage.src = poster;
    inlineArtImage.src = poster;
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

  function normalizeMediaSlug(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/\\/g, '/')
      .replace(/ё/g, 'е')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[^\p{L}\p{N}]+/gu, '');
  }

  function getCachedChaptersForSlug(slug) {
    return window.__courseAIChaptersByVideoSlug?.[normalizeMediaSlug(slug)] || null;
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
      setArtwork();
      setTitle();
      const cachedChapters = getCachedChaptersForSlug(audio.dataset.slug);
      if (cachedChapters) renderChapters(cachedChapters);
    } else {
      closePlayer();
    }
  }

  async function openPlayer(autoplay = true) {
    card.classList.remove('hidden');
    document.body.classList.add('audio-player-open');
    video.pause();
    setArtwork();
    setTitle();
    await loadAudio();
    if (autoplay) audio.play().catch(() => {});
  }

  function closePlayer() {
    card.classList.add('hidden');
    card.classList.remove('chapters-open');
    document.body.classList.remove('audio-player-open');
    audio.pause();
  }

  function isNativeTrackMode() {
    return isAppleTouchVideoDevice() && nativeTracks.length > 0;
  }

  function currentNativeGlobalTime() {
    const track = nativeTracks[nativeTrackIndex];
    return (track ? Number(track.start) || 0 : 0) + (audio.currentTime || 0);
  }

  function loadNativeTrack(index, offset = 0, autoplay = false) {
    const track = nativeTracks[index];
    if (!track) return;
    nativeTrackIndex = index;
    audio.pause();
    audio.setAttribute('src', new URL(track.url, API_ORIGIN).href);
    audio.load();
    const applyOffset = () => {
      if (Number.isFinite(offset) && offset > 0) {
        audio.currentTime = Math.min(offset, Math.max(0, Number(track.duration) || offset));
      }
      if (autoplay) audio.play().catch(() => {});
    };
    audio.addEventListener('loadedmetadata', applyOffset, { once: true });
  }

  function seekToAudioTime(seconds, autoplay = !audio.paused) {
    const safe = Math.max(0, Number(seconds) || 0);
    if (!isNativeTrackMode()) {
      audio.currentTime = Math.max(0, Math.min((audio.duration || Infinity), safe));
      if (autoplay) audio.play().catch(() => {});
      return;
    }
    let index = nativeTracks.findIndex((track) => safe >= (Number(track.start) || 0) && safe < (Number(track.end) || Infinity));
    if (index < 0) index = nativeTracks.length - 1;
    const track = nativeTracks[index];
    const nextIndex = index;
    loadNativeTrack(nextIndex, safe - (Number(track.start) || 0), autoplay);
  }

  async function loadAudio() {
    if (audio.dataset.loading === 'true' || audio.getAttribute('src')) return;
    audio.dataset.loading = 'true';
    try {
      const stream = await window.API.getAudioStream(audio.dataset.slug);
      const url = new URL(stream.url, API_ORIGIN).href;
      nativeTracks = Array.isArray(stream.tracks) ? stream.tracks : [];
      nativeDuration = Number(stream.duration_seconds) || 0;
      if (isNativeTrackMode()) {
        loadNativeTrack(0, 0, false);
        duration.textContent = fmt(nativeDuration || nativeTracks[nativeTracks.length - 1]?.end);
        setTitle();
        return;
      }
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
      inline.querySelector('strong').textContent = 'Аудио пока недоступно';
      inline.querySelector('span').textContent = 'Для этого материала сейчас доступно только видео';
      throw err;
    } finally {
      audio.dataset.loading = 'false';
    }
  }

  modeButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const nextMode = button.dataset.mediaMode;
      setMode(nextMode);
      if (nextMode !== 'audio') return;
      try {
        await loadAudio();
      } catch (e) {
        setMode('video');
      }
    });
  });
  inline.addEventListener('click', () => openPlayer(true));
  card.querySelector('[data-audio-close]')?.addEventListener('click', closePlayer);
  function toggleChapters() {
    const open = !card.classList.contains('chapters-open');
    card.classList.toggle('chapters-open', open);
    chaptersSheet.classList.toggle('hidden', !open);
  }
  chaptersToggle?.addEventListener('click', toggleChapters);
  card.querySelector('[data-audio-chapters-close]')?.addEventListener('click', () => {
    card.classList.remove('chapters-open');
    chaptersSheet.classList.add('hidden');
  });
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
      const base = isNativeTrackMode() ? currentNativeGlobalTime() : audio.currentTime;
      seekToAudioTime(base + Number(button.dataset.audioSeek || 0));
    });
  });
  function seekFromProgressEvent(event) {
    const total = isNativeTrackMode() ? nativeDuration : audio.duration;
    if (!total) return;
    const rect = progressTrack.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    seekToAudioTime(pct * total);
  }

  progressTrack?.addEventListener('click', seekFromProgressEvent);
  progressTrack?.addEventListener('pointerdown', (event) => {
    if (!progressTrack || event.button > 0) return;
    event.preventDefault();
    progressTrack.setPointerCapture?.(event.pointerId);
    seekFromProgressEvent(event);
    const onMove = (moveEvent) => seekFromProgressEvent(moveEvent);
    const onUp = (upEvent) => {
      seekFromProgressEvent(upEvent);
      progressTrack.releasePointerCapture?.(event.pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    window.addEventListener('pointercancel', onUp, { once: true });
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
      chaptersPanel.innerHTML = '';
      chaptersSheet.classList.add('hidden');
      card.classList.remove('chapters-open');
      return;
    }
    chaptersToggle.hidden = false;
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
    seekToAudioTime(Number(button.dataset.audioChapter) || 0, true);
    card.classList.remove('chapters-open');
    chaptersSheet.classList.add('hidden');
  });
  window.addEventListener('course-ai:chapters', (event) => {
    const detail = event.detail || {};
    if (detail.videoSlug && normalizeMediaSlug(detail.videoSlug) !== normalizeMediaSlug(audio.dataset.slug)) return;
    renderChapters(detail.chapters);
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
    const currentSeconds = isNativeTrackMode() ? currentNativeGlobalTime() : audio.currentTime;
    const totalSeconds = isNativeTrackMode() ? nativeDuration : audio.duration;
    current.textContent = fmt(currentSeconds);
    const pct = totalSeconds ? Math.min(100, Math.max(0, (currentSeconds / totalSeconds) * 100)) : 0;
    progress.style.width = `${pct}%`;
  });
  audio.addEventListener('durationchange', () => {
    duration.textContent = fmt(isNativeTrackMode() ? nativeDuration : audio.duration);
  });
  audio.addEventListener('ended', () => {
    if (!isNativeTrackMode()) return;
    const nextIndex = nativeTrackIndex + 1;
    if (nativeTracks[nextIndex]) {
      loadNativeTrack(nextIndex, 0, true);
    }
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
      nativeTracks = [];
      nativeTrackIndex = 0;
      nativeDuration = 0;
      audio.dataset.slug = nextSlug || '';
      progress.style.width = '0%';
      current.textContent = '0:00';
      duration.textContent = '0:00';
      setArtwork();
      setTitle();
      const cachedChapters = getCachedChaptersForSlug(audio.dataset.slug);
      if (cachedChapters) renderChapters(cachedChapters);
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

function trackVideoOpen(video, slug, streamType, delivery = null) {
  if (!video || video.dataset.activityOpenTracked) return;
  video.dataset.activityOpenTracked = '1';
  window.SistemaTracker?.track?.('video_open', {
    entity_type: 'video',
    entity_id: slug,
    metadata: {
      slug,
      stream_type: streamType,
      delivery,
    },
  });
}

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
    trackVideoOpen(video, slug, 'mp4', video.dataset.streamFallback || null);
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
  trackVideoOpen(video, slug, stream.type, null);
  return stream;
};

(function initSistemaTracker() {
  if (window.SistemaTracker) return;

  const state = {
    pageStartedAt: Date.now(),
    pageTracked: false,
    lastClickAt: 0,
    lastClickKey: '',
  };

  function canTrack() {
    return !!(window.API && window.API.isLoggedIn && window.API.isLoggedIn());
  }

  function track(eventType, payload = {}) {
    if (!canTrack() || !window.API.trackActivity) return;
    window.API.trackActivity(eventType, payload);
  }

  function trackPageView(reason = 'load') {
    if (state.pageTracked || !canTrack()) return;
    state.pageTracked = true;
    track('page_view', {
      entity_type: 'page',
      entity_id: location.pathname || '/',
      metadata: {
        reason,
        page_label: getPageLabel(),
      },
    });
  }

  function findTrackableElement(target) {
    return target?.closest?.('[data-track], button, a, [role="button"], input[type="submit"], input[type="button"], .lesson-item, .course-card, .program-card, .tabbar-item, .sidebar-item');
  }

  function trackClick(event) {
    const element = findTrackableElement(event.target);
    if (!element) return;
    if (element.closest('.tabbar-item, .sidebar-item, .mobile-profile-dot, .mobile-header-brand')) return;

    const now = Date.now();
    const descriptor = getElementDescriptor(element);
    const key = `${descriptor.tag}:${descriptor.id || ''}:${descriptor.text || ''}:${descriptor.href || ''}`;
    if (key === state.lastClickKey && now - state.lastClickAt < ACTIVITY_CLICK_MIN_INTERVAL_MS) return;
    state.lastClickAt = now;
    state.lastClickKey = key;

    track('ui_click', {
      entity_type: descriptor.tag || 'element',
      entity_id: descriptor.id || descriptor.dataset.slug || descriptor.dataset.lesson || descriptor.href || descriptor.text || null,
      metadata: {
        element: descriptor,
        page_label: getPageLabel(),
        time_on_page_seconds: Math.round((now - state.pageStartedAt) / 1000),
      },
    });
  }

  function trackFormSubmit(event) {
    const form = event.target;
    if (!form || form.tagName !== 'FORM') return;
    track('form_submit', {
      entity_type: 'form',
      entity_id: form.id || form.getAttribute('name') || null,
      metadata: {
        form: getElementDescriptor(form),
        page_label: getPageLabel(),
        time_on_page_seconds: Math.round((Date.now() - state.pageStartedAt) / 1000),
      },
    });
  }

  function trackPageLeave() {
    if (!canTrack()) return;
    const seconds = Math.round((Date.now() - state.pageStartedAt) / 1000);
    if (seconds < 4) return;
    track('page_leave', {
      entity_type: 'page',
      entity_id: location.pathname || '/',
      metadata: {
        page_label: getPageLabel(),
        time_on_page_seconds: seconds,
      },
    });
  }

  window.SistemaTracker = {
    track,
    trackPageView,
    trackClick,
  };

  document.addEventListener('click', trackClick, true);
  document.addEventListener('submit', trackFormSubmit, true);
  window.addEventListener('beforeunload', trackPageLeave);
  window.addEventListener('auth:change', () => window.setTimeout(() => trackPageView('auth_change'), 250));
  window.setTimeout(() => trackPageView('boot'), 650);
})();
