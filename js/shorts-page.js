/**
 * Shorts: превью из /data/shorts.json; видео — GET /api/video/shorts-mp4?slug=…
 * Совместимость с iOS: без «ложного» тапа по первой карточке после входа через таб,
 * принудительный cache-bust у плеера, canplay как запасное к loadeddata.
 */
(function initShortsPage() {
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
  /** @type {{ settle: Function | null, onErr: Function | null }} */
  var vidListeners = { settle: null, onErr: null };
  /** @type {ReturnType<typeof setTimeout> | null} */
  var loadKickTimer = null;

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

  function detachVideoListeners() {
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
    return base + '/video/shorts-mp4?slug=' + encodeURIComponent(slug);
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
   */
  function openPlayerWithUrl(url, title, posterHref) {
    if (!overlay || !stageEl || !url) return;

    if (titleEl) titleEl.textContent = title || '';
    overlay.classList.remove('u-hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('shorts-player-open');

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
        p.catch(function () {});
      }
    }

    function settle() {
      if (settled) return;
      settled = true;
      clearLoadKickTimer();
      detachVideoListeners();
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

    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');
    videoEl.preload = 'auto';

    videoEl.addEventListener('loadeddata', vidListeners.settle);
    videoEl.addEventListener('canplay', vidListeners.settle);
    videoEl.addEventListener('error', vidListeners.onErr);

    loadKickTimer = window.setTimeout(function () {
      if (settled) return;
      if (videoEl.readyState >= 2) settle();
    }, 1400);

    videoEl.src = playUrl;
  }

  function playShort(cardBtn, slug, caption, item) {
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

    var poster = item && item.poster ? String(item.poster) : '';
    cardBtn.classList.add('short-card--busy');
    window.requestAnimationFrame(function () {
      openPlayerWithUrl(url, caption || '', poster);
      cardBtn.classList.remove('short-card--busy');
    });
  }

  function render(items) {
    root.textContent = '';
    (items || []).forEach(function (item) {
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
        playShort(btn, slug, cap, item);
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
    if (ev.key === 'Escape' && overlay && !overlay.classList.contains('u-hidden')) hidePlayer();
  });
})();
