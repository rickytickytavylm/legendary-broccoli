function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function safeInternalPath(value, fallback = '#') {
    const path = String(value || '').trim();
    if (!path || !path.startsWith('/') || path.startsWith('//') || /[\r\n"'<>]/.test(path)) return fallback;
    return path;
  }

  function safeAssetPath(value, fallback = '/assets/webp/courses.webp') {
    const path = String(value || '').trim();
    if (!path.startsWith('/assets/') || /[\r\n"'<>\\]/.test(path)) return fallback;
    return path;
  }

  window.addEventListener('auth:change', () => {
    document.getElementById('auth-gate').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    loadDashboard();
  });
  window.refreshAuthUI = () => {
    document.getElementById('auth-gate').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    loadDashboard();
  };

  async function initProfile() {
    const isLoggedIn = window.API && window.API.isLoggedIn();

    if (!isLoggedIn) {
      document.getElementById('auth-gate').style.display = 'flex';
      document.getElementById('gate-login-btn').addEventListener('click', () => {
        // trigger auth modal from auth.js
        if (window.openAuthModal) window.openAuthModal();
        else window.location.href = '/';
      });
      return;
    }

    document.getElementById('dashboard').style.display = 'block';
    await loadDashboard();
  }

  async function loadDashboard() {
    try {
      const data = await window.API.request('GET', '/profile/dashboard');
      const { user, stats, recent_activity, diary, daily_chart, ai_usage, access, courses } = data;
      const isPro = access && access.status === 'pro';

      // Greeting
      const hour = new Date().getHours();
      const greet = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
      const emailName = user.email ? user.email.split('@')[0] : '';
      const phoneName = user.phone ? user.phone.replace(/^\+7/, '+7 ') : '';
      const name = user.display_name || user.first_name || emailName || phoneName || 'друг';
      document.getElementById('dash-greeting').textContent = greet + ', ' + name;

      document.getElementById('dash-sub').textContent = isPro
        ? 'У вас открыт весь контент, закрытый Telegram и расширенный AI.'
        : 'Первые видео открыты. Остальное доступно в Система Pro.';

      // Streak
      const streak = stats.streak_days || 0;
      document.getElementById('streak-val').textContent = streak;
      document.getElementById('ring-streak').style.setProperty('--value', Math.min(100, Math.round((streak / 7) * 100)));
      document.getElementById('streak-big').textContent = isPro ? 'Pro' : 'Free';
      document.getElementById('member-since').textContent = isPro
        ? (user.subscription_expires_at ? 'Активно до ' + new Date(user.subscription_expires_at).toLocaleDateString('ru-RU') : 'Подписка активна')
        : 'Первые уроки открыты';
      document.getElementById('pro-cta').textContent = isPro ? 'Управлять подпиской' : 'Оформить Система Pro';
      document.getElementById('pro-cta').onclick = () => openProModal(isPro);
      if (new URLSearchParams(location.search).get('pro') === '1') {
        setTimeout(() => openProModal(isPro), 120);
        history.replaceState(null, '', location.pathname);
      }

      // Streak dots (last 7 days)
      const dotsEl = document.getElementById('streak-dots');
      const days7 = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
      const activeDates = new Set(daily_chart.map(d => d.day ? d.day.split('T')[0] : ''));
      const today = new Date();
      dotsEl.innerHTML = days7.map((d, i) => {
        const dt = new Date(today);
        const dayOfWeek = today.getDay(); // 0=sun
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        dt.setDate(today.getDate() - mondayOffset + i);
        const ds = dt.toISOString().split('T')[0];
        const active = activeDates.has(ds);
        const isToday = ds === today.toISOString().split('T')[0];
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
          <div style="width:28px;height:28px;border-radius:50%;background:${active ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.07)'};border:${isToday ? '2px solid rgba(255,255,255,.4)' : 'none'};"></div>
          <span style="font-size:9px;color:rgba(255,255,255,.25)">${d}</span>
        </div>`;
      }).join('');

      // Access status
      const pct = isPro ? 100 : 35;
      document.getElementById('prog-bar').style.width = pct + '%';
      document.getElementById('access-desc').textContent = isPro
        ? 'Открыт весь видеоконтент, закрытый Telegram и 50 сообщений с AI.'
        : 'Доступны первые видео всех разделов, лента, Shorts, открытый Telegram и 5 сообщений с AI.';

      // Practice time
      const mins = stats.practice_minutes || 0;
      const h = Math.floor(mins / 60), m = mins % 60;
      document.getElementById('practice-time').textContent =
        h > 0 ? `${h} ч ${m} мин` : `${m} мин`;

      // Bar chart
      const barEl = document.getElementById('bar-chart');
      const maxAct = Math.max(...daily_chart.map(d => parseInt(d.actions, 10) || 0), 1);
      barEl.innerHTML = days7.map((lbl, i) => {
        const dt = new Date(today);
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        dt.setDate(today.getDate() - mondayOffset + i);
        const ds = dt.toISOString().split('T')[0];
        const entry = daily_chart.find(d => (d.day || '').split('T')[0] === ds);
        const val = entry ? parseInt(entry.actions, 10) : 0;
        const heightPct = Math.max(8, Math.round((val / maxAct) * 100));
        const isToday = ds === today.toISOString().split('T')[0];
        return `<div class="bar-day">
          <div class="bar-fill ${isToday ? 'active' : ''}" style="height:${heightPct}%"></div>
          <span class="bar-lbl">${lbl}</span>
        </div>`;
      }).join('');

      // Goal (active days this week)
      document.getElementById('goal-done').textContent = stats.active_days_this_week || 0;
      document.getElementById('ring-week').style.setProperty('--value', Math.min(100, Math.round(((stats.active_days_this_week || 0) / 7) * 100)));

      // Product access cards
      window.profileAccessStatus = isPro ? 'pro' : 'free';
      document.getElementById('diary-last').textContent = isPro ? 'Закрытый канал доступен по подписке' : 'Открытый канал доступен всем';
      document.getElementById('open-diary-btn').textContent = isPro ? 'Получить ссылку Pro-канала' : 'Открыть Telegram';
      document.getElementById('ai-usage-card').textContent = `${ai_usage?.used || 0} / ${ai_usage?.limit || (isPro ? 50 : 5)}`;
      document.getElementById('ai-usage-desc').textContent = isPro
        ? `${ai_usage?.remaining ?? 50} сообщений осталось в этом периоде.`
        : `${ai_usage?.remaining ?? 5} сообщений осталось. В Pro будет 50.`;
      const aiLimit = ai_usage?.limit || (isPro ? 50 : 5);
      const aiUsed = ai_usage?.used || 0;
      document.getElementById('ring-ai').style.setProperty('--value', Math.min(100, Math.round((aiUsed / Math.max(1, aiLimit)) * 100)));
      document.getElementById('gratitude-cnt').textContent = isPro ? 'Все' : (courses ? Math.max(courses.length - 1, 0) : 0);
      document.getElementById('goal-done').textContent = stats.completed_lessons || 0;
      document.getElementById('goal-target').textContent = courses ? courses.length : 11;

      // Continue learning — show static course cards (extend later from API)
      const courseItems = Array.isArray(courses) ? courses : [];
      document.getElementById('lessons-scroll').innerHTML = courseItems.map((c, i) => `
        <a class="course-tile" href="${escapeHtml(safeInternalPath(c.href))}" style="--thumb:url('${escapeHtml(safeAssetPath(c.thumb))}')">
          <div class="course-tile-content">
            <p class="course-tile-title">${escapeHtml(c.title)}</p>
            <p class="course-tile-sub">${isPro ? 'Полный доступ' : 'Первый урок открыт'}</p>
          </div>
        </a>
      `).join('');

    } catch (e) {
      console.error('Dashboard load error', e);
    }

    // Log page view
    try { await window.API.request('POST', '/profile/activity', { event_type: 'page_view', entity_type: 'page', entity_id: 'profile' }); } catch {}
  }

  initProfile();

  document.getElementById('open-diary-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    if (window.profileAccessStatus === 'pro') {
      alert('Ссылку на закрытый Telegram-канал подключим на этапе реальной подписки.');
    } else {
      alert('Ссылку на открытый Telegram-канал добавим после финального подключения каналов.');
    }
    return;
    const modal = document.getElementById('diary-modal');
    modal.style.display = 'flex';
    // Load entries
    try {
      const data = await window.API.request('GET', '/profile/diary');
      const entriesEl = document.getElementById('diary-entries');
      if (data.entries && data.entries.length > 0) {
        const moodEmoji = ['','😔','😐','🙂','😊','😄'];
        entriesEl.innerHTML = data.entries.map(e => `
          <div style="background:rgba(255,255,255,.04);border-radius:12px;padding:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:11px;color:rgba(255,255,255,.3)">${new Date(e.created_at).toLocaleDateString('ru-RU')}</span>
              ${e.mood ? `<span style="font-size:16px">${moodEmoji[e.mood]}</span>` : ''}
            </div>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,.7);line-height:1.5">${escapeHtml(e.content || '')}</p>
          </div>
        `).join('');
      } else {
        entriesEl.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,.3);font-size:13px">Пока нет записей</p>';
      }
    } catch {}
  });

  function openProModal(isPro) {
    const modal = document.getElementById('pro-modal');
    if (!modal) return;
    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';
    document.getElementById('pro-modal-status').textContent = isPro ? 'Сейчас у вас активен Система Pro.' : 'Сейчас у вас бесплатный доступ.';
  }

  function closeProModal() {
    const modal = document.getElementById('pro-modal');
    if (!modal) return;
    modal.classList.remove('visible');
    document.body.style.overflow = '';
  }
  function closeDiary() {
    document.getElementById('diary-modal').style.display = 'none';
  }
  async function saveDiary() {
    const content = document.getElementById('diary-input').value.trim();
    if (!content) return;
    try {
      await window.API.request('POST', '/profile/diary', { content });
      document.getElementById('diary-input').value = '';
      document.getElementById('diary-last').textContent = 'Последняя запись: сегодня';
      closeDiary();
    } catch (e) { console.error(e); }
  }

  function doLogout() {
    window.API.logout();
    window.location.href = '/';
  }

  document.getElementById('logout-btn')?.addEventListener('click', doLogout);
  document.getElementById('diary-close-btn')?.addEventListener('click', closeDiary);
  document.getElementById('diary-cancel-btn')?.addEventListener('click', closeDiary);
  document.getElementById('diary-save-btn')?.addEventListener('click', saveDiary);
  document.getElementById('pro-close-btn')?.addEventListener('click', closeProModal);
  document.getElementById('yookassa-placeholder-btn')?.addEventListener('click', () => {
    alert('Оплату через ЮKassa подключим на этапе боевого запуска.');
  });

  function pluralDays(n) {
    if (n % 10 === 1 && n % 100 !== 11) return 'день';
    if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'дня';
    return 'дней';
  }
