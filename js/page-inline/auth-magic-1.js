const params = new URLSearchParams(location.search);
    const token = params.get('token') || '';
    const rawReturnTo = params.get('returnTo') || '';
    const returnTo = rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '';
    const title = document.getElementById('magic-title');
    const text = document.getElementById('magic-text');
    const small = document.getElementById('magic-small');
    const resendForm = document.getElementById('resend-form');
    const doneActions = document.getElementById('done-actions');
    const emailInput = document.getElementById('email');

    function showResend(state, email) {
      const isExpired = state === 'expired';
      title.textContent = isExpired ? 'Ссылка устарела' : 'Ссылка недействительна';
      text.textContent = isExpired
        ? 'Для безопасности ссылка действует ограниченное время. Введите почту, и мы пришлём новую.'
        : 'Эта ссылка уже использована или повреждена. Запросите новую ссылку для входа.';
      if (email) emailInput.value = email;
      resendForm.style.display = 'flex';
      small.textContent = 'Новая ссылка будет действовать 15 минут.';
    }

    async function verify() {
      if (!token) {
        showResend('invalid');
        return;
      }
      try {
        const res = await window.API.verifyMagicLink(token);
        window.API.setTokens(res.tokens);
        history.replaceState({}, document.title, '/auth-magic/');
        window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: res.user } }));
        title.textContent = 'Готово, вы вошли';
        text.textContent = 'Сейчас перенаправим вас дальше.';
        const target = returnTo || res.redirect_to || '/account/';
        setTimeout(() => { window.location.href = target; }, 500);
      } catch (err) {
        history.replaceState({}, document.title, '/auth-magic/');
        showResend(err.status === 410 ? 'expired' : 'invalid', err.email);
      }
    }

    resendForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const btn = document.getElementById('resend-btn');
      btn.disabled = true;
      try {
        await window.API.requestMagicLink({ email: emailInput.value.trim(), returnTo });
        title.textContent = 'Письмо отправлено';
        text.textContent = 'Проверьте почту. Если письма нет во входящих, загляните в «Спам».';
        resendForm.style.display = 'none';
        doneActions.style.display = 'flex';
        small.textContent = '';
      } catch (err) {
        text.textContent = err.error || 'Не получилось отправить письмо. Попробуйте ещё раз.';
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('request-new-link-btn')?.addEventListener('click', () => {
      if (window.openAuthModal) window.openAuthModal('login');
    });

    verify();
