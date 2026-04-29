/**
 * API Client for Система Молодцова
 * JWT auth, automatic refresh, video streaming
 */
const API_BASE = window.API_BASE || (location.hostname === 'localhost' ? 'http://localhost:3000/api' : 'https://api.sistema-molodtsov.ru/api');

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

  // --- Payment ---
  getPlans()       { return this.request('GET', '/payment/plans'); }
  createPayment(data) { return this.request('POST', '/payment/create', data); }
  getSubscription() { return this.request('GET', '/payment/subscription'); }
}

window.API = new ApiClient();
