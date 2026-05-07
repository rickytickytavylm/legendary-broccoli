/**
 * Auth Modal — phone OTP вход для Система Молодцова
 * Создаёт DOM-модалку при вызове openAuthModal()
 */
(function() {
  const TELEGRAM_BOT_ID = '8290766485';

  const style = document.createElement('style');
  style.textContent = `
    .auth-overlay{position:fixed;inset:0;width:100vw;height:100dvh;min-height:100dvh;background:rgba(0,0,0,.78);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);z-index:2300;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .28s cubic-bezier(.4,0,.2,1);padding:18px;overflow:hidden;overscroll-behavior:contain}
    .auth-overlay.active{opacity:1}
    .auth-modal{background:linear-gradient(180deg,rgba(28,38,58,.58),rgba(7,9,15,.88));border:1px solid rgba(255,255,255,.14);border-radius:24px;width:100%;max-width:400px;min-height:410px;padding:34px 30px 30px;position:relative;overflow:hidden;transform:translateY(10px) scale(.985);transition:transform .28s cubic-bezier(.4,0,.2,1);box-shadow:0 28px 90px rgba(0,0,0,.72),inset 0 1px 0 rgba(255,255,255,.14);backdrop-filter:blur(34px) saturate(150%);-webkit-backdrop-filter:blur(34px) saturate(150%)}
    .auth-modal::before{content:'';position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle at 24% 0%,rgba(107,145,255,.14),transparent 36%),radial-gradient(circle at 88% 92%,rgba(255,255,255,.06),transparent 34%);pointer-events:none}
    .auth-overlay.active .auth-modal{transform:translateY(0) scale(1)}
    .auth-close{position:absolute;top:14px;right:14px;height:40px;min-width:40px;padding:0 13px;border-radius:999px;border:1px solid rgba(255,255,255,.13);background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.055));color:rgba(255,255,255,.76);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:.2s;box-shadow:0 10px 28px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.12);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);font-size:13px;font-weight:600;line-height:1}
    .auth-close::after{content:'Закрыть'}
    .auth-close:hover{background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.08));color:#fff;border-color:rgba(255,255,255,.22)}
    .auth-brand{position:relative;z-index:1;display:flex;justify-content:center;margin:0 0 20px}
    .auth-brand img{width:132px;height:auto;display:block;filter:brightness(1.16)}
    .auth-title{position:relative;z-index:1;font-size:24px;font-weight:700;color:var(--text-1,#fff);margin:0 0 8px;text-align:center;letter-spacing:-.3px}
    .auth-subtitle{font-size:13px;line-height:1.5;color:var(--text-2,#888);text-align:center;margin:0 0 26px}
    .auth-phone-preview{display:none;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:11px 14px;color:rgba(255,255,255,.72);font-size:13px;text-align:center;margin-bottom:14px}
    .auth-socials{display:flex;flex-direction:column;gap:10px;margin-bottom:24px}
    .auth-social{display:flex;align-items:center;justify-content:center;gap:10px;border:none;border-radius:14px;padding:13px 16px;font-size:15px;font-weight:500;cursor:pointer;transition:all .2s;width:100%}
    .auth-social:hover{transform:translateY(-1px);opacity:.95}
    .auth-social svg{width:18px;height:18px}
    .auth-apple{background:#fff;color:#000}
    .auth-apple:hover{background:#f5f5f7}
    .auth-tg{position:relative;overflow:hidden;background:linear-gradient(135deg,rgba(42,171,238,.95),rgba(18,109,201,.88));color:#fff;border:1px solid rgba(255,255,255,.18);box-shadow:0 18px 42px rgba(42,171,238,.22),inset 0 1px 0 rgba(255,255,255,.22);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);font-weight:700}
    .auth-tg::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 20% 0%,rgba(255,255,255,.28),transparent 34%),linear-gradient(180deg,rgba(255,255,255,.08),transparent);pointer-events:none}
    .auth-tg:hover{background:linear-gradient(135deg,rgba(65,188,249,.98),rgba(21,121,218,.92));transform:translateY(-1px);box-shadow:0 20px 48px rgba(42,171,238,.28),inset 0 1px 0 rgba(255,255,255,.26)}
    .auth-tg span,.auth-tg svg{position:relative;z-index:1}
    .auth-telegram-widget{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden}
    .auth-email{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#fff}
    .auth-email:hover{background:rgba(255,255,255,.1)}
    .auth-divider{display:flex;align-items:center;gap:14px;margin:20px 0;color:rgba(255,255,255,.3);font-size:12px;text-transform:uppercase;letter-spacing:.5px}
    .auth-divider::before,.auth-divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.1)}
    .auth-form{position:relative;z-index:1;display:flex;flex-direction:column;gap:12px}
    .auth-input{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px 16px;color:#fff;font-size:15px;outline:none;transition:.2s}
    .auth-input.code{text-align:center;font-size:22px;letter-spacing:8px;font-weight:700}
    .auth-input:focus{border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.06)}
    .auth-input::placeholder{color:rgba(255,255,255,.3)}
    .auth-btn{background:#fff;color:#000;border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:600;cursor:pointer;transition:.2s;margin-top:4px}
    .auth-btn:hover{opacity:.92;transform:translateY(-1px)}
    .auth-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
    .auth-error{color:#ff6b6b;font-size:13px;text-align:center;margin:0}
    .auth-success{background:rgba(88,214,141,.1);border:1px solid rgba(88,214,141,.22);color:#b8f7cd;border-radius:16px;padding:14px 16px;font-size:13px;line-height:1.5;text-align:left;margin:0 0 14px}
    .auth-note{font-size:12px;line-height:1.45;color:rgba(255,255,255,.38);text-align:center;margin:2px 0 0}
    .auth-secondary{background:transparent;color:rgba(255,255,255,.62);border:0;font-size:13px;cursor:pointer;padding:8px 0}
    .auth-secondary:hover{color:#fff}
    .auth-switch{text-align:center;color:var(--text-2,#888);font-size:13px;margin-top:20px}
    .auth-switch a{color:#fff;text-decoration:none;cursor:pointer;font-weight:500;border-bottom:1px solid rgba(255,255,255,.3);padding-bottom:1px}
    .auth-switch a:hover{border-color:#fff}
    .auth-apple-icon{fill:currentColor}
    .auth-tg-icon{fill:currentColor}
    html.auth-scroll-lock,body.auth-scroll-lock{overflow:hidden;overscroll-behavior:none}
    @media (max-width:560px){
      .auth-overlay{align-items:center;justify-content:center;background:rgba(0,0,0,.86);padding:calc(14px + env(safe-area-inset-top)) 12px calc(14px + env(safe-area-inset-bottom));touch-action:none}
      .auth-modal{width:min(100%,390px);min-height:auto;max-height:calc(100dvh - 36px);overflow:auto;padding:30px 22px 24px;border-radius:26px;background:linear-gradient(180deg,rgba(28,38,58,.64),rgba(7,9,15,.92));box-shadow:0 24px 90px rgba(0,0,0,.82)}
      .auth-brand img{width:126px}
      .auth-title{font-size:23px}
      .auth-subtitle{color:rgba(255,255,255,.66)}
      .auth-input{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18)}
      .auth-close{top:12px;right:12px;height:42px;min-width:42px;padding:0 14px}
    }
  `;
  document.head.appendChild(style);

  let overlay = null;
  let scrollYBeforeAuth = 0;

  function lockPageScroll() {
    if (document.body.classList.contains('auth-scroll-lock')) return;
    scrollYBeforeAuth = window.scrollY || document.documentElement.scrollTop || 0;
    document.documentElement.classList.add('auth-scroll-lock');
    document.body.classList.add('auth-scroll-lock');
  }

  function unlockPageScroll() {
    document.documentElement.classList.remove('auth-scroll-lock');
    document.body.classList.remove('auth-scroll-lock');
    window.scrollTo(0, scrollYBeforeAuth);
  }

  function createModal(type = 'login') {
    clearFallbackTimer();
    if (overlay) overlay.remove();
    lockPageScroll();
    overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.innerHTML = `
      <div class="auth-modal">
        <button class="auth-close" onclick="window.closeAuthModal()" aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="auth-brand">
          <img src="/assets/webp/logo2-Photoroom.webp" alt="Система Молодцова" width="132" height="132" decoding="async" onerror="this.onerror=null;this.src='/assets/webp/logo2.webp';">
        </div>
        <h2 class="auth-title">Вход в Систему</h2>
        <p class="auth-subtitle" id="auth-subtitle">Войдите через Telegram — без SMS, пароля и ожидания кода.</p>
        <div class="auth-phone-preview" id="auth-phone-preview"></div>

        <form class="auth-form" id="auth-form">
          <button type="button" class="auth-social auth-tg" id="auth-telegram-btn">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.8 4.6 18.6 19.7c-.24 1.06-.86 1.32-1.74.82l-4.8-3.54-2.32 2.23c-.26.26-.47.47-.96.47l.34-4.88 8.9-8.04c.39-.34-.08-.53-.6-.19l-11 6.93-4.74-1.48c-1.03-.32-1.05-1.03.21-1.52L20.4 3.36c.86-.32 1.62.2 1.4 1.24z"/></svg>
            <span>Войти через Telegram</span>
          </button>
          <p class="auth-error" id="auth-error" style="display:none"></p>
          <p class="auth-note" id="auth-note">Telegram подтвердит профиль и сразу откроет доступ.</p>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('touchmove', (event) => {
      if (!event.target.closest('.auth-modal')) event.preventDefault();
    }, { passive: false });
    requestAnimationFrame(() => overlay.classList.add('active'));

    document.getElementById('auth-form').addEventListener('submit', handleSubmit);
    const tgBtn = document.getElementById('auth-telegram-btn');
    if (tgBtn) tgBtn.addEventListener('click', startTelegramLogin);
  }

  let authStep = 'phone';
  let pendingPhone = '';
  let pendingCodeLength = 6;
  let fallbackTimer = null;
  let fallbackUnlockAt = 0;
  let telegramAuthOpenTimer = null;

  function clearFallbackTimer() {
    if (fallbackTimer) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
  }

  function formatFallbackTime(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function normalizePhoneInput(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1);
    if (digits.length === 11 && digits.startsWith('7')) return '+' + digits;
    if (digits.length === 10 && digits.startsWith('9')) return '+7' + digits;
    return '';
  }

  function showSmsPhoneStep() {
    clearFallbackTimer();
    authStep = 'phone';
    document.getElementById('auth-subtitle').textContent = 'Введите номер телефона — пришлём SMS-код для входа.';
    const preview = document.getElementById('auth-phone-preview');
    preview.textContent = '';
    preview.style.display = 'none';
    document.getElementById('auth-form').innerHTML = `
      <input type="tel" class="auth-input" name="phone" placeholder="+7 999 123-45-67" required autocomplete="tel" inputmode="tel">
      <p class="auth-error" id="auth-error" style="display:none"></p>
      <button type="submit" class="auth-btn" id="auth-submit">Получить код</button>
      <button type="button" class="auth-secondary" id="auth-back-to-tg">Назад к Telegram</button>
      <p class="auth-note" id="auth-note">Код действует 5 минут. Если SMS не придёт, через минуту можно запросить звонок с кодом.</p>
    `;
    document.getElementById('auth-back-to-tg').addEventListener('click', () => createModal('login'));
    document.getElementById('auth-form').addEventListener('submit', handleSubmit);
    document.querySelector('.auth-input[name="phone"]').focus();
  }

  function ensureTelegramWidgetScript() {
    return new Promise((resolve, reject) => {
      if (window.Telegram && window.Telegram.Login) return resolve();
      const existing = document.querySelector('script[data-telegram-login-sdk="true"]');
      const timeout = setTimeout(() => reject(new Error('Telegram Login SDK timeout')), 8000);
      const finish = (fn) => {
        clearTimeout(timeout);
        fn();
      };
      if (existing) {
        existing.addEventListener('load', () => finish(resolve), { once: true });
        existing.addEventListener('error', () => finish(() => reject(new Error('Telegram Login SDK failed'))), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.async = true;
      script.dataset.telegramLoginSdk = 'true';
      script.onload = () => finish(resolve);
      script.onerror = () => finish(() => reject(new Error('Telegram Login SDK failed')));
      document.head.appendChild(script);
    });
  }

  async function finishTelegramAuth(userData) {
    const errEl = document.getElementById('auth-error');
    try {
      const res = await window.API.telegramLoginWidget(userData);
      window.API.setTokens(res.tokens);
      window.closeAuthModal();
      window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: res.user } }));
      if (window.refreshAuthUI) window.refreshAuthUI(res.user);
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.error || 'Не удалось войти через Telegram.';
        errEl.style.display = 'block';
      }
    }
  }

  function showTelegramUnavailableMessage() {
    const errEl = document.getElementById('auth-error');
    if (!errEl) return;
    errEl.textContent = 'Не удалось открыть вход через Telegram. Возможно, сервис недоступен или заблокирован в вашей стране. Попробуйте включить VPN и повторить вход.';
    errEl.style.display = 'block';
  }

  function clearTelegramAuthOpenTimer() {
    if (!telegramAuthOpenTimer) return;
    clearTimeout(telegramAuthOpenTimer);
    telegramAuthOpenTimer = null;
  }

  async function startTelegramLogin() {
    const btn = document.getElementById('auth-telegram-btn');
    const errEl = document.getElementById('auth-error');
    if (btn) btn.disabled = true;
    if (errEl) errEl.style.display = 'none';
    clearTelegramAuthOpenTimer();
    try {
      await ensureTelegramWidgetScript();
      if (!window.Telegram || !window.Telegram.Login) throw new Error('Telegram Login SDK unavailable');
      telegramAuthOpenTimer = setTimeout(() => {
        if (btn) btn.disabled = false;
        showTelegramUnavailableMessage();
      }, 8000);
      window.Telegram.Login.auth(
        { bot_id: TELEGRAM_BOT_ID, request_access: true },
        (user) => {
          clearTelegramAuthOpenTimer();
          if (btn) btn.disabled = false;
          if (!user) {
            if (errEl) {
              errEl.textContent = 'Вход через Telegram отменён.';
              errEl.style.display = 'block';
            }
            return;
          }
          finishTelegramAuth(user);
        }
      );
    } catch (err) {
      clearTelegramAuthOpenTimer();
      if (btn) btn.disabled = false;
      showTelegramUnavailableMessage();
    }
  }

  function setupCallFallbackButton() {
    const callBtn = document.getElementById('auth-call');
    if (!callBtn) return;
    const errEl = document.getElementById('auth-error');

    const updateButton = () => {
      const remaining = fallbackUnlockAt - Date.now();
      if (remaining <= 0) {
        clearFallbackTimer();
        callBtn.disabled = false;
        callBtn.textContent = 'Получить код звонком';
        return;
      }
      callBtn.disabled = true;
      callBtn.textContent = `Получить код звонком через ${formatFallbackTime(remaining)}`;
    };

    updateButton();
    if (callBtn.disabled) fallbackTimer = setInterval(updateButton, 1000);

    callBtn.addEventListener('click', async () => {
      callBtn.disabled = true;
      errEl.style.display = 'none';
      try {
        const res = await window.API.requestPhoneCall({ phone: pendingPhone });
        showCodeStep(pendingPhone, {
          channel: res.channel || 'call',
          codeLength: res.code_length || 4,
          message: res.message,
        });
      } catch (err) {
        errEl.textContent = err.error || 'Не удалось запросить звонок. Попробуйте позже.';
        errEl.style.display = 'block';
        updateButton();
      }
    });
  }

  function showCodeStep(phone, options = {}) {
    clearFallbackTimer();
    authStep = 'code';
    pendingPhone = phone;
    pendingCodeLength = Number(options.codeLength || 6);
    const isCall = (options.channel || 'sms') === 'call';
    document.getElementById('auth-subtitle').textContent = isCall
      ? 'Мы звоним вам. Введите 4 последние цифры номера входящего звонка.'
      : 'Введите код из SMS. Если SMS не пришло, через минуту можно запросить код звонком.';
    const preview = document.getElementById('auth-phone-preview');
    preview.textContent = phone;
    preview.style.display = 'block';
    document.getElementById('auth-form').innerHTML = `
      <input type="text" class="auth-input code" name="code" placeholder="${'0'.repeat(pendingCodeLength)}" required autocomplete="one-time-code" inputmode="numeric" maxlength="${pendingCodeLength}">
      <p class="auth-error" id="auth-error" style="display:none"></p>
      <button type="submit" class="auth-btn" id="auth-submit">Войти</button>
      ${isCall ? '' : '<button type="button" class="auth-secondary" id="auth-call" disabled>Получить код звонком через 1:00</button>'}
      <button type="button" class="auth-secondary" id="auth-back">Изменить номер</button>
      <p class="auth-note" id="auth-note">${options.message || (isCall ? 'Мы звоним вам. Введите 4 последние цифры номера, с которого поступит звонок.' : 'Если SMS не пришло, через минуту можно запросить звонок с кодом.')}</p>
    `;
    document.getElementById('auth-back').addEventListener('click', () => createModal('login'));
    document.getElementById('auth-form').addEventListener('submit', handleSubmit);
    if (!isCall) {
      fallbackUnlockAt = Date.now() + 60 * 1000;
      setupCallFallbackButton();
    }
    document.querySelector('.auth-input.code').focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('auth-submit');
    const errEl = document.getElementById('auth-error');
    btn.disabled = true;
    errEl.style.display = 'none';

    const fd = new FormData(e.target);

    try {
      if (authStep === 'phone') {
        const phone = normalizePhoneInput(fd.get('phone'));
        if (!phone) throw { error: 'Введите номер в формате +7 999 123-45-67' };
        const res = await window.API.requestPhoneCode({ phone });
        showCodeStep(phone, {
          channel: res.channel || 'sms',
          codeLength: res.code_length || 6,
          message: res.message,
        });
        return;
      }

      const code = String(fd.get('code') || '').replace(/\D/g, '');
      const res = await window.API.verifyPhoneCode({ phone: pendingPhone, code });
      window.API.setTokens(res.tokens);
      window.closeAuthModal();
      window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: res.user } }));
      if (window.refreshAuthUI) window.refreshAuthUI(res.user);
    } catch (err) {
      errEl.textContent = err.error || 'Ошибка. Попробуйте позже.';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
    }
  }

  window.openAuthModal = (type = 'login') => createModal(type);
  window.closeAuthModal = () => {
    if (!overlay) return;
    clearFallbackTimer();
    overlay.classList.remove('active');
    unlockPageScroll();
    setTimeout(() => { if (overlay) { overlay.remove(); overlay = null; } }, 300);
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-auth-open]');
    if (!trigger) return;
    event.preventDefault();
    window.openAuthModal(trigger.getAttribute('data-auth-open') || 'login');
  });

  // Telegram Web App auto-auth
  if (window.Telegram && Telegram.WebApp && Telegram.WebApp.initData) {
    window.API.telegramAuth(Telegram.WebApp.initData)
      .then(res => {
        window.API.setTokens(res.tokens);
        window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: res.user } }));
        if (window.refreshAuthUI) window.refreshAuthUI(res.user);
      })
      .catch(() => {}); // silent fail, user can login manually
  }
})();
