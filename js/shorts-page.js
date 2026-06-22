/**
 * Shorts: превью из /data/shorts.json; видео — presigned URL из YOS (/api/video/presign), fallback — proxy
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
  var playerLikeBtn = document.getElementById('shorts-player-like');
  var spinnerEl = document.getElementById('shorts-player-spinner');
  var posterEl = document.getElementById('shorts-player-poster');
  var toastEl = document.getElementById('shorts-toast');
  var stageEl = document.getElementById('shorts-player-stage');
  var centerControlEl = document.getElementById('shorts-player-center-control');
  var progressEl = document.getElementById('shorts-player-progress');
  var progressBarEl = document.getElementById('shorts-player-progress-bar');
  var toastTimer;
  var controlHideTimer = null;
  var preloadVideoEl = null;
  var preloadUrl = '';
  /** @type {{ settle: Function | null, onErr: Function | null, onEnded: Function | null, onTime: Function | null, onPlayState: Function | null }} */
  var vidListeners = { settle: null, onErr: null, onEnded: null, onTime: null, onPlayState: null };
  /** @type {ReturnType<typeof setTimeout> | null} */
  var loadKickTimer = null;
  /** Свайпы: верх конца относительно начала точки (~ «ввод снизу») → следующий */
  var swipeX0 = 0;
  var swipeY0 = 0;
  var swipeT0 = 0;
  var swipeTracked = false;
  var lastSwipeAt = 0;
  /** Колёсо трекпада: не триггерить пачкой кадров */
  var wheelStepLockUntil = 0;
  var playbackAttemptTimer = null;
  var progressSeeking = false;
  var currentLikeSlug = '';
  /** @type {Record<string, { url: string, expiresAt: number }>} */
  var presignCache = Object.create(null);

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

  function shortLikeBase(slug) {
    var value = String(slug || 'short');
    var hash = 0;
    for (var i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return 203 + (hash % 270);
  }

  function shortLikeKey(slug) {
    return 'sistema:short-liked:' + String(slug || '');
  }

  function isShortLiked(slug) {
    try {
      return localStorage.getItem(shortLikeKey(slug)) === '1';
    } catch (e) {
      return false;
    }
  }

  function setShortLiked(slug, liked) {
    try {
      if (liked) localStorage.setItem(shortLikeKey(slug), '1');
      else localStorage.removeItem(shortLikeKey(slug));
    } catch (e) {}
  }

  function shortLikeCount(slug) {
    return shortLikeBase(slug) + (isShortLiked(slug) ? 1 : 0);
  }

  function updateLikeViews(slug) {
    if (!slug) return;
    var liked = isShortLiked(slug);
    document.querySelectorAll('[data-short-like]').forEach(function (node) {
      if (node.dataset.shortLike !== String(slug)) return;
      node.classList.toggle('is-liked', liked);
      node.setAttribute('aria-pressed', liked ? 'true' : 'false');
      var count = node.querySelector('[data-short-like-count]');
      if (count) count.textContent = String(shortLikeCount(slug));
    });
    if (playerLikeBtn && currentLikeSlug === slug) {
      playerLikeBtn.classList.toggle('is-liked', liked);
      playerLikeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');
      var playerCount = playerLikeBtn.querySelector('[data-shorts-player-like-count]');
      if (playerCount) playerCount.textContent = String(shortLikeCount(slug));
    }
  }

  function toggleShortLike(slug) {
    if (!slug) return;
    setShortLiked(slug, !isShortLiked(slug));
    updateLikeViews(slug);
  }

  function setPlayerLikeSlug(slug) {
    currentLikeSlug = String(slug || '');
    if (playerLikeBtn) {
      playerLikeBtn.hidden = !currentLikeSlug;
      playerLikeBtn.dataset.shortLike = currentLikeSlug;
    }
    updateLikeViews(currentLikeSlug);
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
      videoEl.removeEventListener('loadedmetadata', vidListeners.settle);
      videoEl.removeEventListener('canplay', vidListeners.settle);
      vidListeners.settle = null;
    }
    if (vidListeners.onErr) {
      videoEl.removeEventListener('error', vidListeners.onErr);
      vidListeners.onErr = null;
    }
  }

  function detachVideoListeners() {
    if (playbackAttemptTimer) {
      window.clearTimeout(playbackAttemptTimer);
      playbackAttemptTimer = null;
    }
    detachLoadListenersOnly();
    if (videoEl && vidListeners.onEnded) {
      videoEl.removeEventListener('ended', vidListeners.onEnded);
      vidListeners.onEnded = null;
    }
    if (videoEl && vidListeners.onTime) {
      videoEl.removeEventListener('timeupdate', vidListeners.onTime);
      videoEl.removeEventListener('durationchange', vidListeners.onTime);
      vidListeners.onTime = null;
    }
    if (videoEl && vidListeners.onPlayState) {
      videoEl.removeEventListener('play', vidListeners.onPlayState);
      videoEl.removeEventListener('pause', vidListeners.onPlayState);
      vidListeners.onPlayState = null;
    }
  }

  function setStageBusy(isBusy, posterHref) {
    if (spinnerEl) spinnerEl.classList.toggle('is-visible', !!isBusy);
    if (posterEl) {
      posterEl.classList.toggle('is-visible', !!(isBusy && posterHref));
      if (posterHref) posterEl.src = posterHref;
    }
  }

  function clearNextPreload() {
    if (!preloadVideoEl) return;
    try {
      preloadVideoEl.removeAttribute('src');
      preloadVideoEl.load();
    } catch (ignore) {}
    preloadVideoEl = null;
    preloadUrl = '';
  }

  function preloadNextShort() {
    if (!shortsItems || shortsItems.length < 2 || !overlay || overlay.classList.contains('u-hidden')) {
      clearNextPreload();
      return;
    }
    var n = shortsItems.length;
    var item = shortsItems[((playingIndex + 1) % n + n) % n];
    if (!item) return;

    resolvePlaybackUrl(item, item.slug).then(function (url) {
      if (!url || !overlay || overlay.classList.contains('u-hidden')) return;
      var sep = url.indexOf('?') >= 0 ? '&' : '?';
      var nextUrl = url + sep + '__preload=1';
      if (nextUrl === preloadUrl) return;

      clearNextPreload();
      preloadVideoEl = document.createElement('video');
      preloadVideoEl.preload = 'auto';
      preloadVideoEl.muted = true;
      preloadVideoEl.playsInline = true;
      preloadVideoEl.setAttribute('playsinline', '');
      preloadVideoEl.setAttribute('webkit-playsinline', '');
      preloadVideoEl.src = nextUrl;
      preloadUrl = nextUrl;
      try {
        preloadVideoEl.load();
      } catch (ignore) {}
    });
  }

  function clearControlHideTimer() {
    if (controlHideTimer) {
      window.clearTimeout(controlHideTimer);
      controlHideTimer = null;
    }
  }

  function updateCenterControl() {
    if (!centerControlEl || !videoEl) return;
    var playing = !videoEl.paused && !videoEl.ended;
    centerControlEl.classList.toggle('is-playing', playing);
    centerControlEl.setAttribute('aria-label', playing ? 'Пауза' : 'Воспроизвести');
  }

  function showCenterControl(sticky) {
    if (!centerControlEl) return;
    clearControlHideTimer();
    updateCenterControl();
    centerControlEl.classList.add('is-visible');
    if (!sticky && videoEl && !videoEl.paused) {
      controlHideTimer = window.setTimeout(function () {
        centerControlEl.classList.remove('is-visible');
      }, 760);
    }
  }

  function hideCenterControl() {
    clearControlHideTimer();
    if (centerControlEl) centerControlEl.classList.remove('is-visible');
  }

  function updateProgress() {
    if (!progressBarEl || !videoEl || !Number.isFinite(videoEl.duration) || videoEl.duration <= 0) {
      if (progressBarEl) progressBarEl.style.width = '0%';
      if (progressEl) progressEl.setAttribute('aria-valuenow', '0');
      return;
    }
    var value = Math.max(0, Math.min(100, (videoEl.currentTime / videoEl.duration) * 100));
    progressBarEl.style.width = value + '%';
    if (progressEl) progressEl.setAttribute('aria-valuenow', String(Math.round(value)));
  }

  function seekFromProgressEvent(ev) {
    if (!progressEl || !videoEl || !Number.isFinite(videoEl.duration) || videoEl.duration <= 0) return;
    var rect = progressEl.getBoundingClientRect();
    var clientX = ev.clientX;
    if (ev.touches && ev.touches[0]) clientX = ev.touches[0].clientX;
    if (ev.changedTouches && ev.changedTouches[0]) clientX = ev.changedTouches[0].clientX;
    var ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    videoEl.currentTime = ratio * videoEl.duration;
    updateProgress();
  }

  function playCurrentVideo(showFallback) {
    if (!videoEl || !videoEl.play) return;
    var p = videoEl.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () {
        if (showFallback !== false) showCenterControl(true);
      });
    }
  }

  function requestAutoplay() {
    playCurrentVideo(false);
    if (playbackAttemptTimer) window.clearTimeout(playbackAttemptTimer);
    playbackAttemptTimer = window.setTimeout(function () {
      playCurrentVideo(true);
    }, 180);
  }

  function togglePlayback() {
    if (!videoEl) return;
    if (videoEl.paused || videoEl.ended) {
      playCurrentVideo();
      showCenterControl(false);
    } else {
      videoEl.pause();
      showCenterControl(true);
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
    resolvePlaybackUrl(item, slug).then(function (url) {
      if (!url) {
        showToast('Не удалось открыть ролик.', 3200);
        return;
      }
      var poster = item.poster ? String(item.poster) : '';
      openPlayerWithUrl(url, item.caption || '', poster, true, slug);
      setPlayerLikeSlug(item.slug || '');
    });
  }

  function resolvePlaybackUrl(item, slug) {
    var raw = item && item.playUrl ? String(item.playUrl).trim() : '';
    if (raw) {
      if (/^https?:\/\//i.test(raw)) return Promise.resolve(raw);
      var path = raw.charAt(0) === '/' ? raw : '/' + raw;
      try {
        return Promise.resolve(new URL(path, location.href).href);
      } catch (e) {
        return Promise.resolve(raw);
      }
    }

    var cacheKey = String(slug || '');
    var cached = presignCache[cacheKey];
    if (cached && cached.expiresAt > Date.now() + 120000) {
      return Promise.resolve(cached.url);
    }

    if (window.API && typeof window.API.getVideoPresign === 'function') {
      return window.API.getVideoPresign(cacheKey).then(function (res) {
        var url = res && res.url ? String(res.url) : '';
        if (!url) throw new Error('empty presign');
        presignCache[cacheKey] = {
          url: url,
          expiresAt: Date.now() + (Number(res.expires_in) || 3600) * 1000,
        };
        return url;
      }).catch(function () {
        return shortsStreamUrl(cacheKey);
      });
    }

    return Promise.resolve(shortsStreamUrl(cacheKey));
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
    neu.controls = false;
    neu.setAttribute('playsinline', '');
    neu.setAttribute('webkit-playsinline', '');
    neu.setAttribute('disablepictureinpicture', '');
    neu.setAttribute('controlslist', 'nodownload noplaybackrate noremoteplayback');
    neu.preload = 'auto';
    neu.muted = false;

    var oldEl = stageEl.querySelector('#shorts-player-video');
    if (oldEl && oldEl.parentNode === stageEl) {
      stageEl.replaceChild(neu, oldEl);
    } else {
      stageEl.appendChild(neu);
    }
    videoEl = neu;
  }

  function prepareVideoForSource(reuseOverlay) {
    if (!stageEl) return;
    if (!reuseOverlay) {
      remountFreshVideo();
      return;
    }
    detachVideoListeners();
    if (!videoEl) {
      remountFreshVideo();
      return;
    }
    try {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
    } catch (ignore) {}
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
    hideCenterControl();
    clearNextPreload();
    if (progressBarEl) progressBarEl.style.width = '0%';
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
   * @param {string} [slug] для fallback на proxy при ошибке presigned URL
   */
  function openPlayerWithUrl(url, title, posterHref, reuseOverlay, slug) {
    if (!overlay || !stageEl || !url) return;

    if (titleEl) titleEl.textContent = title || '';
    if (!reuseOverlay) {
      overlay.classList.remove('u-hidden');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('shorts-player-open');
    }

    setStageBusy(true, posterHref || '');
    prepareVideoForSource(!!reuseOverlay);
    if (!videoEl) return;

    var sourceUrl = url;
    var triedProxyFallback = false;
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    var playUrl = url + sep + '__ts=' + Date.now();

    /** @type {boolean} */
    var settled = false;

    function settle() {
      if (settled) return;
      settled = true;
      clearLoadKickTimer();
      detachLoadListenersOnly();
      setStageBusy(false, '');
      if (posterEl) posterEl.classList.remove('is-visible');
      requestAutoplay();
    }

    function attachLoadListeners() {
      vidListeners.settle = function () {
        settle();
      };
      videoEl.addEventListener('loadeddata', vidListeners.settle);
      videoEl.addEventListener('loadedmetadata', vidListeners.settle);
      videoEl.addEventListener('canplay', vidListeners.settle);
      loadKickTimer = window.setTimeout(function () {
        if (settled) return;
        if (videoEl.readyState >= 2) settle();
      }, 1400);
    }

    function retryWithProxy() {
      var proxyUrl = shortsStreamUrl(slug);
      if (!proxyUrl) return false;
      sourceUrl = proxyUrl;
      settled = false;
      clearLoadKickTimer();
      attachLoadListeners();
      var sep2 = proxyUrl.indexOf('?') >= 0 ? '&' : '?';
      videoEl.src = proxyUrl + sep2 + '__ts=' + Date.now();
      try {
        videoEl.load();
        requestAutoplay();
      } catch (ignore) {}
      return true;
    }

    vidListeners.onErr = function () {
      if (!triedProxyFallback && slug && /yandexcloud\.net/i.test(sourceUrl)) {
        triedProxyFallback = true;
        if (retryWithProxy()) return;
      }
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

    vidListeners.onTime = function () {
      updateProgress();
    };
    vidListeners.onPlayState = function () {
      updateCenterControl();
      if (videoEl && videoEl.paused) {
        showCenterControl(true);
      } else {
        showCenterControl(false);
        window.setTimeout(preloadNextShort, 450);
      }
    };

    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');
    videoEl.preload = 'auto';
    videoEl.controls = false;
    videoEl.muted = false;
    videoEl.setAttribute('disablepictureinpicture', '');
    videoEl.setAttribute('controlslist', 'nodownload noplaybackrate noremoteplayback');

    videoEl.addEventListener('error', vidListeners.onErr);
    videoEl.addEventListener('timeupdate', vidListeners.onTime);
    videoEl.addEventListener('durationchange', vidListeners.onTime);
    videoEl.addEventListener('play', vidListeners.onPlayState);
    videoEl.addEventListener('pause', vidListeners.onPlayState);

    attachLoadListeners();

    videoEl.src = playUrl;
    try {
      videoEl.load();
      requestAutoplay();
    } catch (e) {}
  }

  function playShort(cardBtn, itemIndex, slug, caption, item) {
    if (document.documentElement.classList.contains('shorts-input-cooldown')) return;
    if (cardBtn.classList.contains('short-card--busy')) return;

    if (!window.API || !window.API.base) {
      showToast('Нет подключения к API. Обновите страницу или проверьте настройки.', 5200);
      return;
    }

    playingIndex = typeof itemIndex === 'number' && itemIndex >= 0 ? itemIndex : 0;
    var poster = item && item.poster ? String(item.poster) : '';
    cardBtn.classList.add('short-card--busy');
    resolvePlaybackUrl(item, slug).then(function (url) {
      cardBtn.classList.remove('short-card--busy');
      if (!url) {
        showToast('Некорректная ссылка на ролик.', 4000);
        return;
      }
      openPlayerWithUrl(url, caption || '', poster, false, slug);
      setPlayerLikeSlug(slug);
    }).catch(function () {
      cardBtn.classList.remove('short-card--busy');
      showToast('Не удалось открыть ролик.', 3200);
    });
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

      var like = document.createElement('span');
      like.className = 'short-card__likes';
      like.setAttribute('role', 'button');
      like.setAttribute('tabindex', '0');
      like.setAttribute('aria-label', 'Нравится');
      like.dataset.shortLike = slug;
      like.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M2 21h2.5a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H2v11Zm19.83-9.12c.11-.25.17-.52.17-.8V10a2 2 0 0 0-2-2h-5.5l.83-3.98.03-.32a1.5 1.5 0 0 0-.44-1.06L13.92 2 8.3 7.62A2 2 0 0 0 7.5 9.2V19a2 2 0 0 0 2 2h8.5a2 2 0 0 0 1.84-1.22l2-4.66Z"/></svg><span data-short-like-count></span>';
      like.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        toggleShortLike(slug);
      });
      like.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        toggleShortLike(slug);
      });
      posterWrap.appendChild(like);

      var capWrap = document.createElement('span');
      capWrap.className = 'short-card__caption';
      var span = document.createElement('span');
      span.textContent = cap;
      var more = document.createElement('span');
      more.className = 'short-card__more';
      more.textContent = 'Ещё';
      capWrap.appendChild(span);
      capWrap.appendChild(more);

      btn.appendChild(posterWrap);
      btn.appendChild(capWrap);

      btn.addEventListener('click', function () {
        playShort(btn, itemIndex, slug, cap, item);
      });

      root.appendChild(btn);
      updateLikeViews(slug);
    });
  }

  playerLikeBtn?.addEventListener('click', function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    toggleShortLike(currentLikeSlug);
  });

  fetch('/data/shorts.json?v=2026-06-03-reels-1', { credentials: 'same-origin' })
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
        if (t.closest && (t.closest('[data-shorts-player-close]') || t.closest('.shorts-player-dismiss') || t.closest('#shorts-player-progress')))
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

        lastSwipeAt = Date.now();
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
  if (stageEl) {
    stageEl.addEventListener('click', function (ev) {
      if (!overlay || overlay.classList.contains('u-hidden')) return;
      if (Date.now() - lastSwipeAt < 360) return;
      if (ev.target.closest && ev.target.closest('.shorts-player-spinner')) return;
      if (ev.target.closest && ev.target.closest('#shorts-player-progress')) return;
      if (ev.target.closest && ev.target.closest('.shorts-player-actions')) return;
      if (ev.target.closest && ev.target.closest('#shorts-player-like')) return;
      togglePlayback();
    });
  }
  if (progressEl) {
    progressEl.addEventListener('pointerdown', function (ev) {
      if (!videoEl || !Number.isFinite(videoEl.duration) || videoEl.duration <= 0) return;
      progressSeeking = true;
      ev.preventDefault();
      ev.stopPropagation();
      progressEl.setPointerCapture?.(ev.pointerId);
      seekFromProgressEvent(ev);
    });
    progressEl.addEventListener('pointermove', function (ev) {
      if (!progressSeeking) return;
      ev.preventDefault();
      ev.stopPropagation();
      seekFromProgressEvent(ev);
    });
    progressEl.addEventListener('pointerup', function (ev) {
      if (!progressSeeking) return;
      progressSeeking = false;
      ev.preventDefault();
      ev.stopPropagation();
      progressEl.releasePointerCapture?.(ev.pointerId);
      seekFromProgressEvent(ev);
    });
    progressEl.addEventListener('pointercancel', function () {
      progressSeeking = false;
    });
    progressEl.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    });
  }
  if (centerControlEl) {
    centerControlEl.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      togglePlayback();
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
