/**
 * nav.js — Global navigation (sidebar + tabbar)
 * Injected into every page. Handles scroll-triggered reveal via GPU transform only.
 */
(function initNav() {
  // ── Inject CSS ─────────────────────────────────────────
  if (!document.querySelector('link[href*="nav.css"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/nav.css?v=33';
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

  // ── Nav items config ────────────────────────────────────
  var NAV_ITEMS = [
    {
      id: 'home',
      href: '/',
      label: 'Главная',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>'
    },
    {
      id: 'feed',
      href: '/feed/',
      label: 'Лента',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16M4 9h10M4 13h16M4 17h10"/></svg>'
    },
    {
      id: 'shorts',
      href: '/shorts/',
      label: 'Shorts',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="3"/><path d="M10 8l6 4-6 4V8z"/></svg>'
    },
    {
      id: 'ai',
      href: '/ai/',
      label: 'AI-помощник',
      labelShort: 'AI',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z"/><path d="M19 16l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" opacity=".5"/></svg>'
    }
  ];

  var BOTTOM_ITEMS = [
    {
      id: 'profile',
      href: '/account/',
      label: 'Профиль',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>'
    }
  ];

  var ALL_ITEMS = NAV_ITEMS.concat(BOTTOM_ITEMS);
  var HOME_SCROLL_KEY = 'sistema:home-scroll-y';
  var RESTORE_HOME_SCROLL_KEY = 'sistema:restore-home-scroll';
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
    return currentPath === href || currentPath.endsWith(href.replace(/^\/|\/$/g, '') + '.html');
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
      bottomItemsHTML +
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
    return '<a href="' + item.href + '" class="tabbar-item' + (isActive(item.href) ? ' active' : '') + '">' +
      makeTabIcon(item.icon) +
      '<span class="tabbar-label">' + (item.labelShort || item.label) + '</span>' +
      '</a>';
  }).join('');

  // ── Build mobile header ─────────────────────────────────
  var mobileHeader = document.createElement('header');
  mobileHeader.id = 'app-mobile-header';
  mobileHeader.className = 'app-mobile-header';
  var isLoggedIn = !!(window.API && window.API.isLoggedIn && window.API.isLoggedIn());

  mobileHeader.innerHTML =
    '<a href="/" class="mobile-header-brand">' +
      '<img src="/assets/webp/logo2-Photoroom.webp" alt="Система" class="mobile-header-logo">' +
    '</a>' +
    '<div class="mobile-header-actions">' +
      (isLoggedIn
        ? '<a href="/account/" class="mobile-profile-dot" aria-label="Профиль"><span class="mobile-profile-avatar"><span class="mobile-avatar-head"></span><span class="mobile-avatar-body"></span></span></a>'
        : '<button type="button" class="mobile-login-btn" id="mobile-login-btn">Войти</button>') +
    '</div>';

  // ── Insert into DOM ─────────────────────────────────────
  document.body.insertBefore(sidebar, document.body.firstChild);
  document.body.insertBefore(mobileHeader, sidebar.nextSibling);
  document.body.appendChild(tabbar);

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

  var mobileLoginBtn = document.getElementById('mobile-login-btn');
  if (mobileLoginBtn) {
    mobileLoginBtn.addEventListener('click', function() {
      if (window.openAuthModal) window.openAuthModal('login');
      else window.location.href = '/account/';
    });
  }

  var accessState = isLoggedIn ? 'unknown' : 'guest';

  function getLessonIndex(lesson) {
    if (lesson.dataset.idx != null) return parseInt(lesson.dataset.idx, 10) || 0;
    var siblings = Array.prototype.filter.call(lesson.parentNode ? lesson.parentNode.children : [], function(node) {
      return node.classList && node.classList.contains('lesson-item');
    });
    return Math.max(0, siblings.indexOf(lesson));
  }

  function updateLessonLocks(root) {
    if (accessState === 'unknown') return;
    Array.prototype.forEach.call((root || document).querySelectorAll('.lesson-item'), function(item) {
      var idx = getLessonIndex(item);
      var locked = accessState !== 'pro' && idx > 0;
      item.classList.toggle('locked', locked);
      if (!locked) {
        Array.prototype.forEach.call(item.querySelectorAll('.lesson-lock-note'), function(note) {
          note.remove();
        });
      }
      if (locked && !item.querySelector('.lesson-lock-note')) {
        var info = item.querySelector('.lesson-info') || item;
        var note = document.createElement('div');
        note.className = 'lesson-lock-note';
        note.textContent = 'Система Pro';
        info.appendChild(note);
      }
    });
  }

  if (isLoggedIn && window.API) {
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
    if (document.getElementById('access-prompt')) return;
    var overlay = document.createElement('div');
    overlay.id = 'access-prompt';
    overlay.className = 'access-prompt';
    overlay.innerHTML =
      '<div class="access-prompt-card">' +
        '<button class="access-prompt-close" type="button" aria-label="Закрыть">×</button>' +
        '<div class="access-prompt-kicker">Система Pro</div>' +
        '<h3>Урок доступен по подписке</h3>' +
        '<p>В Pro открывается весь видеоконтент, закрытый Telegram и 50 сообщений с AI.</p>' +
        '<button class="access-prompt-primary" type="button">Оформить Pro</button>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('.access-prompt-close').addEventListener('click', function() {
      overlay.remove();
    });
    overlay.addEventListener('click', function(event) {
      if (event.target === overlay) overlay.remove();
    });
    overlay.querySelector('.access-prompt-primary').addEventListener('click', function() {
      window.location.href = '/subscription/';
    });
  };

  document.addEventListener('click', function(event) {
    var lesson = event.target.closest('.lesson-item');
    if (!lesson || accessState === 'pro' || accessState === 'unknown') return;
    if (getLessonIndex(lesson) === 0) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.showAccessPrompt(accessState === 'guest' ? 'LOGIN_REQUIRED' : 'NO_SUBSCRIPTION');
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
    video.removeAttribute('controls');
    video.setAttribute('preload', 'none');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

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
      '<span class="video-preview-play" aria-hidden="true"></span>';

    container.appendChild(preview);

    var loadStarted = false;
    function start() {
      if (loadStarted) return;
      loadStarted = true;
      preview.classList.add('hidden');

      var started = typeof options.onStart === 'function'
        ? options.onStart(video, preview)
        : null;

      Promise.resolve(started).then(function() {
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
              loadStarted = false;
            });
        } else {
          preview.classList.add('hidden');
        }
      }).catch(function() {
        preview.classList.remove('hidden');
        loadStarted = false;
      });
    }

    preview.addEventListener('click', start);
    video.addEventListener('play', start, { once: true });
    return { start: start, preview: preview, video: video };
  };

  function isAppleTouchVideoDevice() {
    var ua = navigator.userAgent || '';
    var platform = navigator.platform || '';
    return /iPad|iPhone|iPod/i.test(ua) ||
      (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function toggleMobileVideo(video) {
    if (!video || window.innerWidth > 768 || isAppleTouchVideoDevice()) return false;
    video.setAttribute('controls', '');
    if (video.readyState > 0 && video.currentSrc) {
      if (video.paused) {
        var playAttempt = video.play && video.play();
        if (playAttempt && typeof playAttempt.catch === 'function') playAttempt.catch(function() {});
      } else {
        video.pause();
      }
      return true;
    }
    return false;
  }

  document.addEventListener('pointerup', function(event) {
    var shell = event.target.closest('.video-container, .single-video-wrap, .player-video-wrap');
    if (!shell || event.target.closest('.video-preview-overlay, button, a')) return;
    if (toggleMobileVideo(shell.querySelector('video'))) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  document.addEventListener('touchend', function(event) {
    var shell = event.target.closest('.video-container, .single-video-wrap, .player-video-wrap');
    if (!shell || event.target.closest('.video-preview-overlay, button, a')) return;
    if (toggleMobileVideo(shell.querySelector('video'))) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, { capture: true, passive: false });

  // Mobile UX: after selecting a lesson below the player, return to the player.
  document.addEventListener('click', function(event) {
    var videoTap = event.target.closest('.video-container video, .single-video-wrap video, .player-video-wrap video');
    var videoShellTap = event.target.closest('.video-container, .single-video-wrap, .player-video-wrap');
    if (!videoTap && videoShellTap) videoTap = videoShellTap.querySelector('video');
    if (videoTap && window.innerWidth <= 768) {
      toggleMobileVideo(videoTap);
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
