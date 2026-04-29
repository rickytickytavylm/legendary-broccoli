/**
 * Auth Modal — вход / регистрация для Система Молодцова
 * Создаёт DOM-модалку при вызове openAuthModal()
 */
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .auth-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(20px);z-index:1000;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .35s cubic-bezier(.4,0,.2,1)}
    .auth-overlay.active{opacity:1}
    .auth-modal{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:24px;width:100%;max-width:400px;padding:36px 32px;position:relative;transform:translateY(16px) scale(.98);transition:transform .35s cubic-bezier(.4,0,.2,1);box-shadow:0 24px 80px rgba(0,0,0,.5)}
    .auth-overlay.active .auth-modal{transform:translateY(0) scale(1)}
    .auth-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;border:none;background:rgba(255,255,255,.06);color:var(--text-2,#888);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.2s}
    .auth-close:hover{background:rgba(255,255,255,.12);color:#fff}
    .auth-title{font-size:24px;font-weight:700;color:var(--text-1,#fff);margin:0 0 4px;text-align:center;letter-spacing:-.3px}
    .auth-subtitle{font-size:13px;color:var(--text-2,#888);text-align:center;margin:0 0 28px}
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
    .auth-form{display:flex;flex-direction:column;gap:12px}
    .auth-input{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px 16px;color:#fff;font-size:15px;outline:none;transition:.2s}
    .auth-input:focus{border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.06)}
    .auth-input::placeholder{color:rgba(255,255,255,.3)}
    .auth-btn{background:#fff;color:#000;border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:600;cursor:pointer;transition:.2s;margin-top:4px}
    .auth-btn:hover{opacity:.92;transform:translateY(-1px)}
    .auth-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
    .auth-error{color:#ff6b6b;font-size:13px;text-align:center;margin:0}
    .auth-switch{text-align:center;color:var(--text-2,#888);font-size:13px;margin-top:20px}
    .auth-switch a{color:#fff;text-decoration:none;cursor:pointer;font-weight:500;border-bottom:1px solid rgba(255,255,255,.3);padding-bottom:1px}
    .auth-switch a:hover{border-color:#fff}
    .auth-apple-icon{fill:currentColor}
    .auth-tg-icon{fill:currentColor}
  `;
  document.head.appendChild(style);

  let overlay = null;

  function createModal(type = 'login') {
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    const appleSvg = `<svg class="auth-apple-icon" viewBox="0 0 384 512"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.3q0 39.2 15.4 81.5c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 45.3-12.4 69.5-34.3z"/></svg>`;
    const tgSvg = `<svg class="auth-tg-icon" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>`;
    overlay.innerHTML = `
      <div class="auth-modal">
        <button class="auth-close" onclick="window.closeAuthModal()" aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <h2 class="auth-title">${type === 'login' ? 'Вход в Систему' : 'Регистрация'}</h2>
        <p class="auth-subtitle">${type === 'login' ? 'Войдите для доступа ко всем материалам' : 'Создайте аккаунт для полного доступа'}</p>

        <div class="auth-socials">
          <button class="auth-social auth-apple" onclick="alert('Вход через Apple ID в разработке')">
            ${appleSvg}
            Войти через Apple
          </button>
          <a href="https://t.me/YourBot?start=auth" class="auth-social auth-tg" id="auth-tg-btn">
            ${tgSvg}
            Войти через Telegram
          </a>
        </div>

        <div class="auth-divider"><span>или</span></div>

        <form class="auth-form" id="auth-form">
          ${type === 'register' ? '<input type="text" class="auth-input" name="name" placeholder="Ваше имя" required>' : ''}
          <input type="email" class="auth-input" name="email" placeholder="Email" required autocomplete="email">
          <input type="password" class="auth-input" name="password" placeholder="Пароль" required autocomplete="${type === 'login' ? 'current-password' : 'new-password'}">
          <p class="auth-error" id="auth-error" style="display:none"></p>
          <button type="submit" class="auth-btn" id="auth-submit">${type === 'login' ? 'Продолжить' : 'Создать аккаунт'}</button>
        </form>

        <p class="auth-switch">
          ${type === 'login'
            ? 'Нет аккаунта? <a onclick="window.openAuthModal(\'register\')">Зарегистрироваться</a>'
            : 'Уже есть аккаунт? <a onclick="window.openAuthModal(\'login\')">Войти</a>'}
        </p>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    overlay.addEventListener('click', e => {
      if (e.target === overlay) window.closeAuthModal();
    });

    document.getElementById('auth-form').addEventListener('submit', e => handleSubmit(e, type));
  }

  async function handleSubmit(e, type) {
    e.preventDefault();
    const btn = document.getElementById('auth-submit');
    const errEl = document.getElementById('auth-error');
    btn.disabled = true;
    errEl.style.display = 'none';

    const fd = new FormData(e.target);
    const data = {
      email: fd.get('email').trim().toLowerCase(),
      password: fd.get('password'),
    };
    if (type === 'register' && fd.get('name')) data.telegram_username = fd.get('name');

    try {
      const endpoint = type === 'login' ? '/auth/login' : '/auth/register';
      const res = await window.API.request('POST', endpoint, data);
      window.API.setTokens(res.tokens);
      window.closeAuthModal();
      window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: res.user } }));
      // Reload page to reflect auth state, or call refreshUI()
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
