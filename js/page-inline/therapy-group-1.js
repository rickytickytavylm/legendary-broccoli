(function initTherapyGroupPage() {
  const params = new URLSearchParams(location.search);
  const route = params.get('route') || window.getUserDirectionRouteKey?.() || 'relationships';
  const cfg = window.SISTEMA_THERAPY_GROUPS && window.SISTEMA_THERAPY_GROUPS[route];
  if (cfg && cfg.kind === 'telegram-club' && cfg.externalUrl) {
    location.replace(cfg.externalUrl);
    return;
  }
  const root = document.querySelector('[data-chat-root]');
  if (root) root.dataset.therapyRoute = route;
  if (cfg) {
    document.title = 'Терапевтическая группа — ' + cfg.title;
    const title = document.querySelector('[data-therapy-chat-title]');
    const subtitle = document.querySelector('[data-therapy-chat-subtitle]');
    if (title) title.textContent = cfg.title;
    if (subtitle) subtitle.textContent = 'Ведущий: ' + cfg.leader;
  }
})();
