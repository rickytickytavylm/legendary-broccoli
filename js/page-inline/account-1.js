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
    showDashboardShell();
    loadDashboard();
  });
  window.refreshAuthUI = () => {
    showDashboardShell();
    loadDashboard();
  };

  function setPanelVisible(element, visible, display = 'block') {
    if (!element) return;
    element.classList.toggle('u-hidden', !visible);
    element.setAttribute('aria-hidden', visible ? 'false' : 'true');
    element.style.display = visible ? display : 'none';
  }

  function showAuthGate() {
    setPanelVisible(document.getElementById('dashboard'), false);
    setPanelVisible(document.getElementById('auth-gate'), true, 'flex');
  }

  function showDashboardShell() {
    setPanelVisible(document.getElementById('auth-gate'), false);
    setPanelVisible(document.getElementById('dashboard'), true, 'block');
  }

  async function initProfile() {
    showDashboardShell();
    await loadDashboard();
  }

  async function loadDashboard() {
    try {
      const data = await window.API.request('GET', '/profile/dashboard');
      const { user, stats, recent_activity, diary, daily_chart, ai_usage, access, courses } = data;
      const profile = JSON.parse(localStorage.getItem('sistema:onboarding-profile') || '{}');

      // Greeting
      const hour = new Date().getHours();
      const greet = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
      const emailName = user.email ? user.email.split('@')[0] : '';
      const phoneName = user.phone ? user.phone.replace(/^\+7/, '+7 ') : '';
      const name = user.display_name || user.first_name || profile.name || emailName || phoneName || 'друг';
      document.getElementById('dash-greeting').textContent = name;

      document.getElementById('dash-sub').textContent = 'Профиль устройства. Авторизацию подключим позже.';

      document.getElementById('streak-val')?.replaceChildren(document.createTextNode(String(stats.streak_days || 0)));
      document.getElementById('ring-streak')?.style.setProperty?.('--value', Math.min(100, Math.round(((stats.streak_days || 0) / 7) * 100)));
      document.getElementById('streak-big')?.replaceChildren(document.createTextNode('Открыто'));
      document.getElementById('member-since')?.replaceChildren(document.createTextNode('Маршрут собирается'));
      document.getElementById('pro-cta')?.replaceChildren(document.createTextNode('Продолжить путь'));

      const dotsEl = document.getElementById('streak-dots');
      const days7 = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
      const activeDates = new Set(daily_chart.map(d => d.day ? d.day.split('T')[0] : ''));
      const today = new Date();
      if (dotsEl) dotsEl.innerHTML = days7.map((d, i) => {
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

      const pct = 100;
      document.getElementById('prog-bar')?.style && (document.getElementById('prog-bar').style.width = pct + '%');
      document.getElementById('access-desc')?.replaceChildren(document.createTextNode(profile.route
        ? `Выбранное направление: ${profile.route}. На сегодня собраны две программы для старта.`
        : 'Материалы открыты. Пройдите онбординг, чтобы собрать личный маршрут.'));
      document.getElementById('profile-main-direction')?.replaceChildren(document.createTextNode(profile.route || 'Не выбрано'));
      document.getElementById('profile-entry-format')?.replaceChildren(document.createTextNode(profile.entry === 'audio' ? 'Аудио' : profile.entry === 'short' ? 'Коротко' : 'Видео'));

      // Practice time
      const mins = stats.practice_minutes || 0;
      const h = Math.floor(mins / 60), m = mins % 60;
      document.getElementById('practice-time')?.replaceChildren(document.createTextNode(h > 0 ? `${h} ч ${m} мин` : `${m} мин`));

      // Bar chart
      const barEl = document.getElementById('bar-chart');
      const maxAct = Math.max(...daily_chart.map(d => parseInt(d.actions, 10) || 0), 1);
      if (barEl) barEl.innerHTML = days7.map((lbl, i) => {
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
      document.getElementById('goal-done')?.replaceChildren(document.createTextNode(String(stats.active_days_this_week || 0)));
      document.getElementById('ring-week')?.style.setProperty?.('--value', Math.min(100, Math.round(((stats.active_days_this_week || 0) / 7) * 100)));

      // Product access cards
      document.getElementById('diary-last')?.replaceChildren(document.createTextNode('Сообщество подключаем как поддержку, а не как платный барьер.'));
      document.getElementById('open-diary-btn')?.replaceChildren(document.createTextNode('Открыть Telegram'));
      document.getElementById('ai-usage-card')?.replaceChildren(document.createTextNode(`${ai_usage?.used || 0}`));
      document.getElementById('ai-usage-desc')?.replaceChildren(document.createTextNode('без лимита'));
      const aiLimit = Math.max(ai_usage?.used || 1, 20);
      const aiUsed = ai_usage?.used || 0;
      document.getElementById('ring-ai')?.style.setProperty?.('--value', Math.min(100, Math.round((aiUsed / Math.max(1, aiLimit)) * 100)));
      document.getElementById('gratitude-cnt')?.replaceChildren(document.createTextNode(String(courses ? courses.length : 0)));
      document.getElementById('goal-done')?.replaceChildren(document.createTextNode(String(stats.completed_lessons || 0)));
      document.getElementById('goal-target')?.replaceChildren(document.createTextNode(String(courses ? courses.length : 11)));

      // Continue learning — show static course cards (extend later from API)
      const courseItems = Array.isArray(courses) ? courses : [];
      const lessonsScroll = document.getElementById('lessons-scroll');
      if (lessonsScroll) lessonsScroll.innerHTML = courseItems.map((c, i) => `
        <a class="course-tile" href="${escapeHtml(safeInternalPath(c.href))}" style="--thumb:url('${escapeHtml(safeAssetPath(c.thumb))}')">
          <div class="course-tile-content">
            <p class="course-tile-title">${escapeHtml(c.title)}</p>
            <p class="course-tile-sub">Можно добавить в путь</p>
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
    alert('Ссылку на Telegram-канал добавим после финального подключения каналов.');
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

  async function deleteAccount() {
    const firstConfirm = confirm('Удалить профиль на этом устройстве? Будут удалены прогресс, история AI и настройки маршрута.');
    if (!firstConfirm) return;
    const secondConfirm = confirm('Это действие нельзя отменить. Следующий заход начнется со сплеша и онбординга.');
    if (!secondConfirm) return;

    const button = document.getElementById('delete-account-btn');
    if (button) {
      button.disabled = true;
      button.textContent = 'Удаляем...';
    }

    try {
      await window.API.deleteAccount();
      window.API.clearLocalState();
      localStorage.removeItem('sistema:device-id');
      window.location.href = '/';
    } catch (err) {
      alert(err.error || 'Не удалось удалить аккаунт. Попробуйте еще раз.');
      if (button) {
        button.disabled = false;
        button.textContent = 'Удалить аккаунт';
      }
    }
  }

  document.getElementById('logout-btn')?.addEventListener('click', doLogout);
  document.getElementById('delete-account-btn')?.addEventListener('click', deleteAccount);
  document.getElementById('diary-close-btn')?.addEventListener('click', closeDiary);
  document.getElementById('diary-cancel-btn')?.addEventListener('click', closeDiary);
  document.getElementById('diary-save-btn')?.addEventListener('click', saveDiary);

  function pluralDays(n) {
    if (n % 10 === 1 && n % 100 !== 11) return 'день';
    if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'дня';
    return 'дней';
  }
