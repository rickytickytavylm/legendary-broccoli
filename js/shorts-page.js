/**
 * Shorts: превью из /data/shorts.json; видео — GET /api/video/shorts-mp4?slug=…
 * Совместимость с iOS: без «ложного» тапа по первой карточке после входа через таб,
 * принудительный cache-bust у плеера, canplay как запасное к loadeddata.
 * По окончании ролика — автоматически открывается следующий («рейл», как короткие видео).
 * Свайпы вверх/вниз по области плеера (и подписи) — предыдущий / следующий; при малом числе роликов просто циклично.
 */
(function initShortsPage() {
  var shortsItems = [];
  var playingIndex = 0;
  var root = document.getElementById('shorts-grid');
  var overlay = document.getElementById('shorts-player-overlay');
  var videoEl = document.getElementById('shorts-player-video');
  var closeBtn = overlay && overlay.querySelector('[data-shorts-player-close]');
  var titleEl = document.getElementById('shorts-player-title');
  var spinnerEl = document.getElementById('shorts-player-spinner');
  var posterEl = document.getElementById('shorts-player-poster');
  var toastEl = document.getElementById('shorts-toast');
  var stageEl = document.getElementById('shorts-player-stage');
  var toastTimer;
  /** @type {{ settle: Function | null, onErr: Function | null, onEnded: Function | null }} */
  var vidListeners = { settle: null, onErr: null, onEnded: null };
  /** @type {ReturnType<typeof setTimeout> | null} */
  var loadKickTimer = null;
  /** Свайпы: верх конца относительно начала точки (~ «ввод снизу») → следующий */
  var swipeX0 = 0;
  var swipeY0 = 0;
  var swipeT0 = 0;
  var swipeTracked = false;
  /** Колёсо трекпада: не триггерить пачкой кадров */
  var wheelStepLockUntil = 0;

  if (!root) return;

  /* Блокируем клики по сетке ~0.45s после монтирования — снимает «ghost tap» с таб-бара на iOS */
  document.documentElement.classList.add('shorts-input-cooldown');
  window.setTimeout(function () {
    document.documentElement.classList.remove('shorts-input-cooldown');
  }, 460);

  function showToast(msg, ms) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('shorts-toast--visible');
    toastEl.setAttribute('role', 'alert');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove('shorts-toast--visible');
    }, ms || 4800);
  }

  function clearLoadKickTimer() {
    if (loadKickTimer) {
      window.clearTimeout(loadKickTimer);
      loadKickTimer = null;
    }
  }

  function detachLoadListenersOnly() {
    if (!videoEl) return;
    clearLoadKickTimer();
    if (vidListeners.settle) {
      videoEl.removeEventListener('loadeddata', vidListeners.settle);
      videoEl.removeEventListener('canplay', vidListeners.settle);
      vidListeners.settle = null;
    }
    if (vidListeners.onErr) {
      videoEl.removeEventListener('error', vidListeners.onErr);
      vidListeners.onErr = null;
    }
  }

  function detachVideoListeners() {
    detachLoadListenersOnly();
    if (videoEl && vidListeners.onEnded) {
      videoEl.removeEventListener('ended', vidListeners.onEnded);
      vidListeners.onEnded = null;
    }
  }

  function setStageBusy(isBusy, posterHref) {
    if (spinnerEl) spinnerEl.classList.toggle('is-visible', !!isBusy);
    if (posterEl) {
      posterEl.classList.toggle('is-visible', !!(isBusy && posterHref));
      if (posterHref) posterEl.src = posterHref;
    }
  }

  function shortsStreamUrl(slug) {
    var base = (window.API && window.API.base ? String(window.API.base) : '').replace(/\/?$/u, '');
    if (!base) return '';
    var url = base + '/video/shorts-mp4?slug=' + encodeURIComponent(slug);
    if (window.API && window.API.accessToken) {
      url += '&auth=' + encodeURIComponent(window.API.accessToken);
    }
    return url;
  }

  /**
   * @param {number} delta +1 следующий шорт по списку, -1 предыдущий (по кругу)
   */
  function jumpShortBy(delta) {
    if (!overlay || overlay.classList.contains('u-hidden')) return;
    if (!shortsItems.length) return;

    var n = shortsItems.length;
    playingIndex = ((playingIndex + delta) % n + n) % n;
    var item = shortsItems[playingIndex];
    if (!item) return;

    var slug = item.slug;
    var url = playbackUrlFor(item, slug);
    if (!url) {
      showToast('Не удалось открыть ролик.', 3200);
      return;
    }
    var poster = item.poster ? String(item.poster) : '';
    openPlayerWithUrl(url, item.caption || '', poster, true);
  }

  function playbackUrlFor(item, slug) {
    var raw = item && item.playUrl ? String(item.playUrl).trim() : '';
    if (raw) {
      if (/^https?:\/\//i.test(raw)) return raw;
      var path = raw.charAt(0) === '/' ? raw : '/' + raw;
      try {
        return new URL(path, location.href).href;
      } catch (e) {
        return raw;
      }
    }
    return shortsStreamUrl(slug);
  }

  /**
   * Свежий <video>: на iOS Safari повторное назначение src после reset/load часто зависает
   * («второе видео не грузится»). Проще пересмонтировать узел после закрытия плеера.
   */
  function remountFreshVideo() {
    if (!stageEl) return;
    detachVideoListeners();
    try {
      if (videoEl) videoEl.pause();
    } catch (ignore) {}
    var neu = document.createElement('video');
    neu.id = 'shorts-player-video';
    neu.controls = true;
    neu.setAttribute('playsinline', '');
    neu.setAttribute('webkit-playsinline', '');
    neu.preload = 'auto';
    neu.setAttribute('crossorigin', 'anonymous');
    neu.muted = false; // Start unmuted for premium user-initiated sound experience!

    // Toggle play/pause on direct video click/tap (classic TikTok / Shorts behavior)
    neu.addEventListener('click', function(ev) {
      if (neu.paused) {
        neu.play().catch(function() {});
      } else {
        neu.pause();
      }
    });

    var oldEl = stageEl.querySelector('#shorts-player-video');
    if (oldEl && oldEl.parentNode === stageEl) {
      stageEl.replaceChild(neu, oldEl);
    } else {
      stageEl.appendChild(neu);
    }
    videoEl = neu;
  }

  function hidePlayer() {
    if (!overlay || !stageEl) return;
    var ae = document.activeElement;
    if (ae && overlay.contains(ae)) {
      try {
        ae.blur();
      } catch (ignore) {}
    }
    remountFreshVideo();
    overlay.classList.add('u-hidden');
    overlay.setAttribute('aria-hidden', 'true');
    if (titleEl) titleEl.textContent = '';
    document.body.classList.remove('shorts-player-open');
    setStageBusy(false, '');
    if (posterEl) {
      posterEl.removeAttribute('src');
      posterEl.classList.remove('is-visible');
    }
  }

  /**
   * @param {string} url
   * @param {string} title
   * @param {string} posterHref
   * @param {boolean} [reuseOverlay] уже открыт — только смена трека (автоплей следующего)
   */
  function openPlayerWithUrl(url, title, posterHref, reuseOverlay) {
    if (!overlay || !stageEl || !url) return;

    if (titleEl) titleEl.textContent = title || '';
    if (!reuseOverlay) {
      overlay.classList.remove('u-hidden');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('shorts-player-open');
    }

    setStageBusy(true, posterHref || '');
    remountFreshVideo();
    if (!videoEl) return;

    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    var playUrl = url + sep + '__ts=' + Date.now();

    /** @type {boolean} */
    var settled = false;

    function tryPlay() {
      var p = videoEl.play ? videoEl.play() : null;
      if (p && typeof p.then === 'function') {
        p.catch(function () {
          // If unmuted playback is blocked, fallback to muted play and prompt user to unmute!
          videoEl.muted = true;
          videoEl.play().catch(function() {});
          showToast('Нажмите на экран, чтобы включить звук', 2800);
        });
      }
    }

    function settle() {
      if (settled) return;
      settled = true;
      clearLoadKickTimer();
      detachLoadListenersOnly();
      setStageBusy(false, '');
      if (posterEl) posterEl.classList.remove('is-visible');
      tryPlay();
    }

    vidListeners.settle = function () {
      settle();
    };

    vidListeners.onErr = function () {
      clearLoadKickTimer();
      detachVideoListeners();
      setStageBusy(false, '');
      hidePlayer();
      showToast('Не удалось открыть видео. Обновите страницу или попробуйте через минуту.', 5500);
    };

    if (shortsItems.length >= 2) {
      vidListeners.onEnded = function () {
        if (!overlay || overlay.classList.contains('u-hidden')) return;
        jumpShortBy(1);
      };
      videoEl.addEventListener('ended', vidListeners.onEnded);
    }

    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');
    videoEl.preload = 'auto';
    videoEl.setAttribute('crossorigin', 'anonymous');
    videoEl.muted = false; // Start unmuted!

    videoEl.addEventListener('loadeddata', vidListeners.settle);
    videoEl.addEventListener('canplay', vidListeners.settle);
    videoEl.addEventListener('error', vidListeners.onErr);

    loadKickTimer = window.setTimeout(function () {
      if (settled) return;
      if (videoEl.readyState >= 2) settle();
    }, 1400);

    videoEl.src = playUrl;
    try {
      videoEl.load();
      tryPlay();
    } catch (e) {}
  }

  async function playShort(cardBtn, itemIndex, slug, caption, item) {
    if (document.documentElement.classList.contains('shorts-input-cooldown')) return;
    if (cardBtn.classList.contains('short-card--busy')) return;

    if (!window.API || !window.API.base) {
      showToast('Нет подключения к API. Обновите страницу или проверьте настройки.', 5200);
      return;
    }

    var url = playbackUrlFor(item, slug);
    if (!url) {
      showToast('Некорректная ссылка на ролик.', 4000);
      return;
    }

    playingIndex = typeof itemIndex === 'number' && itemIndex >= 0 ? itemIndex : 0;
    var poster = item && item.poster ? String(item.poster) : '';
    cardBtn.classList.add('short-card--busy');

    try {
      await window.API.restoreSession().catch(() => null);
      var sub = await window.API.getSubscription().catch(() => null);
      var isPro = sub && sub.subscription_active && (!sub.expires_at || new Date(sub.expires_at).getTime() > Date.now());

      if (!isPro) {
        if (typeof window.openSubscriptionModalForAccess === 'function') {
          window.openSubscriptionModalForAccess();
        } else if (window.showAccessPrompt) {
          window.showAccessPrompt('NO_SUBSCRIPTION');
        } else {
          window.location.href = '/subscription/';
        }
        cardBtn.classList.remove('short-card--busy');
        return;
      }
    } catch (e) {
      if (typeof window.openSubscriptionModalForAccess === 'function') {
        window.openSubscriptionModalForAccess();
      } else {
        window.location.href = '/subscription/';
      }
      cardBtn.classList.remove('short-card--busy');
      return;
    }

    openPlayerWithUrl(url, caption || '', poster, false);
    cardBtn.classList.remove('short-card--busy');
  }

  function render(items) {
    shortsItems = Array.isArray(items) ? items : [];
    root.textContent = '';
    shortsItems.forEach(function (item, itemIndex) {
      var slug = item.slug;
      var cap = item.caption || '';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'short-card ' + String(item.aspectClass || 'short-card--9x16');

      var posterWrap = document.createElement('span');
      posterWrap.className = 'short-card__poster';

      var img = document.createElement('img');
      img.src = item.poster || '';
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';

      var ov = document.createElement('span');
      ov.className = 'short-card__overlay';
      var play = document.createElement('span');
      play.className = 'short-card__play';
      play.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.14v14.72a1 1 0 001.5.86l11-7.36a1 1 0 000-1.72l-11-7.36A1 1 0 008 5.14z"/></svg>';
      ov.appendChild(play);

      var dur = document.createElement('span');
      dur.className = 'short-card__duration';
      dur.textContent = item.durationLabel || '';

      posterWrap.appendChild(img);
      posterWrap.appendChild(ov);
      posterWrap.appendChild(dur);

      var capWrap = document.createElement('span');
      capWrap.className = 'short-card__caption';
      var span = document.createElement('span');
      span.textContent = cap;
      capWrap.appendChild(span);

      btn.appendChild(posterWrap);
      btn.appendChild(capWrap);

      btn.addEventListener('click', function () {
        playShort(btn, itemIndex, slug, cap, item);
      });

      root.appendChild(btn);
    });
  }

  fetch('/data/shorts.json', { credentials: 'same-origin' })
    .then(function (r) {
      if (!r.ok) throw new Error('shorts json');
      return r.json();
    })
    .then(function (items) {
      render(items);
      root.setAttribute('aria-busy', 'false');
    })
    .catch(function () {
      root.setAttribute('aria-busy', 'false');
      root.innerHTML = '<p class="shorts-page-error">Не удалось загрузить список роликов.</p>';
      showToast('Список shorts не загрузился.', 5000);
    });

  function attachSwipeGestures(el) {
    if (!el) return;

    el.addEventListener(
      'touchstart',
      function (ev) {
        if (!overlay || overlay.classList.contains('u-hidden')) return;
        if (shortsItems.length < 2) return;
        if (ev.touches.length !== 1) return;
        /* Не захватывать жест, начатый у крестика закрытия */
        var t = ev.target;
        if (t.closest && (t.closest('[data-shorts-player-close]') || t.closest('.shorts-player-dismiss')))
          return;
        swipeTracked = true;
        swipeX0 = ev.touches[0].clientX;
        swipeY0 = ev.touches[0].clientY;
        swipeT0 = Date.now();
      },
      { passive: true }
    );

    el.addEventListener(
      'touchend',
      function (ev) {
        if (!swipeTracked || !overlay || overlay.classList.contains('u-hidden')) {
          swipeTracked = false;
          return;
        }
        swipeTracked = false;
        if (shortsItems.length < 2) return;

        var t = ev.changedTouches[0];
        var dx = t.clientX - swipeX0;
        var dy = t.clientY - swipeY0;
        var elapsed = Date.now() - swipeT0;
        /** Порог + явное доминирование вертикали: реже конфликт с тапом по контролам видео */
        var minPx = 56;
        var vertRatio = 1.38;
        if (elapsed > 950) return;
        if (Math.abs(dy) < minPx) return;
        if (Math.abs(dy) < Math.abs(dx) * vertRatio) return;

        if (dy < 0) jumpShortBy(1);
        else jumpShortBy(-1);
      },
      { passive: true }
    );

    el.addEventListener(
      'touchcancel',
      function () {
        swipeTracked = false;
      },
      { passive: true }
    );

    el.addEventListener(
      'wheel',
      function (ev) {
        if (!overlay || overlay.classList.contains('u-hidden')) return;
        if (shortsItems.length < 2) return;

        var now = Date.now();
        if (now < wheelStepLockUntil) return;
        if (Math.abs(ev.deltaY) < 48) return;

        wheelStepLockUntil = now + 720;
        if (ev.deltaY > 0) jumpShortBy(1);
        else jumpShortBy(-1);
      },
      { passive: true }
    );
  }

  /* Жест по полноэкранному оверлею: сцена видео + подпись; не шапка с крестиком */
  attachSwipeGestures(overlay);

  if (closeBtn)
    closeBtn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      hidePlayer();
    });
  if (overlay) {
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) hidePlayer();
    });
  }

  document.addEventListener('keydown', function (ev) {
    if (!overlay || overlay.classList.contains('u-hidden')) return;
    if (ev.key === 'Escape') {
      hidePlayer();
      return;
    }
    if (shortsItems.length < 2) return;

    var k = ev.key;
    if (ev.repeat) return;
    if (k === 'ArrowDown' || k === 'PageDown') {
      ev.preventDefault();
      jumpShortBy(1);
    } else if (k === 'ArrowUp' || k === 'PageUp') {
      ev.preventDefault();
      jumpShortBy(-1);
    }
  });

  // ── Description Bottom Sheet Modal Logic ──────────────────
  var descModal = document.getElementById('shorts-desc-modal');
  var descModalText = document.getElementById('shorts-desc-modal-text');

  function openDescModal() {
    if (!descModal || !descModalText || !titleEl) return;
    var currentItem = shortsItems[playingIndex];
    if (currentItem && currentItem.caption) {
      descModalText.textContent = currentItem.caption;
      descModal.classList.remove('u-hidden');
      descModal.setAttribute('aria-hidden', 'false');
    }
  }

  function closeDescModal() {
    if (!descModal) return;
    descModal.classList.add('u-hidden');
    descModal.setAttribute('aria-hidden', 'true');
  }

  if (titleEl) {
    titleEl.addEventListener('click', function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      openDescModal();
    });
  }

  // Bind close buttons/backdrops using event delegation / loop
  var closeTriggers = document.querySelectorAll('[data-shorts-desc-close]');
  if (closeTriggers) {
    closeTriggers.forEach(function(trigger) {
      trigger.addEventListener('click', function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        closeDescModal();
      });
    });
  }
})();
