(function() {
      const params = new URLSearchParams(location.search);
      const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
      const access = hash.get('access');
      const refresh = hash.get('refresh');
      const returnTo = params.get('returnTo') || '/';
      const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
      const status = document.getElementById('status');

      if (!access || !refresh || !window.API) {
        status.textContent = '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u0432\u0445\u043e\u0434. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0435 \u0440\u0430\u0437.';
        setTimeout(() => { window.location.replace('/'); }, 1200);
        return;
      }

      window.API.setTokens({ access, refresh });
      history.replaceState({}, document.title, '/auth-yandex/');
      window.dispatchEvent(new CustomEvent('auth:change'));
      setTimeout(() => { window.location.replace(safeReturnTo); }, 250);
    })();
