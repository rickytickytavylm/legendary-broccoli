/**
 * nav.js — Global navigation (sidebar + tabbar)
 * Injected into every page. Handles scroll-triggered reveal via GPU transform only.
 */
(function initNav() {
  function icon(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  // ── Inject CSS ─────────────────────────────────────────
  if (!document.querySelector('link[href*="nav.css"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/nav.css?v=72';
    document.head.appendChild(link);
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.getRegistrations()
        .then(function(registrations) {
          registrations.forEach(function(registration) { registration.unregister(); });
        })
        .catch(function() {});
    }, { once: true });
  }

  document.addEventListener('contextmenu', function(event) {
    if (event.target && event.target.closest && event.target.closest('video')) {
      event.preventDefault();
    }
  });

  // ── Nav items config ────────────────────────────────────
  var NAV_ITEMS = [
    {
      id: 'home',
      href: '/',
      label: 'Сегодня',
      icon: icon('<path d="m3 10.5 9-7 9 7"/><path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9"/><path d="M9 20v-6h6v6"/>')
    },
    {
      id: 'feed',
      href: '/feed/',
      label: 'Лента',
      icon: icon('<path d="M5 5h14"/><path d="M5 12h14"/><path d="M5 19h10"/><path d="M4 4.5h.01"/><path d="M4 11.5h.01"/><path d="M4 18.5h.01"/>')
    },
    {
      id: 'shorts',
      href: '/shorts/',
      label: 'Shorts',
      labelShort: 'Shorts',
      icon: icon('<path d="M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="m11 10 4 2.5-4 2.5z"/>')
    },
    {
      id: 'community',
      href: '/community/',
      label: 'Сообщество',
      labelShort: 'Сообщество',
      icon: icon('<path d="M16 11a4 4 0 1 0-8 0"/><path d="M3 21a7 7 0 0 1 18 0"/><path d="M18 8a3 3 0 0 1 3 3"/><path d="M6 8a3 3 0 0 0-3 3"/>')
    },
    {
      id: 'meditations',
      href: '/meditations/',
      label: 'Медитации',
      labelShort: 'Медитации',
      icon: icon('<path d="M12 4v16"/><path d="M8 7v10"/><path d="M16 7v10"/><path d="M4 10v4"/><path d="M20 10v4"/>')
    },
    {
      id: 'ai',
      href: '/ai/',
      label: 'AI-помощник',
      labelShort: 'AI',
      icon: icon('<path d="M12 3 14.4 8.8 20 11l-5.6 2.2L12 19l-2.4-5.8L4 11l5.6-2.2L12 3Z"/><path d="M19 16v4"/><path d="M17 18h4"/>')
    }
  ];

  var BOTTOM_ITEMS = [
    {
      id: 'profile',
      href: '/account/',
      label: 'Профиль',
      icon: icon('<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>')
    }
  ];

  var ALL_ITEMS = NAV_ITEMS.concat(BOTTOM_ITEMS);

  /** Единый футер как на страницах курсов — подставляется, если в разметке нет <footer class="footer"> */
  var APP_GLOBAL_FOOTER_HTML =
    '<footer class="footer app-injected-footer">' +
      '<div class="footer-content">' +
        '<div class="footer-col footer-about">' +
          '<img src="/assets/webp/logo2.webp" alt="Система" loading="lazy" decoding="async" class="footer-logo">' +
          '<p class="footer-desc">Авторский проект Руслана Молодцова<br>о мышлении, психологии и практиках<br>для жизни.</p>' +
          '<p class="footer-copy"> 2026 Система Молодцова.<br>Все права защищены.</p>' +
        '</div>' +
        '<div class="footer-col">' +
          '<h4 class="footer-heading">О проекте</h4>' +
          '<ul class="footer-list">' +
            '<li><a href="/about/">О сообществе</a></li>' +
            '<li><a href="/author/">Об авторе</a></li>' +
            '<li><a href="#">Партнёрам</a></li>' +
            '<li><a href="#">Контакты</a></li>' +
          '</ul>' +
        '</div>' +
        '<div class="footer-col">' +
          '<h4 class="footer-heading">Обучение</h4>' +
          '<ul class="footer-list">' +
            '<li><a href="/programs/">Все программы</a></li>' +
            '<li><a href="/feed/">Лента</a></li>' +
            '<li><a href="#">Библиотека</a></li>' +
            '<li><a href="/terapiya/">Практики</a></li>' +
          '</ul>' +
        '</div>' +
        '<div class="footer-col">' +
          '<h4 class="footer-heading">Поддержка</h4>' +
          '<ul class="footer-list">' +
            '<li><a href="#">Вопросы и ответы</a></li>' +
            '<li><a href="/terms/">Условия использования</a></li>' +
            '<li><a href="/privacy/">Политика конфиденциальности</a></li>' +
            '<li><a href="#">Возврат средств</a></li>' +
          '</ul>' +
        '</div>' +
        '<div class="footer-col footer-cta">' +
          '<h4 class="footer-heading">Будьте в курсе</h4>' +
          '<p class="footer-desc">Получайте важные материалы<br>и анонсы прямо в Telegram.</p>' +
          '<a href="https://t.me/obrazmisl" target="_blank" rel="noopener noreferrer" class="btn-footer-telegram">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path></svg>' +
            'Подписаться в Telegram' +
          '</a>' +
          '<div class="footer-socials">' +
            '<a href="https://t.me/obrazmisl" target="_blank" rel="noopener noreferrer" aria-label="Telegram">' +
              '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path></svg>' +
            '</a>' +
            '<a href="#" target="_blank" rel="noopener noreferrer" aria-label="YouTube">' +
              '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>' +
            '</a>' +
            '<a href="#" target="_blank" rel="noopener noreferrer" aria-label="Instagram">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>' +
            '</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="footer-bottom">' +
        '<div class="footer-trust">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' +
          'Ваши данные под надёжной защитой.' +
        '</div>' +
        '<div class="footer-craft">Сделано с вниманием к деталям' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7M17 7H7M17 7v10"></path></svg>' +
        '</div>' +
      '</div>' +
    '</footer>';

  var HOME_SCROLL_KEY = 'sistema:home-scroll-y';
  var RESTORE_HOME_SCROLL_KEY = 'sistema:restore-home-scroll';
  var VIDEO_ACCESS_BYPASS = window.VIDEO_ACCESS_BYPASS !== false;
  var COURSE_PREFETCH = {
    '/geshtalt/': { api: '/content/geshtalt-lessons', image: '/assets/webp/courses.webp' },
    '/sozavisimost/': { api: '/content/sozavisimost-lessons', image: '/assets/webp/coda2.webp' },
    '/psihosomatika/': { api: '/content/psihosomatika-lessons', image: '/assets/webp/psysomatic.webp' },
    '/mj/': { api: '/content/mj-lessons', image: '/assets/webp/man_woman.webp' },
    '/yoga/': { api: '/content/yoga-lessons', image: '/assets/webp/mini-yoga.webp' },
    '/marathons/': { api: '/content/marathons-lessons', image: '/assets/webp/maraphones.webp' },
    '/superviziya/': { api: '/content/superviziya-lessons', image: '/assets/webp/supervision.webp' },
    '/antologiya/': { api: '/content/antologiya-lessons', image: '/assets/webp/antology.webp' },
    '/terapiya/': { image: '/assets/webp/theraphy.webp' },
    '/gipnoz/': { image: '/assets/webp/hipno.webp' },
    '/master/': { image: '/assets/webp/masterofcommication.webp' },
    '/dermer/': { image: '/assets/webp/geshtalt.webp' },
  };

  // ── Active page detection ───────────────────────────────
  var currentPath = location.pathname;

  function isActive(href) {
    if (href === '/') return currentPath === '/' || currentPath.endsWith('/index.html');
    var normalizedHref = href.replace(/\/+$/, '') || '/';
    if (currentPath === href || currentPath === normalizedHref || currentPath === normalizedHref + '/') return true;
    var segments = normalizedHref.split('/').filter(Boolean);
    var slug = segments.length ? segments[segments.length - 1] : '';
    if (!slug) return false;
    return currentPath === '/' + slug + '/' || currentPath.endsWith('/' + slug + '/') || currentPath.endsWith('/' + slug + '.html');
  }

  function makeIcon(svgStr) {
    return '<span class="sidebar-icon">' + svgStr + '</span>';
  }

  function makeTabIcon(svgStr) {
    return '<span class="tabbar-icon-wrap">' + svgStr + '</span>';
  }

  // ── Build sidebar ───────────────────────────────────────
  var sidebar = document.createElement('aside');
  sidebar.id = 'app-sidebar';
  sidebar.className = 'app-sidebar';

  var navItemsHTML = NAV_ITEMS.map(function(item) {
    return '<a href="' + item.href + '" class="sidebar-item' + (isActive(item.href) ? ' active' : '') + '">' +
      makeIcon(item.icon) +
      '<span class="sidebar-label">' + item.label + '</span>' +
      '</a>';
  }).join('');

  var bottomItemsHTML = BOTTOM_ITEMS.map(function(item) {
    return '<a href="' + item.href + '" class="sidebar-item' + (isActive(item.href) ? ' active' : '') + '">' +
      makeIcon(item.icon) +
      '<span class="sidebar-label">' + item.label + '</span>' +
      '</a>';
  }).join('');

  sidebar.innerHTML =
    '<div class="sidebar-head">' +
      '<a href="/" class="sidebar-brand">' +
        '<img src="/assets/webp/logo2-Photoroom.webp" alt="Система" class="sidebar-logo-img sidebar-logo-wordmark">' +
      '</a>' +
    '</div>' +
    '<nav class="sidebar-nav">' + navItemsHTML + '</nav>' +
    '<div class="sidebar-flex-grow"></div>' +
    '<div class="sidebar-footer">' +
      '<div class="sidebar-account-wrap">' +
        bottomItemsHTML +
      '</div>' +
      '<div class="sidebar-promo">' +
        '<p class="sidebar-promo-title">Продолжайте путь</p>' +
        '<p class="sidebar-promo-desc">Дисциплина — это выбор,<br>который вы делаете каждый день.</p>' +
      '</div>' +
    '</div>';

  // ── Build tabbar ────────────────────────────────────────
  var tabbar = document.createElement('nav');
  tabbar.id = 'app-tabbar';
  tabbar.className = 'app-tabbar';

  tabbar.innerHTML = NAV_ITEMS.map(function(item) {
    var shortsCls = item.id === 'shorts' ? ' tabbar-item-shorts' : '';
    return '<a href="' + item.href + '" class="tabbar-item' + shortsCls + (isActive(item.href) ? ' active' : '') + '">' +
      makeTabIcon(item.icon) +
      '<span class="tabbar-label">' + (item.labelShort || item.label) + '</span>' +
      '</a>';
  }).join('');

  // ── Build mobile header ─────────────────────────────────
  var mobileHeader = document.createElement('header');
  mobileHeader.id = 'app-mobile-header';
  mobileHeader.className = 'app-mobile-header';
  function hasProfileIdentity() {
    return !!(window.API && (
      (window.API.isLoggedIn && window.API.isLoggedIn()) ||
      (window.API.hasDeviceIdentity && window.API.hasDeviceIdentity())
    ));
  }

  mobileHeader.innerHTML =
    '<a href="/" class="mobile-header-brand">' +
      '<img src="/assets/webp/logo2-Photoroom.webp" alt="Система" class="mobile-header-logo">' +
    '</a>' +
    '<div class="mobile-header-actions">' +
      '<a href="/account/" class="mobile-profile-dot" aria-label="Профиль"><span class="mobile-profile-avatar"><span class="mobile-avatar-head"></span><span class="mobile-avatar-body"></span></span></a>' +
    '</div>';

  // ── Insert into DOM ─────────────────────────────────────
  document.body.insertBefore(sidebar, document.body.firstChild);
  document.body.insertBefore(mobileHeader, sidebar.nextSibling);
  document.body.appendChild(tabbar);

  /** Футер с отступом под сайдбар (desktop) — только если страница его не содержит; не показываем поверх экранов онбординга */
  (function injectGlobalFooterIfNeeded() {
    if (document.querySelector('footer.footer')) return;
    if (document.body.classList.contains('home-first-run-active')) return;
    var tpl = document.createElement('template');
    tpl.innerHTML = APP_GLOBAL_FOOTER_HTML;
    var footerEl = tpl.content.firstElementChild;
    if (!footerEl || !tabbar.parentNode) return;
    tabbar.parentNode.insertBefore(footerEl, tabbar);
  })();

  try {
    if ((location.pathname === '/' || location.pathname.endsWith('/index.html')) && sessionStorage.getItem(RESTORE_HOME_SCROLL_KEY) === '1') {
      var savedHomeScroll = parseInt(sessionStorage.getItem(HOME_SCROLL_KEY) || '0', 10);
      sessionStorage.removeItem(RESTORE_HOME_SCROLL_KEY);
      if (savedHomeScroll > 0) {
        requestAnimationFrame(function() { window.scrollTo(0, savedHomeScroll); });
        setTimeout(function() { window.scrollTo(0, savedHomeScroll); }, 120);
      }
    }
  } catch (e) {}

  function bindMobileLoginButton() {
    var mobileLoginBtn = document.getElementById('mobile-login-btn');
    if (!mobileLoginBtn) return;
    mobileLoginBtn.addEventListener('click', function() {
      if (window.openAuthModal) window.openAuthModal('login');
      else window.location.href = '/account/';
    });
  }

  function renderMobileAuthAction(loggedIn) {
    var actions = mobileHeader.querySelector('.mobile-header-actions');
    if (!actions) return;
    actions.innerHTML = '<a href="/account/" class="mobile-profile-dot" aria-label="Профиль"><span class="mobile-profile-avatar"><span class="mobile-avatar-head"></span><span class="mobile-avatar-body"></span></span></a>';
    bindMobileLoginButton();
  }

  function hasJwtSession() {
    return !!(window.API && window.API.isLoggedIn && window.API.isLoggedIn());
  }

  bindMobileLoginButton();
  window.addEventListener('auth:change', function(event) {
    renderMobileAuthAction(true);
    accessState = 'unknown';
    if (hasJwtSession() && window.API && window.API.getSubscription) {
      window.API.getSubscription()
        .then(function(data) {
          var expiresAt = data && data.expires_at ? new Date(data.expires_at).getTime() : null;
          accessState = data && data.subscription_active && (!expiresAt || expiresAt > Date.now()) ? 'pro' : 'free';
          updateLessonLocks(document);
        })
        .catch(function() {
          accessState = hasProfileIdentity() ? 'free' : 'guest';
          updateLessonLocks(document);
        });
    }
  });

  var accessState = hasJwtSession() ? 'unknown' : 'free';

  if (window.API && window.API.restoreSession) {
    window.API.restoreSession()
      .then(function(user) {
        if (!user) return;
        renderMobileAuthAction(true);
        window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: user } }));
        if (window.refreshAuthUI) window.refreshAuthUI(user);
      })
      .catch(function() {});
  }

  function getLessonIndex(lesson) {
    if (lesson.dataset.idx != null) return parseInt(lesson.dataset.idx, 10) || 0;
    var siblings = Array.prototype.filter.call(lesson.parentNode ? lesson.parentNode.children : [], function(node) {
      return node.classList && node.classList.contains('lesson-item');
    });
    return Math.max(0, siblings.indexOf(lesson));
  }

  function updateLessonLocks(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('.lesson-item.locked'), function(item) {
      item.classList.remove('locked');
    });
    Array.prototype.forEach.call((root || document).querySelectorAll('.lesson-lock-note'), function(note) {
      note.remove();
    });
  }

  if (hasJwtSession() && window.API) {
    window.API.getSubscription()
      .then(function(data) {
        var expiresAt = data && data.expires_at ? new Date(data.expires_at).getTime() : null;
        accessState = data && data.subscription_active && (!expiresAt || expiresAt > Date.now()) ? 'pro' : 'free';
        updateLessonLocks(document);
      })
      .catch(function() {
        accessState = 'free';
        updateLessonLocks(document);
      });
  } else {
    updateLessonLocks(document);
  }

  window.showAccessPrompt = function(code) {
    if (code === 'LOGIN_REQUIRED') {
      if (window.openAuthModal) window.openAuthModal('login');
      else window.location.href = '/account/';
      return;
    }
    return;
  };

  document.addEventListener('click', function(event) {
    return;
  }, true);

  // ── Hide legacy nav elements ────────────────────────────
  var oldNavbar = document.querySelector('.navbar');
  var oldTabbar = document.querySelector('.glass-tab-bar');
  if (oldNavbar) oldNavbar.style.cssText = 'display:none!important';
  if (oldTabbar) oldTabbar.style.cssText = 'display:none!important';

  // ── Scroll-triggered reveal ─────────────────────────────
  var hasHero = !!(document.querySelector('.hero') || document.querySelector('.profiling-hero'));
  document.body.classList.add(hasHero ? 'has-app-hero' : 'no-app-hero');
  var SCROLL_THRESHOLD = 72; // px from top before nav appears

  function setVisible(visible) {
    var footerVisible = document.body.classList.contains('footer-in-view');
    visible = visible && !footerVisible;
    if (visible) {
      sidebar.classList.add('nav-visible');
      tabbar.classList.add('nav-visible');
      document.body.classList.add('sidebar-active');
    } else {
      sidebar.classList.remove('nav-visible');
      tabbar.classList.remove('nav-visible');
      document.body.classList.remove('sidebar-active');
    }
  }

  if (!hasHero) {
    // Inner pages — show immediately
    setVisible(true);
  } else {
    // Hero pages — appear on scroll, hide when back at top
    var ticking = false;
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(function() {
          setVisible(window.scrollY > SCROLL_THRESHOLD);
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    // Set initial state (e.g. if page reloaded mid-scroll)
    setVisible(window.scrollY > SCROLL_THRESHOLD);
  }

  var footer = document.querySelector('.footer');
  if (footer && 'IntersectionObserver' in window) {
    var footerObserver = new IntersectionObserver(function(entries) {
      var visible = entries.some(function(entry) { return entry.isIntersecting; });
      document.body.classList.toggle('footer-in-view', visible);
      setVisible((!hasHero || window.scrollY > SCROLL_THRESHOLD) && !visible);
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.02 });
    footerObserver.observe(footer);
  }

  // ── Video hardening (no casual download / context menu) ──
  function exitNativeFullscreen(video) {
    try {
      if (video && video.webkitDisplayingFullscreen && video.webkitExitFullscreen) {
        video.webkitExitFullscreen();
      }
    } catch (e) {}
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen();
      }
    } catch (e) {}
  }

  function stopVideo(video) {
    if (!video) return;
    exitNativeFullscreen(video);
    try {
      if (video._hlsInstance && typeof video._hlsInstance.destroy === 'function') {
        video._hlsInstance.destroy();
      }
      video._hlsInstance = null;
    } catch (e) {}
    try { video.pause(); } catch (e) {}
    try { if (video.getAttribute('src')) video.removeAttribute('src'); } catch (e) {}
    try {
      Array.prototype.forEach.call(video.querySelectorAll('source'), function(source) {
        source.removeAttribute('src');
      });
    } catch (e) {}
    try { video.load(); } catch (e) {}
  }

  function stopHiddenVideos() {
    Array.prototype.forEach.call(document.querySelectorAll('video'), function(video) {
      var overlay = video.closest('.player-overlay');
      if (overlay && !overlay.classList.contains('active')) stopVideo(video);
    });
  }

  function protectVideo(video) {
    if (!video || video.dataset.protectedVideo === 'true') return;
    video.dataset.protectedVideo = 'true';
    video.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback');
    video.setAttribute('disablePictureInPicture', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('preload', 'metadata');
    video.setAttribute('x-webkit-airplay', 'deny');
    video.setAttribute('draggable', 'false');
    video.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    video.addEventListener('dragstart', function(e) { e.preventDefault(); });
    video.addEventListener('webkitendfullscreen', function() {
      document.body.classList.remove('video-fullscreen-active');
      stopHiddenVideos();
    });
    video.addEventListener('webkitbeginfullscreen', function() {
      document.body.classList.add('video-fullscreen-active');
    });
  }

  function protectAllVideos(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('video'), protectVideo);
  }

  protectAllVideos(document);

  var videoObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      Array.prototype.forEach.call(mutation.addedNodes || [], function(node) {
        if (!node || node.nodeType !== 1) return;
        if (node.tagName === 'VIDEO') protectVideo(node);
        protectAllVideos(node);
        updateLessonLocks(node);
      });
    });
  });
  videoObserver.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', function(event) {
    var close = event.target.closest('.player-close, [data-close-player]');
    if (!close) return;
    var overlay = close.closest('.player-overlay');
    if (overlay) {
      Array.prototype.forEach.call(overlay.querySelectorAll('video'), stopVideo);
      overlay.classList.remove('active');
      overlay.style.display = 'none';
    }
  }, true);

  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      Array.prototype.forEach.call(document.querySelectorAll('video'), function(video) {
        exitNativeFullscreen(video);
      });
    } else {
      stopHiddenVideos();
    }
  });

  window.addEventListener('pagehide', function() {
    Array.prototype.forEach.call(document.querySelectorAll('video'), stopVideo);
  });

  document.addEventListener('click', function(event) {
    var link = event.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || link.target === '_blank' || link.hasAttribute('download')) return;
    var url;
    try { url = new URL(href, location.href); } catch (e) { return; }
    if (url.origin !== location.origin || url.href === location.href) return;
    try {
      if (location.pathname === '/' || location.pathname.endsWith('/index.html')) {
        sessionStorage.setItem(HOME_SCROLL_KEY, String(window.scrollY || 0));
      }
      if (link.classList.contains('back-link-glass') && url.pathname === '/') {
        sessionStorage.setItem(RESTORE_HOME_SCROLL_KEY, '1');
      }
    } catch (e) {}
    Array.prototype.forEach.call(document.querySelectorAll('video'), stopVideo);
  }, true);

  var prefetchedLinks = {};
  function prefetchInternalLink(link) {
    if (!link || !('requestIdleCallback' in window || 'fetch' in window)) return;
    var href = link.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || link.target === '_blank' || link.hasAttribute('download')) return;

    var url;
    try { url = new URL(href, location.href); } catch (e) { return; }
    if (url.origin !== location.origin || url.pathname === location.pathname) return;

    var key = url.pathname + url.search;
    if (prefetchedLinks[key]) return;
    prefetchedLinks[key] = true;

    var run = function() {
      fetch(url.href, { credentials: 'same-origin', cache: 'force-cache' }).catch(function() {});
      var meta = COURSE_PREFETCH[url.pathname];
      if (meta && meta.image) {
        var img = new Image();
        img.decoding = 'async';
        img.src = meta.image;
      }
      if (meta && meta.api && window.API && window.API.request) {
        window.API.request('GET', meta.api).catch(function() {});
      }
    };
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1200 });
    else setTimeout(run, 120);
  }

  document.addEventListener('pointerover', function(event) {
    prefetchInternalLink(event.target.closest('a[href]'));
  }, { passive: true });

  document.addEventListener('touchstart', function(event) {
    prefetchInternalLink(event.target.closest('a[href]'));
  }, { passive: true });

  window.setupVideoPreview = function(container, options) {
    if (!container || container.dataset.previewReady === 'true') return null;
    var video = container.querySelector('video');
    if (!video) return null;

    options = options || {};
    container.dataset.previewReady = 'true';
    if (options.audioPoster || options.poster) container.dataset.audioPoster = options.audioPoster || options.poster;
    if (/-prew\.webp(?:$|\?)/.test(options.poster || '')) container.classList.add('video-text-preview-container');
    video.removeAttribute('controls');
    video.setAttribute('preload', 'none');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    if (options.audioSlug && window.prepareAudioMode) {
      window.prepareAudioMode(container, options.audioSlug);
    }

    if (
      !options.disableMediaModeSwitch &&
      (!container.previousElementSibling || !container.previousElementSibling.matches('.media-mode-switch'))
    ) {
      var modeSwitch = document.createElement('div');
      modeSwitch.className = 'media-mode-switch media-mode-switch-preview';
      modeSwitch.innerHTML =
        '<button type="button" class="active" data-preview-mode="video">Видео</button>' +
        '<button type="button" data-preview-mode="audio">Аудио</button>';
      container.insertAdjacentElement('beforebegin', modeSwitch);
      modeSwitch.addEventListener('click', function(event) {
        var button = event.target.closest('[data-preview-mode]');
        if (!button) return;
        modeSwitch.querySelectorAll('[data-preview-mode]').forEach(function(item) {
          item.classList.toggle('active', item === button);
        });
        if (button.dataset.previewMode !== 'audio') return;
        start();
        var attempts = 0;
        var timer = setInterval(function() {
          attempts += 1;
          if (video._audioMode) {
            clearInterval(timer);
            video._audioMode.setMode('audio');
          } else if (attempts > 40) {
            clearInterval(timer);
          }
        }, 100);
      });
    }

    function isAppleTouchVideoDevice() {
      var ua = navigator.userAgent || '';
      var platform = navigator.platform || '';
      return /iPad|iPhone|iPod/i.test(ua) ||
        (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    var preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'video-preview-overlay';
    preview.setAttribute('aria-label', 'Смотреть видео');
    if (options.poster) preview.style.backgroundImage = "url('" + options.poster + "')";
    preview.innerHTML =
      '<span class="video-preview-action" aria-hidden="true">' +
        '<span class="video-preview-icon"></span>' +
        '<span class="video-preview-status">' +
          '<span class="video-preview-ring"></span>' +
          '<span>Загрузка</span>' +
        '</span>' +
      '</span>';

    container.appendChild(preview);

    var loadStarted = false;
    function start() {
      if (loadStarted) return;
      loadStarted = true;
      preview.classList.add('loading');

      var started = typeof options.onStart === 'function'
        ? options.onStart(video, preview)
        : null;

      Promise.resolve(started).then(function() {
        preview.classList.remove('loading');
        preview.classList.add('hidden');
        video.setAttribute('controls', '');

        var playPromise = video.play ? video.play() : null;
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise
            .then(function() {})
            .catch(function() {
              if (isAppleTouchVideoDevice() && (video.currentSrc || video.getAttribute('src'))) {
                video.setAttribute('controls', '');
                preview.classList.add('hidden');
                return;
              }
              preview.classList.remove('hidden');
              preview.classList.remove('loading');
              loadStarted = false;
            });
        } else {
          preview.classList.add('hidden');
        }
      }).catch(function() {
        preview.classList.remove('hidden');
        preview.classList.remove('loading');
        loadStarted = false;
      });
    }

    preview.addEventListener('click', start);
    video.addEventListener('play', start, { once: true });
    return { start: start, preview: preview, video: video };
  };

  // Mobile UX: after selecting a lesson below the player, return to the player.
  document.addEventListener('click', function(event) {
    var videoTap = event.target.closest('.video-container video, .single-video-wrap video, .player-video-wrap video');
    var videoShellTap = event.target.closest('.video-container, .single-video-wrap, .player-video-wrap');
    if (!videoTap && videoShellTap) videoTap = videoShellTap.querySelector('video');
    if (videoTap && window.innerWidth <= 768) {
      videoTap.setAttribute('controls', '');
      return;
    }

    var lesson = event.target.closest('.lesson-item');
    if (!lesson || window.innerWidth > 768) return;

    var scope = lesson.closest('.course-layout') || document;
    var player = scope.querySelector('.video-container, .single-video-wrap, .player-video-wrap');
    if (!player) player = document.querySelector('.video-container, .single-video-wrap, .player-video-wrap');
    if (!player) return;

    function scrollToPlayer() {
      var headerOffset = 170;
      var top = player.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }

    setTimeout(scrollToPlayer, 80);
    setTimeout(scrollToPlayer, 360);
  });

  function updateMobileScrollState() {
    if (window.innerWidth <= 768 && window.scrollY > 80) {
      document.body.classList.add('mobile-scrolled');
    } else {
      document.body.classList.remove('mobile-scrolled');
    }
  }

  window.addEventListener('scroll', updateMobileScrollState, { passive: true });
  window.addEventListener('resize', updateMobileScrollState);
  updateMobileScrollState();
})();
