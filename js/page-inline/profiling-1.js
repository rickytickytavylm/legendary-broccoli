if (window.API.isLoggedIn()) {
      window.API.me().then(r => window.refreshAuthUI && window.refreshAuthUI(r.user)).catch(() => {});
    }
