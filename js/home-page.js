if (window.ProgramCatalog) {
  window.ProgramCatalog.renderRail('#home-program-rail', 4);
  window.ProgramCatalog.renderWebinarRail('#home-webinar-rail');
  window.ProgramCatalog.renderMarathonRail('#home-marathon-rail');
  window.ProgramCatalog.renderResourceRail('#home-resource-rail');
}

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
