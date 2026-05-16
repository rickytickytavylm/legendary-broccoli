/**
 * Страница /shorts/: список из /data/shorts.json + воспроизведение MP4 через /api/video/presign (signed URL на YOS).
 */
(function initShortsPage() {
  var root = document.getElementById('shorts-grid');
  var overlay = document.getElementById('shorts-player-overlay');
  var videoEl = document.getElementById('shorts-player-video');
  var closeBtn = overlay && overlay.querySelector('[data-shorts-player-close]');
  var titleEl = document.getElementById('shorts-player-title');

  if (!root) return;

  function hidePlayer() {
    if (!overlay || !videoEl) return;
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.load();
    overlay.classList.add('u-hidden');
    overlay.setAttribute('aria-hidden', 'true');
    if (titleEl) titleEl.textContent = '';
    document.body.classList.remove('shorts-player-open');
  }

  function showPlayer(title) {
    if (!overlay || !videoEl) return;
    if (titleEl) titleEl.textContent = title || '';
    overlay.classList.remove('u-hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('shorts-player-open');
  }

  async function playShort(slug, title) {
    if (!window.API || !window.API.getVideoPresign) {
      alert('Не удалось загрузить плеер. Обновите страницу.');
      return;
    }
    showPlayer(title);
    videoEl.pause();
    try {
      var res = await window.API.getVideoPresign(slug);
      if (!res || !res.url) throw new Error('No URL');
      videoEl.src = res.url;
      await videoEl.play().catch(function() {});
    } catch {
      hidePlayer();
      alert('Не удалось получить ссылку на видео. Убедитесь, что ролики загружены в Object Storage (ключ ' + slug + ').');
    }
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
      play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.14v14.72a1 1 0 001.5.86l11-7.36a1 1 0 000-1.72l-11-7.36A1 1 0 008 5.14z"/></svg>';
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
        playShort(slug, cap);
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
