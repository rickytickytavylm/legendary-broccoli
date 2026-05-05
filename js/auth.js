/**
 * Auth Modal — phone OTP вход для Система Молодцова
 * Создаёт DOM-модалку при вызове openAuthModal()
 */
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .auth-overlay{position:fixed;inset:0;background:rgba(0,0,0,.78);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);z-index:2300;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .28s cubic-bezier(.4,0,.2,1);padding:18px}
    .auth-overlay.active{opacity:1}
    .auth-modal{background:linear-gradient(180deg,rgba(28,38,58,.58),rgba(7,9,15,.88));border:1px solid rgba(255,255,255,.14);border-radius:24px;width:100%;max-width:400px;min-height:410px;padding:34px 30px 30px;position:relative;overflow:hidden;transform:translateY(10px) scale(.985);transition:transform .28s cubic-bezier(.4,0,.2,1);box-shadow:0 28px 90px rgba(0,0,0,.72),inset 0 1px 0 rgba(255,255,255,.14);backdrop-filter:blur(34px) saturate(150%);-webkit-backdrop-filter:blur(34px) saturate(150%)}
    .auth-modal::before{content:'';position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle at 24% 0%,rgba(107,145,255,.14),transparent 36%),radial-gradient(circle at 88% 92%,rgba(255,255,255,.06),transparent 34%);pointer-events:none}
    .auth-overlay.active .auth-modal{transform:translateY(0) scale(1)}
    .auth-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;border:none;background:rgba(255,255,255,.06);color:var(--text-2,#888);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.2s}
    .auth-close:hover{background:rgba(255,255,255,.12);color:#fff}
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
    .auth-tg{background:#2AABEE;color:#fff}
    .auth-tg:hover{background:#229ED9}
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
    @media (max-width:560px){
      .auth-overlay{align-items:flex-end;background:rgba(0,0,0,.86);padding:16px 12px calc(16px + env(safe-area-inset-bottom))}
      .auth-modal{max-width:none;min-height:420px;padding:30px 22px 24px;border-radius:26px;background:linear-gradient(180deg,rgba(28,38,58,.64),rgba(7,9,15,.92));box-shadow:0 -18px 80px rgba(0,0,0,.82)}
      .auth-brand img{width:126px}
      .auth-title{font-size:23px}
      .auth-subtitle{color:rgba(255,255,255,.66)}
      .auth-input{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18)}
    }
  `;
  document.head.appendChild(style);

  let overlay = null;

  function createModal(type = 'login') {
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.innerHTML = `
      <div class="auth-modal">
        <button class="auth-close" onclick="window.closeAuthModal()" aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="auth-brand">
          <img src="/assets/logo2-Photoroom.png" alt="Система Молодцова">
        </div>
        <h2 class="auth-title">Вход в Систему</h2>
        <p class="auth-subtitle" id="auth-subtitle">Введите номер телефона — пришлём SMS-код для входа.</p>
        <div class="auth-phone-preview" id="auth-phone-preview"></div>

        <form class="auth-form" id="auth-form">
          <input type="tel" class="auth-input" name="phone" placeholder="+7 999 123-45-67" required autocomplete="tel" inputmode="tel">
          <p class="auth-error" id="auth-error" style="display:none"></p>
          <button type="submit" class="auth-btn" id="auth-submit">Получить код</button>
          <p class="auth-note" id="auth-note">Код действует 5 минут. Пароль не нужен.</p>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    document.getElementById('auth-form').addEventListener('submit', handleSubmit);
  }

  let authStep = 'phone';
  let pendingPhone = '';

  function normalizePhoneInput(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1);
    if (digits.length === 11 && digits.startsWith('7')) return '+' + digits;
    if (digits.length === 10 && digits.startsWith('9')) return '+7' + digits;
    return '';
  }

  function showCodeStep(phone) {
    authStep = 'code';
    pendingPhone = phone;
    document.getElementById('auth-subtitle').textContent = 'Введите 6 цифр из SMS. Мы сразу откроем доступ.';
    const preview = document.getElementById('auth-phone-preview');
    preview.textContent = phone;
    preview.style.display = 'block';
    document.getElementById('auth-form').innerHTML = `
      <input type="text" class="auth-input code" name="code" placeholder="000000" required autocomplete="one-time-code" inputmode="numeric" maxlength="6">
      <p class="auth-error" id="auth-error" style="display:none"></p>
      <button type="submit" class="auth-btn" id="auth-submit">Войти</button>
      <button type="button" class="auth-secondary" id="auth-back">Изменить номер</button>
      <p class="auth-note" id="auth-note">Если код не пришёл, проверьте номер и запросите новый через минуту.</p>
    `;
    document.getElementById('auth-back').addEventListener('click', () => createModal('login'));
    document.getElementById('auth-form').addEventListener('submit', handleSubmit);
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
        await window.API.requestPhoneCode({ phone });
        showCodeStep(phone);
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
    overlay.classList.remove('active');
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
