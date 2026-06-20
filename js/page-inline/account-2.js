function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function safeInternalPath(value, fallback = '#') {
    const path = String(value || '').trim();
    if (!path || !path.startsWith('/') || path.startsWith('//') || /[\r\n"'<>]/.test(path)) return fallback;
    return path;
  }

  function safeAssetPath(value, fallback = '/assets/webp/courses.webp') {
    const path = String(value || '').trim();
    if (!path.startsWith('/assets/') || /[\r\n"'<>\\]/.test(path)) return fallback;
    return path;
  }

  let dashboardPromise = null;
  let dashboardLoadedOnce = false;
  let shortIdCopyTimer = null;

  async function copyTextToClipboard(text) {
    const value = String(text || '').trim();
    if (!value) return false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (e) {}
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (e) {
      copied = false;
    }
    textarea.remove();
    return copied;
  }

  function showShortIdCopyFeedback(container) {
    if (!container) return;
    const status = container.querySelector('.profile-copy-status');
    if (status) status.textContent = 'Скопировано';
    container.classList.add('is-copied');
    clearTimeout(shortIdCopyTimer);
    shortIdCopyTimer = setTimeout(() => {
      container.classList.remove('is-copied');
    }, 1600);
  }

  function renderShortId(user) {
    const shortIdEl = document.getElementById('dash-short-id');
    if (!shortIdEl) return;

    shortIdEl.replaceChildren();
    shortIdEl.classList.toggle('is-empty', !user?.short_id);
    if (!user?.short_id) return;

    const shortId = String(user.short_id);
    const valueButton = document.createElement('button');
    valueButton.type = 'button';
    valueButton.className = 'profile-short-id-value';
    valueButton.textContent = 'ID: ' + shortId;
    valueButton.setAttribute('aria-label', 'Скопировать ID пользователя');

    const iconButton = document.createElement('button');
    iconButton.type = 'button';
    iconButton.className = 'profile-short-id-copy';
    iconButton.setAttribute('aria-label', 'Скопировать ID пользователя');
    iconButton.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M5 15.5H4.5A2.5 2.5 0 0 1 2 13V4.5A2.5 2.5 0 0 1 4.5 2H13a2.5 2.5 0 0 1 2.5 2.5V5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

    const status = document.createElement('span');
    status.className = 'profile-copy-status';
    status.setAttribute('aria-live', 'polite');

    const copyShortId = async () => {
      if (await copyTextToClipboard(shortId)) showShortIdCopyFeedback(shortIdEl);
    };

    valueButton.addEventListener('click', copyShortId);
    iconButton.addEventListener('click', copyShortId);
    shortIdEl.append(valueButton, iconButton, status);
  }

  function refreshAccountOverview() {
    showDashboardShell();
    refreshProfileHeader();
    refreshSubscriptionCard();
    if (!dashboardLoadedOnce) loadDashboard();
  }

  window.addEventListener('auth:change', function() {
    __lastRefreshSubCardAt = 0;
    refreshAccountOverview();
  });
  window.refreshAuthUI = refreshAccountOverview;

  function setPanelVisible(element, visible, display = 'block') {
    if (!element) return;
    element.classList.toggle('u-hidden', !visible);
    element.setAttribute('aria-hidden', visible ? 'false' : 'true');
    element.style.display = visible ? display : 'none';
  }

  function showAuthGate() {
    setPanelVisible(document.getElementById('dashboard'), false);
    setPanelVisible(document.getElementById('auth-gate'), true, 'flex');
  }

  function showDashboardShell() {
    setPanelVisible(document.getElementById('auth-gate'), false);
    setPanelVisible(document.getElementById('dashboard'), true, 'block');
  }

  function renderProfileHeader(user) {
    if (!user) return;
    const profile = JSON.parse(localStorage.getItem('sistema:onboarding-profile') || '{}');
    const emailName = user.email ? user.email.split('@')[0] : '';
    const phoneName = user.phone ? user.phone.replace(/^\+7/, '+7 ') : '';
    const name = user.display_name || user.first_name || profile.name || emailName || phoneName || 'друг';
    document.getElementById('dash-greeting')?.replaceChildren(document.createTextNode(name));

    const avatarImg = document.getElementById('dash-avatar-img');
    if (avatarImg) {
      if (user.avatar_url) {
        avatarImg.src = String(user.avatar_url).replace(/"/g, '&quot;');
      } else {
        avatarImg.removeAttribute('src');
      }
    }

    const usernameEl = document.getElementById('dash-username');
    if (usernameEl) {
      const login = user.yandex_login || (user.email ? user.email.split('@')[0] : '') || user.phone || '';
      usernameEl.textContent = login ? '@' + login : '';
    }

    renderShortId(user);

    document.getElementById('dash-sub')?.replaceChildren(document.createTextNode('Настройки, документы и управление данными.'));
  }

  async function refreshProfileHeader() {
    try {
      const data = await window.API.me({ fresh: true });
      renderProfileHeader(data && data.user);
    } catch (e) {}
  }

  async function confirmPaymentAndSync() {
    if (!window.API || !window.API.isLoggedIn || !window.API.isLoggedIn()) return;

    // Тяжёлый confirm + burst-поллинг нужен ТОЛЬКО при возврате с оплаты.
    // На обычном открытии профиля карточку подписки обновляет refreshSubscriptionCard(),
    // а лишние POST /payment/confirm на каждом заходе создавали 401-штормы и тормоза.
    if (!window.API.hasPendingPaymentConfirm || !window.API.hasPendingPaymentConfirm()) return;

    let attempts = 0;
    const syncOnce = async () => {
      let res = null;
      try {
        res = await window.API.confirmPayment();
      } catch (e) { /* ignore, fall back to subscription read */ }

      let sub = res;
      if (!sub || typeof sub.subscription_active === 'undefined') {
        sub = await window.API.getSubscription({ fresh: true });
      }
      const expiresAt = sub && sub.expires_at ? new Date(sub.expires_at).getTime() : null;
      const isActive = window.API.isSubscriptionActive
        ? window.API.isSubscriptionActive(sub)
        : !!(sub && sub.subscription_active);
      renderSubscriptionCard(sub);
      window.__sistemaSubscriptionActive = isActive;
      window.__sistemaSubscriptionExpiresAt = expiresAt || null;
      window.dispatchEvent(new CustomEvent('sistema:subscription-changed', {
        detail: { active: isActive, expires_at: expiresAt, subscription: sub }
      }));
      return isActive;
    };

    try {
      if (await syncOnce()) return;
    } catch (e) { /* ignore, continue burst */ }

    // YooKassa may redirect before the server-to-server notification arrives.
    const burst = setInterval(async () => {
      attempts += 1;
      try {
        if (await syncOnce()) {
          clearInterval(burst);
          return;
        }
      } catch (e) { /* ignore transient errors */ }
      if (attempts >= 6) clearInterval(burst);
    }, 4000);
  }

  function openAccountSubscriptionModal() {
    if (document.getElementById('ios-subscription-modal')) return;

    const style = document.createElement('style');
    style.id = 'ios-sub-modal-styles';
    style.textContent = `
      .ios-sub-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;pointer-events:none;transition:opacity .35s cubic-bezier(.16,1,.3,1)}
      .ios-sub-modal.active{opacity:1;pointer-events:auto}
      .ios-sub-modal-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
      .ios-sub-modal-card{position:relative;width:100%;max-width:420px;padding:32px 24px 28px;border-radius:38px;border:1px solid rgba(255,255,255,.14);background:radial-gradient(circle at 50% 0%,rgba(255,255,255,.12),transparent 45%),#0c0d12;box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.2);color:#fff;text-align:center;display:flex;flex-direction:column;align-items:center;overflow:hidden;transform:scale(.94) translateY(16px);transition:transform .45s cubic-bezier(.34,1.56,.64,1)}
      .ios-sub-modal.active .ios-sub-modal-card{transform:scale(1) translateY(0)}
      .ios-sub-modal-close{position:absolute;top:20px;right:20px;width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.08);color:rgba(255,255,255,.5);font-size:20px;display:grid;place-items:center;cursor:pointer;padding:0;line-height:1}
      .ios-sub-badge{display:inline-flex;margin-bottom:20px;padding:6px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.08);font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.85)}
      .ios-sub-title{margin:0 0 10px;font-size:28px;font-weight:800;line-height:1.1;letter-spacing:-.04em}
      .ios-sub-desc{margin:0 0 24px;max-width:300px;color:rgba(255,255,255,.55);font-size:14px;line-height:1.5}
      .ios-sub-features{width:100%;list-style:none;padding:0;margin:0 0 24px;display:flex;flex-direction:column;gap:14px;text-align:left}
      .ios-sub-feature-item{display:flex;align-items:flex-start;gap:12px;color:rgba(255,255,255,.85);font-size:14px;line-height:1.4}
      .ios-sub-feature-icon{width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.1);display:grid;place-items:center;flex:0 0 auto;font-size:11px;font-weight:700}
      .ios-sub-accept{display:flex;gap:10px;align-items:flex-start;margin:0 0 12px;color:rgba(255,255,255,.58);font-size:11.5px;line-height:1.45;text-align:left}
      .ios-sub-accept input{width:20px;height:20px;margin:1px 0 0;flex:0 0 auto;accent-color:#4f7cff}
      .ios-sub-accept a{color:rgba(255,255,255,.86);text-decoration:underline}
      .ios-sub-btn-buy{width:100%;min-height:52px;border:0;border-radius:999px;background:#fff;color:#000;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 10px 25px rgba(255,255,255,.15);cursor:pointer;transition:opacity .2s,transform .2s}
      .ios-sub-btn-buy:disabled{opacity:.55;cursor:not-allowed}
      .ios-sub-footer{margin:14px 0 0;color:rgba(255,255,255,.35);font-size:11px;line-height:1.4}
      @media (max-width:520px){.ios-sub-modal{padding:max(14px,env(safe-area-inset-top,0px)) 10px max(14px,env(safe-area-inset-bottom,0px))}.ios-sub-modal-card{border-radius:26px;padding:20px 16px 16px}.ios-sub-title{font-size:22px}.ios-sub-desc,.ios-sub-feature-item{font-size:12.5px}.ios-sub-features{gap:9px;margin-bottom:16px}.ios-sub-btn-buy{min-height:46px;border-radius:18px;font-size:14px}}
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'ios-subscription-modal';
    modal.className = 'ios-sub-modal';
    modal.innerHTML = `
      <div class="ios-sub-modal-backdrop"></div>
      <div class="ios-sub-modal-card">
        <button class="ios-sub-modal-close" type="button" aria-label="Закрыть">×</button>
        <div class="ios-sub-badge">Подписка Pro</div>
        <h2 class="ios-sub-title">Полный доступ<br>к Системе Молодцова</h2>
        <p class="ios-sub-desc">Pro открывает все видео-разделы, аудио, практики, Общий чат и расширенный доступ к Лизе.</p>
        <ul class="ios-sub-features">
          <li class="ios-sub-feature-item"><span class="ios-sub-feature-icon">✓</span><span><strong>Все материалы:</strong> курсы, марафоны, видео, аудио и практики.</span></li>
          <li class="ios-sub-feature-item"><span class="ios-sub-feature-icon">✓</span><span><strong>Общий чат:</strong> живое общение и поддержка участников.</span></li>
          <li class="ios-sub-feature-item"><span class="ios-sub-feature-icon">✓</span><span><strong>Лиза AI:</strong> бережная помощь по материалам системы.</span></li>
        </ul>
        <label class="ios-sub-accept">
          <input data-payment-legal type="checkbox">
          <span>Я принимаю <a href="/offer/" target="_blank" rel="noopener noreferrer">оферту</a> и <a href="/terms/" target="_blank" rel="noopener noreferrer">пользовательское соглашение</a></span>
        </label>
        <button class="ios-sub-btn-buy" type="button" disabled>
          <span>Активировать подписку Pro</span><span style="font-weight:400;opacity:.6">—</span><span>2990 ₽</span>
        </button>
        <p class="ios-sub-footer">Оплата проходит через защищённый шлюз ЮKassa. Для теста подписка действует 5 минут.</p>
      </div>
    `;
    document.body.appendChild(modal);

    const buyBtn = modal.querySelector('.ios-sub-btn-buy');
    const close = () => {
      modal.classList.remove('active');
      window.setTimeout(() => {
        modal.remove();
        style.remove();
      }, 300);
    };

    modal.querySelector('.ios-sub-modal-close')?.addEventListener('click', close);
    modal.querySelector('.ios-sub-modal-backdrop')?.addEventListener('click', close);
    modal.querySelector('[data-payment-legal]')?.addEventListener('change', (event) => {
      buyBtn.disabled = !event.target.checked;
    });

    buyBtn.addEventListener('click', async () => {
      if (!window.requirePaymentLegalAccepted(modal)) return;
      const original = buyBtn.innerHTML;
      buyBtn.disabled = true;
      buyBtn.innerHTML = 'Переходим к оплате...';
      try {
        const res = await window.API.createPayment({ plan_slug: 'monthly', provider: 'yookassa' });
        if (window.API.redirectToPayment && window.API.redirectToPayment(res)) {
          modal.dataset.paymentInitiated = 'true';
          return;
        }
        throw new Error('bad payment response');
      } catch (err) {
        buyBtn.disabled = false;
        buyBtn.innerHTML = original;
        alert(err.error || 'Ошибка при создании платежа. Попробуйте позже.');
      }
    });

    const resetButtonState = () => {
      if (modal.dataset.paymentInitiated === 'true') {
        buyBtn.disabled = false;
        buyBtn.innerHTML = '<span>Активировать подписку Pro</span><span style="font-weight:400;opacity:.6">—</span><span>2990 ₽</span>';
        delete modal.dataset.paymentInitiated;
      }
    };

    modal.querySelector('.ios-sub-modal-close')?.addEventListener('click', () => {
      resetButtonState();
      close();
    });
    modal.querySelector('.ios-sub-modal-backdrop')?.addEventListener('click', () => {
      resetButtonState();
      close();
    });

    window.setTimeout(() => modal.classList.add('active'), 20);
    if (window.injectTrialOption) {
      window.injectTrialOption(modal, {
        onActivated(subscription) {
          const isActive = window.API?.isSubscriptionActive
            ? window.API.isSubscriptionActive(subscription)
            : !!(subscription && subscription.subscription_active);
          const expiresAt = subscription && subscription.expires_at ? new Date(subscription.expires_at).getTime() : null;
          
          window.__sistemaSubscriptionActive = isActive;
          window.__sistemaSubscriptionExpiresAt = expiresAt || null;
          
          // Immediately render the card with the data from activateTrial response.
          // This is the authoritative source — no need to re-fetch from backend.
          renderSubscriptionCard(subscription);
          
          // Notify the rest of the app (nav.js locks, etc.)
          window.dispatchEvent(new CustomEvent('sistema:subscription-changed', {
            detail: { active: isActive, expires_at: expiresAt, subscription }
          }));
          
          // Close the modal
          modal.classList.remove('active');
          window.setTimeout(() => {
            modal.remove();
            style.remove();
            // Железная гарантия корректного статуса: перечитываем профиль с нуля,
            // как это делает возврат после оплаты. Работает одинаково на десктопе и iPhone.
            try {
              if (window.API && window.API.clearSubscriptionCache) window.API.clearSubscriptionCache();
            } catch (e) {}
            window.location.reload();
          }, 320);
        }
      });
    }
  }

  async function initProfile() {
    showDashboardShell();
    try {
      const storedTrial = sessionStorage.getItem('sistema:trial-activated-subscription');
      if (storedTrial) {
        const parsed = JSON.parse(storedTrial);
        renderSubscriptionCard(parsed);
      }
    } catch (e) {}
    refreshProfileHeader();
    if (window.API?.hasPendingPaymentConfirm?.()) {
      await confirmPaymentAndSync();
    } else {
      refreshSubscriptionCard();
    }
    loadDashboard();
  }

  async function forceSubscriptionSync() {
    __lastRefreshSubCardAt = 0;
    if (window.API?.clearSubscriptionCache) window.API.clearSubscriptionCache();
    await refreshSubscriptionCard({ force: true });
  }

  function formatTrialRemaining(ms) {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    if (d > 0) return d + ' д ' + h + ' ч';
    if (h > 0) return h + ' ч ' + pad(m) + ' мин';
    return m + ' мин ' + pad(s) + ' сек';
  }

  function renderSubscriptionCard(source) {
    const statusEl = document.getElementById('dash-subscription-status');
    const badgeEl = document.getElementById('dash-subscription-badge');
    const actionEl = document.getElementById('dash-subscription-action');
    const benefitsEl = document.getElementById('dash-subscription-benefits');
    const testEl = document.getElementById('dash-subscription-test');
    if (!statusEl || !badgeEl) return;

    const expiresRaw = source?.subscription_expires_at || source?.expires_at || null;
    const expiresAt = expiresRaw ? new Date(expiresRaw).getTime() : null;
    const isActive = window.API?.isSubscriptionActive
      ? window.API.isSubscriptionActive(source)
      : !!source?.subscription_active;
    const isTrial = !!source?.is_trial
      || (isActive && !!source?.trial_started_at && source?.access_reason === 'trial')
      || (isActive && !!source?.trial_started_at && !source?.last_payment);
    const isTrialAvailable = source?.trial_available === true;

    // Сбрасываем предыдущий таймер обратного отсчёта, чтобы не плодить интервалы.
    if (window.__trialCountdownTimer) {
      clearInterval(window.__trialCountdownTimer);
      window.__trialCountdownTimer = null;
    }

    if (isActive && isTrial && expiresAt) {
      const untilStr = new Date(expiresRaw).toLocaleString('ru-RU', {
        day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
      });
      statusEl.innerHTML =
        'Пробный доступ Pro активен — осталось <strong id="trial-countdown" style="color:#fff;white-space:nowrap">…</strong>' +
        '<br><span style="color:rgba(255,255,255,.45);font-size:13px">до ' + untilStr + '</span>';
      badgeEl.textContent = 'пробный период';
      badgeEl.style.background = 'rgba(10, 132, 255, 0.16)';
      badgeEl.style.color = '#5ac8fa';
      badgeEl.style.border = '1px solid rgba(10, 132, 255, 0.28)';
      if (actionEl) actionEl.style.display = 'none';
      if (benefitsEl) {
        benefitsEl.style.display = 'grid';
        benefitsEl.innerHTML = '<span>Открыты все видео-разделы и уроки</span><span>Доступен Общий чат участников</span><span>Доступна Лиза, AI-помощница системы</span>';
      }
      if (testEl) testEl.style.display = 'none';

      const tick = () => {
        let left = expiresAt - Date.now();
        if (left <= 0) left = 0; 

        const cdEl = document.getElementById('trial-countdown');
        if (cdEl) cdEl.textContent = formatTrialRemaining(left);

        if (left <= 0) {
          if (window.__trialCountdownTimer) {
            clearInterval(window.__trialCountdownTimer);
            window.__trialCountdownTimer = null;
          }
          // Больше не делаем авто-опрос при 0 из-за бага со сбитыми часами на телефоне.
          // Сервер сам перестанет пускать, когда время выйдет.
        }
      };
      tick();
      window.__trialCountdownTimer = setInterval(tick, 1000);
      return;
    }

    if (isActive) {
      let dateStr = '';
      if (expiresRaw) {
        const date = new Date(expiresRaw);
        dateStr = ' до ' + date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      statusEl.textContent = 'Активирована подписка Pro' + dateStr;
      badgeEl.textContent = 'активна';
      badgeEl.style.background = 'rgba(48, 209, 88, 0.15)';
      badgeEl.style.color = '#30d158';
      badgeEl.style.border = '1px solid rgba(48, 209, 88, 0.2)';
      if (actionEl) actionEl.style.display = 'none';
      if (benefitsEl) {
        benefitsEl.style.display = 'grid';
        benefitsEl.innerHTML = '<span>Открыты все видео-разделы и уроки</span><span>Доступен Общий чат участников</span><span>Доступна Лиза, AI-помощница системы</span>';
      }
      if (testEl) testEl.style.display = 'none';
      return;
    }

    statusEl.textContent = 'Доступны первые видео. Pro открывает весь каталог, чат и AI.';
    badgeEl.textContent = 'неактивна';
    badgeEl.style.background = 'rgba(255, 255, 255, 0.08)';
    badgeEl.style.color = 'rgba(255, 255, 255, 0.4)';
    badgeEl.style.border = '1px solid rgba(255, 255, 255, 0.05)';
    if (actionEl) {
      actionEl.style.display = 'grid';
      actionEl.disabled = false;
      actionEl.removeAttribute('data-trial-activate');
      const titleEl = actionEl.querySelector('strong');
      const subEl = actionEl.querySelector('small');
      if (titleEl) titleEl.textContent = 'Активировать Sistema Pro';
      if (subEl) subEl.textContent = 'Все видео, Общий чат и AI — 2990 ₽';
      actionEl.onclick = openAccountSubscriptionModal;
    }
    if (benefitsEl) {
      benefitsEl.style.display = 'grid';
      benefitsEl.innerHTML = '<span>Все видео-разделы и уроки без ограничений</span><span>Доступ в Общий чат участников</span><span>Расширенный доступ к Лизе, AI-помощнице системы</span>';
    }
    if (testEl) testEl.style.display = 'none';
  }

  var __lastRefreshSubCardAt = 0;
  async function refreshSubscriptionCard(opts = {}) {
    var now = Date.now();
    if (!opts.force && now - __lastRefreshSubCardAt < 30000) return;
    __lastRefreshSubCardAt = now;
    try {
      const sub = await window.API.getSubscription({ fresh: !!opts.force });
      try {
        if (sub && sub.subscription_active) {
          sessionStorage.removeItem('sistema:trial-activated-subscription');
        }
      } catch (e) {}
      
      const badgeEl = document.getElementById('dash-subscription-badge');
      if (badgeEl && badgeEl.textContent === 'пробный период' && !(sub && sub.subscription_active)) {
        if (window.sistemaClientLog) window.sistemaClientLog('profile-refresh-blocked-downgrade', { sub: sub || null });
        return;
      }
      
      renderSubscriptionCard(sub);
    } catch (e) {
      if (e && e.status === 429) return;
      const statusEl = document.getElementById('dash-subscription-status');
      const badgeEl = document.getElementById('dash-subscription-badge');
      if (statusEl) statusEl.textContent = 'Не удалось проверить подписку. Обновите вход в профиль.';
      if (badgeEl) badgeEl.textContent = 'ошибка';
    }
  }

  async function loadDashboard() {
    if (dashboardPromise) return dashboardPromise;
    dashboardPromise = (async () => {
    try {
      const data = await window.API.request('GET', '/profile/dashboard');
      dashboardLoadedOnce = true;
      const { user, stats, recent_activity, diary, daily_chart, ai_usage, access, courses } = data;
      const profile = JSON.parse(localStorage.getItem('sistema:onboarding-profile') || '{}');

      renderProfileHeader(user);

      // Subscription status UI
      const statusEl = document.getElementById('dash-subscription-status');
      const badgeEl = document.getElementById('dash-subscription-badge');
      const actionEl = document.getElementById('dash-subscription-action');
      const benefitsEl = document.getElementById('dash-subscription-benefits');
      const testEl = document.getElementById('dash-subscription-test');

      if (statusEl && badgeEl) {
        if (testEl) {
          testEl.onclick = async () => {
            const originalText = testEl.textContent;
            testEl.disabled = true;
            testEl.textContent = 'Активируем...';
            try {
              await window.API.request('POST', '/payment/test-activate');
              await loadDashboard();
            } catch (err) {
              alert(err.error || 'Не удалось активировать тестовую подписку.');
            } finally {
              testEl.disabled = false;
              testEl.textContent = originalText;
            }
          };
        }
        renderSubscriptionCard(user);
      }

      document.getElementById('streak-val')?.replaceChildren(document.createTextNode(String(stats.streak_days || 0)));
      document.getElementById('ring-streak')?.style.setProperty?.('--value', Math.min(100, Math.round(((stats.streak_days || 0) / 7) * 100)));
      document.getElementById('streak-big')?.replaceChildren(document.createTextNode('Открыто'));
      document.getElementById('member-since')?.replaceChildren(document.createTextNode('Маршрут собирается'));
      document.getElementById('pro-cta')?.replaceChildren(document.createTextNode('Продолжить путь'));

      const dotsEl = document.getElementById('streak-dots');
      const days7 = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
      const activeDates = new Set(daily_chart.map(d => d.day ? d.day.split('T')[0] : ''));
      const today = new Date();
      if (dotsEl) dotsEl.innerHTML = days7.map((d, i) => {
        const dt = new Date(today);
        const dayOfWeek = today.getDay(); // 0=sun
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        dt.setDate(today.getDate() - mondayOffset + i);
        const ds = dt.toISOString().split('T')[0];
        const active = activeDates.has(ds);
        const isToday = ds === today.toISOString().split('T')[0];
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
          <div style="width:28px;height:28px;border-radius:50%;background:${active ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.07)'};border:${isToday ? '2px solid rgba(255,255,255,.4)' : 'none'};"></div>
          <span style="font-size:9px;color:rgba(255,255,255,.25)">${d}</span>
        </div>`;
      }).join('');

      const pct = 100;
      document.getElementById('prog-bar')?.style && (document.getElementById('prog-bar').style.width = pct + '%');
      document.getElementById('access-desc')?.replaceChildren(document.createTextNode(profile.route
        ? `Выбранное направление: ${profile.route}. На сегодня собраны две программы для старта.`
        : 'Материалы открыты. Пройдите онбординг, чтобы собрать личный маршрут.'));
      document.getElementById('profile-main-direction')?.replaceChildren(document.createTextNode(profile.route || 'Не выбрано'));
      document.getElementById('profile-entry-format')?.replaceChildren(document.createTextNode(profile.entry === 'audio' ? 'Аудио' : profile.entry === 'short' ? 'Коротко' : 'Видео'));

      // Practice time
      const mins = stats.practice_minutes || 0;
      const h = Math.floor(mins / 60), m = mins % 60;
      document.getElementById('practice-time')?.replaceChildren(document.createTextNode(h > 0 ? `${h} ч ${m} мин` : `${m} мин`));

      // Bar chart
      const barEl = document.getElementById('bar-chart');
      const maxAct = Math.max(...daily_chart.map(d => parseInt(d.actions, 10) || 0), 1);
      if (barEl) barEl.innerHTML = days7.map((lbl, i) => {
        const dt = new Date(today);
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        dt.setDate(today.getDate() - mondayOffset + i);
        const ds = dt.toISOString().split('T')[0];
        const entry = daily_chart.find(d => (d.day || '').split('T')[0] === ds);
        const val = entry ? parseInt(entry.actions, 10) : 0;
        const heightPct = Math.max(8, Math.round((val / maxAct) * 100));
        const isToday = ds === today.toISOString().split('T')[0];
        return `<div class="bar-day">
          <div class="bar-fill ${isToday ? 'active' : ''}" style="height:${heightPct}%"></div>
          <span class="bar-lbl">${lbl}</span>
        </div>`;
      }).join('');

      // Goal (active days this week)
      document.getElementById('goal-done')?.replaceChildren(document.createTextNode(String(stats.active_days_this_week || 0)));
      document.getElementById('ring-week')?.style.setProperty?.('--value', Math.min(100, Math.round(((stats.active_days_this_week || 0) / 7) * 100)));

      // Product access cards
      document.getElementById('diary-last')?.replaceChildren(document.createTextNode('Сообщество подключаем как поддержку, а не как платный барьер.'));
      document.getElementById('open-diary-btn')?.replaceChildren(document.createTextNode('Открыть Telegram'));
      document.getElementById('ai-usage-card')?.replaceChildren(document.createTextNode(`${ai_usage?.used || 0}`));
      document.getElementById('ai-usage-desc')?.replaceChildren(document.createTextNode('без лимита'));
      const aiLimit = Math.max(ai_usage?.used || 1, 20);
      const aiUsed = ai_usage?.used || 0;
      document.getElementById('ring-ai')?.style.setProperty?.('--value', Math.min(100, Math.round((aiUsed / Math.max(1, aiLimit)) * 100)));
      document.getElementById('gratitude-cnt')?.replaceChildren(document.createTextNode(String(courses ? courses.length : 0)));
      document.getElementById('goal-done')?.replaceChildren(document.createTextNode(String(stats.completed_lessons || 0)));
      document.getElementById('goal-target')?.replaceChildren(document.createTextNode(String(courses ? courses.length : 11)));

      // ─── Populate Apple Watch Activity Ring ───────────
      const activeDays = stats.streak_days || 1;
      const activeGoal = 365;
      const targetPct = Math.min(1, activeDays / activeGoal);
      const targetPercentVal = Math.round(targetPct * 100);

      const ringEl = document.getElementById('watch-single-ring');
      const countEl = document.getElementById('watch-ring-count');
      const labelEl = document.getElementById('watch-streak-val');

      if (labelEl) {
        labelEl.textContent = `${activeDays} ${pluralDays(activeDays)}`;
      }

      if (ringEl) {
        // Smooth one-way iOS-like progress: no full spin and rollback.
        ringEl.setAttribute('stroke-dashoffset', '251.3');
        if (countEl) countEl.textContent = '0%';

        const animateCounter = (start, end, duration) => {
          if (!countEl) return;
          const startTime = performance.now();
          const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const linear = Math.min(elapsed / duration, 1);
            const progress = 1 - Math.pow(1 - linear, 3);
            const currentVal = Math.round(start + (end - start) * progress);
            countEl.textContent = `${currentVal}%`;
            if (linear < 1) {
              requestAnimationFrame(update);
            }
          };
          requestAnimationFrame(update);
        };

        requestAnimationFrame(() => {
          const finalOffset = 251.3 - (251.3 * targetPct);
          ringEl.setAttribute('stroke-dashoffset', String(finalOffset));
          animateCounter(0, targetPercentVal, 1350);
        });
      }

      // Continue learning — show static course cards (extend later from API)
      const courseItems = Array.isArray(courses) ? courses : [];
      const lessonsScroll = document.getElementById('lessons-scroll');
      if (lessonsScroll) lessonsScroll.innerHTML = courseItems.map((c, i) => `
        <a class="course-tile" href="${escapeHtml(safeInternalPath(c.href))}" style="--thumb:url('${escapeHtml(safeAssetPath(c.thumb))}')">
          <div class="course-tile-content">
            <p class="course-tile-title">${escapeHtml(c.title)}</p>
            <p class="course-tile-sub">Можно добавить в путь</p>
          </div>
        </a>
      `).join('');

    } catch (e) {
      console.error('Dashboard load error', e);
      if (e && (e.status === 401 || e.code === 'USER_INVALID' || e.code === 'TOKEN_INVALID')) {
        showAuthGate();
        return;
      }
    }

    // Log page view
    try { await window.API.request('POST', '/profile/activity', { event_type: 'page_view', entity_type: 'page', entity_id: 'profile' }); } catch {}
    })().finally(() => {
      dashboardPromise = null;
    });
    return dashboardPromise;
  }

  initProfile();

  document.getElementById('open-diary-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    alert('Ссылку на Telegram-канал добавим после финального подключения каналов.');
    return;
    const modal = document.getElementById('diary-modal');
    modal.style.display = 'flex';
    // Load entries
    try {
      const data = await window.API.request('GET', '/profile/diary');
      const entriesEl = document.getElementById('diary-entries');
      if (data.entries && data.entries.length > 0) {
        const moodEmoji = ['','😔','😐','🙂','😊','😄'];
        entriesEl.innerHTML = data.entries.map(e => `
          <div style="background:rgba(255,255,255,.04);border-radius:12px;padding:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:11px;color:rgba(255,255,255,.3)">${new Date(e.created_at).toLocaleDateString('ru-RU')}</span>
              ${e.mood ? `<span style="font-size:16px">${moodEmoji[e.mood]}</span>` : ''}
            </div>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,.7);line-height:1.5">${escapeHtml(e.content || '')}</p>
          </div>
        `).join('');
      } else {
        entriesEl.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,.3);font-size:13px">Пока нет записей</p>';
      }
    } catch {}
  });

  function closeDiary() {
    document.getElementById('diary-modal').style.display = 'none';
  }
  async function saveDiary() {
    const content = document.getElementById('diary-input').value.trim();
    if (!content) return;
    try {
      await window.API.request('POST', '/profile/diary', { content });
      document.getElementById('diary-input').value = '';
      document.getElementById('diary-last').textContent = 'Последняя запись: сегодня';
      closeDiary();
    } catch (e) { console.error(e); }
  }

  function doLogout() {
    window.API.logout();
    window.location.href = '/';
  }

  async function deleteAccount() {
    const firstConfirm = confirm('Удалить профиль на этом устройстве? Будут удалены прогресс, история AI и настройки маршрута.');
    if (!firstConfirm) return;
    const secondConfirm = confirm('Это действие нельзя отменить. Следующий заход начнется со сплеша и онбординга.');
    if (!secondConfirm) return;

    const button = document.getElementById('delete-account-btn');
    if (button) {
      button.disabled = true;
      button.textContent = 'Удаляем...';
    }

    try {
      await window.API.deleteAccount();
      window.API.clearLocalState();
      localStorage.removeItem('sistema:device-id');
      window.location.href = '/';
    } catch (err) {
      alert(err.error || 'Не удалось удалить аккаунт. Попробуйте еще раз.');
      if (button) {
        button.disabled = false;
        button.textContent = 'Удалить аккаунт';
      }
    }
  }

  document.getElementById('logout-btn')?.addEventListener('click', doLogout);
  document.getElementById('delete-account-btn')?.addEventListener('click', deleteAccount);
  document.getElementById('diary-close-btn')?.addEventListener('click', closeDiary);
  document.getElementById('diary-cancel-btn')?.addEventListener('click', closeDiary);
  document.getElementById('diary-save-btn')?.addEventListener('click', saveDiary);

  function pluralDays(n) {
    if (n % 10 === 1 && n % 100 !== 11) return 'день';
    if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'дня';
    return 'дней';
  }

  window.addEventListener('sistema:subscription-changed', function(event) {
    // High-water-mark: if we know the subscription is active, ignore stale events saying inactive.
    // When the trial expires, the countdown timer resets __sistemaSubscriptionActive to false.
    var eventActive = event?.detail?.active;
    if (eventActive === false && window.__sistemaSubscriptionActive === true) return;
    
    const badgeEl = document.getElementById('dash-subscription-badge');
    if (badgeEl && badgeEl.textContent === 'пробный период' && eventActive === false) {
      if (window.sistemaClientLog) window.sistemaClientLog('profile-event-blocked-downgrade', { detail: event?.detail || null });
      return;
    }
    
    if (event?.detail?.subscription) {
      renderSubscriptionCard(event.detail.subscription);
      return;
    }
    // No payload — don't force a fresh API call, just re-render from cache.
    if (window.API?.subscriptionCache) {
      renderSubscriptionCard(window.API.subscriptionCache);
    }
  });

  window.sistemaRenderSubscriptionCard = renderSubscriptionCard;
  window.sistemaForceSubscriptionSync = forceSubscriptionSync;

  window.addEventListener('pageshow', function() {
    forceSubscriptionSync().catch(() => {});
  });

  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) forceSubscriptionSync().catch(() => {});
  });
