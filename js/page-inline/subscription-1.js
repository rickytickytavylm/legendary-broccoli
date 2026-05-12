function escapeHtml(value) {
      return String(value || '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[char]));
    }

    (async () => {
      window.refreshAuthUI = function(user) {
        const btn = document.getElementById('nav-auth-btn');
        const link = document.getElementById('nav-account-link');
        if (user || window.API.isLoggedIn()) {
          if (btn) btn.style.display = 'none';
          if (link) link.style.display = 'inline-flex';
        }
      };
      if (window.API.isLoggedIn()) {
        window.API.me().then(r => window.refreshAuthUI(r.user)).catch(() => {});
      }

      try {
        const data = await window.API.getPlans();
        const container = document.getElementById('plans-container');
        container.innerHTML = data.plans.map(p => {
          let features = [];
          try {
            features = Array.isArray(p.features) ? p.features : (p.features ? JSON.parse(p.features) : []);
          } catch (e) {}
          return `
            <div class="bento-card reveal card-hover" style="padding:28px;flex-direction:column;align-items:flex-start">
              <h3 style="margin:0 0 8px;font-size:20px;color:#fff">${escapeHtml(p.title)}</h3>
              <p style="margin:0 0 16px;font-size:14px;color:var(--text-2);line-height:1.5">${escapeHtml(p.description || '')}</p>
              <div style="font-size:32px;font-weight:700;color:#fff;margin-bottom:20px">${escapeHtml(p.price_rub)} <span style="font-size:16px;font-weight:400;color:var(--text-2)">₽</span></div>
              <ul style="list-style:none;padding:0;margin:0 0 24px;display:flex;flex-direction:column;gap:10px">
                ${features.map(f => `<li style="display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text-1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#4ade80;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>${escapeHtml(f)}</li>`).join('')}
              </ul>
              <button class="btn btn-primary plan-subscribe-btn" style="width:100%;margin-top:auto" data-plan-slug="${escapeHtml(p.slug)}">Оформить</button>
            </div>
          `;
        }).join('');
        container.querySelectorAll('.plan-subscribe-btn').forEach((button) => {
          button.addEventListener('click', () => subscribe(button.dataset.planSlug || ''));
        });
      } catch (e) {
        document.getElementById('plans-container').innerHTML = '<p style="color:var(--text-2);text-align:center">Не удалось загрузить тарифы.</p>';
      }
    })();

    async function subscribe(planSlug) {
      if (!window.API.isLoggedIn()) {
        window.openAuthModal('login');
        window.addEventListener('auth:change', function handler(e) {
          window.removeEventListener('auth:change', handler);
          subscribe(planSlug);
        }, { once: true });
        return;
      }
      try {
        const res = await window.API.createPayment({ plan_slug: planSlug, provider: 'robokassa' });
        if (res.payment_url) window.location.href = res.payment_url;
        else alert('Ошибка создания платежа');
      } catch (err) {
        alert(err.error || 'Ошибка. Попробуйте позже.');
      }
    }
