/**
 * Shorts: превью из /data/shorts.json; видео — GET /api/video/shorts-mp4?slug=… (поток из бакета через API, без presign в плеере).
 * Без alert — только тост и состояния загрузки.
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
  var toastTimer;

  var vidListeners = { loaded: null, error: null };

  if (!root) return;

  function showToast(msg, ms) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('shorts-toast--visible');
    toastEl.setAttribute('role', 'alert');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('shorts-toast--visible');
    }, ms || 4800);
  }

  function detachVideoListeners() {
    if (!videoEl) return;
    if (vidListeners.loaded) {
      videoEl.removeEventListener('loadeddata', vidListeners.loaded);
      vidListeners.loaded = null;
    }
    if (vidListeners.error) {
      videoEl.removeEventListener('error', vidListeners.error);
      vidListeners.error = null;
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

  /** Полный URL для <video>: API-стрим или опциональный статический playUrl из JSON */
  function playbackUrlFor(item, slug) {
    var raw = item && item.playUrl ? String(item.playUrl).trim() : '';
    if (raw) {
      if (/^https?:\/\//i.test(raw)) return raw;
      var path = raw.charAt(0) === '/' ? raw : '/' + raw;
      try {
        return new URL(path, window.location.origin).href;
      } catch (e) {
        return raw;
      }
    }
    return shortsStreamUrl(slug);
  }

  function hidePlayer() {
    if (!overlay || !videoEl) return;
    var ae = document.activeElement;
    if (ae && overlay.contains(ae)) {
      try {
        ae.blur();
      } catch (ignore) {}
    }
    detachVideoListeners();
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.load();
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
   * Открыть плеер: сразу понятный адрес (наш API или статика), спиннер до кадра данных.
   */
  function openPlayerWithUrl(url, title, posterHref) {
    if (!overlay || !videoEl || !url) return;

    if (titleEl) titleEl.textContent = title || '';
    overlay.classList.remove('u-hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('shorts-player-open');

    setStageBusy(true, posterHref || '');

    detachVideoListeners();

    vidListeners.loaded = function () {
      setStageBusy(false, '');
      if (posterEl) posterEl.classList.remove('is-visible');
      videoEl.play().catch(function () {});
    };

    vidListeners.error = function () {
      detachVideoListeners();
      setStageBusy(false, '');
      hidePlayer();
      showToast('Не удалось открыть видео. Обновите страницу или попробуйте через минуту.', 5500);
    };

    videoEl.addEventListener('loadeddata', vidListeners.loaded);
    videoEl.addEventListener('error', vidListeners.error);

    videoEl.src = url;
  }

  function playShort(cardBtn, slug, caption, item) {
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
      root.innerHTML =
        '<p class="shorts-page-error">Не удалось загрузить список роликов.</p>';
      showToast('Список shorts не загрузился.', 5000);
    });

  if (closeBtn) closeBtn.addEventListener('click', hidePlayer);
  if (overlay) {
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) hidePlayer();
    });
  }

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && overlay && !overlay.classList.contains('u-hidden')) hidePlayer();
  });
})();
