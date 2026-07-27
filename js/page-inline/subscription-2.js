(function() {
  var btn = document.getElementById('sub-btn');
  var legal = document.getElementById('sub-legal');
  var planSlug = 'monthly';
  var tariffAvailable = true;

  function syncLegalState() {
    if (btn) btn.disabled = !tariffAvailable || !(legal && legal.checked);
  }
  legal && legal.addEventListener('change', syncLegalState);
  syncLegalState();

  function fmtPrice(n) { return Number(n).toLocaleString('ru-RU'); }

  if (window.API && window.API.getPlans) {
    window.API.getPlans().then(function(data) {
      var plans = data && data.plans;
      var p = plans && plans.find(function(x) { return x.slug === 'monthly'; });
      if (!p && plans) p = plans[0];
      if (p) {
        planSlug = p.slug;
        document.querySelector('.card .card_title').textContent = p.title || 'Система Молодцова';
        document.querySelector('.card .card_paragraph').textContent = p.description || 'Полный доступ ко всем материалам';
        btn.textContent = 'Оформить подписку — ' + fmtPrice(p.price_rub) + ' ₽';
      } else {
        btn.textContent = 'Тарифы недоступны';
        tariffAvailable = false;
        syncLegalState();
      }
    }).catch(function() {
      btn.textContent = 'Тарифы недоступны';
      tariffAvailable = false;
      syncLegalState();
    });
  }

  async function doSubscribe() {
    if (!window.API || !window.API.isLoggedIn || !window.API.isLoggedIn()) {
      if (window.openAuthModal) window.openAuthModal('login');
      return;
    }
    if (!window.requirePaymentLegalAccepted(document.querySelector('.card'))) return;
    btn.disabled = true;
    var original = btn.textContent;
    btn.textContent = 'Переходим к оплате...';
    try {
      var res = await window.API.createPayment({ plan_slug: planSlug, provider: 'yookassa' });
      if (window.API.redirectToPayment && window.API.redirectToPayment(res)) return;
      throw new Error('bad payment response');
    } catch (err) {
      btn.disabled = false;
      btn.textContent = original;
      alert(err.error || 'Ошибка при создании платежа. Попробуйте позже.');
    }
  }
  btn.addEventListener('click', doSubscribe);
})();
