(function initCommunityChat() {
  function fmtPrice(n) { return Number(n).toLocaleString('ru-RU'); }
  const root = document.querySelector('[data-chat-root]');
  if (!root || !window.API) return;

  const list = root.querySelector('[data-chat-messages]');
  const form = root.querySelector('[data-chat-form]');
  const input = root.querySelector('[data-chat-input]');
  const status = root.querySelector('[data-chat-status]');
  const empty = root.querySelector('[data-chat-empty]');
  const sendButton = root.querySelector('[data-chat-send]');
  const voiceRecBtn = document.getElementById('chat-voice-rec-btn');
  const videoRecBtn = document.getElementById('chat-video-rec-btn');
  const CHAT_BG_KEY = 'sistema:chat-background';
  const CHAT_BACKGROUNDS = [
    { id: 'classic', label: 'Текущий', className: '', preview: 'linear-gradient(135deg, rgba(255,255,255,.12), rgba(255,255,255,.02))' },
    { id: 'zigzag-blue', label: 'Синий zigzag', className: 'chat-bg-zigzag-blue', preview: 'linear-gradient(135deg, #5394fd 25%, #fefefe 25%, #fefefe 50%, #5394fd 50%, #5394fd 75%, #fefefe 75%)' },
    { id: 'stripes-green', label: 'Зеленые полосы', className: 'chat-bg-stripes-green', preview: 'linear-gradient(to right, #57c99b, #57c99b 10px, #fefefe 10px, #fefefe 20px)' },
    { id: 'sublime', label: 'Sublime', className: 'chat-bg-sublime', preview: 'linear-gradient(115deg, #ff5c7d, #6a82fb)' },
    { id: 'argon', label: 'Argon', className: 'chat-bg-argon', preview: 'linear-gradient(110deg, #03001e, #7303c0, #ec38bc, #fdeff9)' },
    { id: 'radial-dots', label: 'Радиальные точки', className: 'chat-bg-radial-dots', preview: 'repeating-radial-gradient(circle, #fff, #fff 1px, transparent 2px, transparent 6px)' },
  ];
  const state = {
    messages: new Map(),
    latestId: 0,
    socket: null,
    userId: null,
    userRole: 'user',
    canSendMedia: false,
    emailNotificationsEnabled: true,
    sending: false,
    editingMessageId: null,
    replyToMessage: null,
    loading: true,
  };

  function currentChatBackgroundId() {
    return localStorage.getItem(CHAT_BG_KEY) || 'classic';
  }

  function applyChatBackground(id) {
    const selected = CHAT_BACKGROUNDS.find((item) => item.id === id) || CHAT_BACKGROUNDS[0];
    CHAT_BACKGROUNDS.forEach((item) => {
      if (item.className) document.body.classList.remove(item.className);
    });
    if (selected.className) document.body.classList.add(selected.className);
    localStorage.setItem(CHAT_BG_KEY, selected.id);
  }

  applyChatBackground(currentChatBackgroundId());

  // Create Edit Mode Banner dynamically above the composer
  const editBanner = document.createElement('div');
  editBanner.id = 'chat-edit-banner';
  editBanner.className = 'chat-edit-banner hidden';
  editBanner.innerHTML = `
    <div class="edit-banner-content">
      <svg class="edit-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      <span>Редактирование</span>
    </div>
    <button type="button" class="edit-banner-close" id="chat-cancel-edit-btn" aria-label="Отменить">×</button>
  `;
  form?.parentNode?.insertBefore(editBanner, form);

  const replyBanner = document.createElement('div');
  replyBanner.id = 'chat-reply-banner';
  replyBanner.className = 'chat-reply-banner hidden';
  replyBanner.innerHTML = `
    <div class="reply-banner-content">
      <span class="reply-banner-label">Ответ</span>
      <strong data-reply-name></strong>
      <small data-reply-text></small>
    </div>
    <button type="button" class="reply-banner-close" aria-label="Отменить ответ">×</button>
  `;
  form?.parentNode?.insertBefore(replyBanner, form);

  function clearReply() {
    state.replyToMessage = null;
    replyBanner.classList.add('hidden');
  }

  function replyPreviewText(message) {
    if (!message) return '';
    if (message.text_content) return message.text_content;
    if (message.type === 'audio_circle') return 'Голосовое сообщение';
    if (message.type === 'video_circle' || message.type === 'video_attachment') return 'Видеосообщение';
    if (message.type === 'image_attachment') return 'Изображение';
    return 'Сообщение';
  }

  function setReply(message) {
    if (!message || !message.id) return;
    state.replyToMessage = message;
    replyBanner.querySelector('[data-reply-name]').textContent = message.sender_name || 'Участник';
    replyBanner.querySelector('[data-reply-text]').textContent = replyPreviewText(message).slice(0, 120);
    replyBanner.classList.remove('hidden');
    input?.focus();
  }

  replyBanner.querySelector('.reply-banner-close')?.addEventListener('click', clearReply);

  editBanner.querySelector('#chat-cancel-edit-btn')?.addEventListener('click', () => {
    state.editingMessageId = null;
    clearReply();
    input.value = '';
    editBanner.classList.add('hidden');
    if (input && input.tagName === 'TEXTAREA') {
      input.style.height = 'auto';
    }
  });

  // Auto-resize textarea height as the user types
  if (input && input.tagName === 'TEXTAREA') {
    input.addEventListener('input', function() {
      input.style.height = 'auto';
      input.style.height = (input.scrollHeight) + 'px';
    });
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function timeLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function extractZoomMeeting(text) {
    const source = String(text || '');
    const match = source.match(/https?:\/\/(?:[a-z0-9-]+\.)*(?:zoom\.us|zoom\.com|zoomgov\.com)\/(?:j|s|w|my)\/[^\s<>"']+/i);
    if (!match) return null;

    const rawUrl = match[0];
    const url = rawUrl.replace(/[),.;!?]+$/g, '');
    let label = 'Zoom-встреча';
    let hasPasscode = false;

    try {
      const parsed = new URL(url);
      const meetingMatch = parsed.pathname.match(/\/(?:j|s|w)\/(\d+)/i);
      const personalMatch = parsed.pathname.match(/\/my\/([^/?#]+)/i);
      if (meetingMatch) {
        label = `ID ${meetingMatch[1].replace(/(\d{3})(?=\d)/g, '$1 ').trim()}`;
      } else if (personalMatch) {
        label = `/${decodeURIComponent(personalMatch[1])}`;
      }
      hasPasscode = parsed.searchParams.has('pwd') || parsed.searchParams.has('passcode');
    } catch (err) {
      hasPasscode = /[?&](pwd|passcode)=/i.test(url);
    }

    return {
      url,
      label,
      hasPasscode,
      textWithoutUrl: source.replace(rawUrl, '').trim(),
    };
  }

  function renderZoomCard(zoom) {
    return `
      <div class="chat-zoom-card">
        <div class="chat-zoom-card-main">
          <div class="chat-zoom-logo" aria-hidden="true">
            <svg viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="currentColor"/>
              <path d="M8 10.2c0-.66.54-1.2 1.2-1.2h6.2c.66 0 1.2.54 1.2 1.2v5.6c0 .66-.54 1.2-1.2 1.2H9.2c-.66 0-1.2-.54-1.2-1.2v-5.6Zm9.8 1.85 3.25-2.05c.4-.25.95.03.95.5v7c0 .47-.55.75-.95.5l-3.25-2.05v-3.9Z" fill="#fff"/>
            </svg>
          </div>
          <div class="chat-zoom-copy">
            <strong>Встреча в Zoom</strong>
            <span>${escapeHtml(zoom.label)}${zoom.hasPasscode ? ' • пароль в ссылке' : ''}</span>
          </div>
        </div>
        <a class="chat-zoom-join" href="${escapeHtml(zoom.url)}" target="_blank" rel="noopener noreferrer">Подключиться</a>
      </div>
    `;
  }

  function renderTextContent(text) {
    const zoom = extractZoomMeeting(text);
    if (!zoom) {
      return `<div class="chat-message-text">${escapeHtml(text || '').replace(/\n/g, '<br>')}</div>`;
    }

    const remainingText = zoom.textWithoutUrl
      ? `<div class="chat-message-text">${escapeHtml(zoom.textWithoutUrl).replace(/\n/g, '<br>')}</div>`
      : '';
    return `${remainingText}${renderZoomCard(zoom)}`;
  }

  function renderReplyPreview(reply) {
    if (!reply || !reply.id) return '';
    const text = reply.text_content || (reply.type === 'audio_circle' ? 'Голосовое сообщение' : (reply.type === 'video_circle' || reply.type === 'video_attachment') ? 'Видеосообщение' : reply.type === 'image_attachment' ? 'Изображение' : 'Сообщение');
    return `
      <button class="chat-reply-preview" type="button" data-scroll-reply="${escapeHtml(reply.id)}">
        <strong>${escapeHtml(reply.sender_name || 'Участник')}</strong>
        <span>${escapeHtml(text).replace(/\n/g, ' ').slice(0, 120)}</span>
      </button>
    `;
  }

  function renderReactions(reactions) {
    if (!Array.isArray(reactions) || reactions.length === 0) return '';
    return `
      <div class="chat-reactions">
        ${reactions.map((reaction) => `
          <button class="chat-reaction-chip${reaction.reacted_by_me ? ' active' : ''}" type="button" data-reaction-emoji="${escapeHtml(reaction.emoji)}">
            <span>${escapeHtml(reaction.emoji)}</span><strong>${Number(reaction.count) || 0}</strong>
          </button>
        `).join('')}
      </div>
    `;
  }

  function triggerHapticFeedback() {
    if (!navigator.vibrate) return;
    try {
      navigator.vibrate(18);
    } catch (err) {
      // Some browsers expose vibrate but block it silently outside supported contexts.
    }
  }

  function setStatus(text) {
    if (!status) return;
    let pushStatus = '';
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        pushStatus = ' • Уведомления включены';
      } else if (Notification.permission === 'denied') {
        pushStatus = ' • Уведомления заблокированы';
      } else {
        pushStatus = ' • Уведомления не настроены';
      }
    }
    status.textContent = (text || '') + pushStatus;
  }

  function updateComposerMediaAccess() {
    const allowed = state.userRole === 'admin' && !!state.canSendMedia;
    voiceRecBtn?.classList.toggle('hidden', !allowed);
    videoRecBtn?.classList.toggle('hidden', !allowed);
  }
  updateComposerMediaAccess();

  function isStandalonePwa() {
    return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  }

  async function setEmailNotificationsEnabled(enabled) {
    state.emailNotificationsEnabled = !!enabled;
    if (window.API?.request) {
      await window.API.request('PATCH', '/profile/me', {
        chat_email_notifications_enabled: state.emailNotificationsEnabled,
      });
    }
  }

  async function setPushNotificationsEnabled(enabled) {
    if (enabled) {
      await setupPushNotifications(false);
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await window.API.request('POST', '/chat/unsubscribe', { endpoint: subscription.endpoint }).catch(() => {});
      await subscription.unsubscribe();
    } else {
      await window.API.request('POST', '/chat/unsubscribe', {}).catch(() => {});
    }
    localStorage.setItem('notifications-prompt-dismissed', 'true');
  }

  function installChatSettingsButton() {
    const actions = document.querySelector('#app-mobile-header .mobile-header-actions');
    if (!actions || actions.querySelector('[data-chat-settings-open]')) return;
    actions.innerHTML = `
      <button type="button" class="chat-settings-header-btn" data-chat-settings-open aria-label="Настройки чата">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.08A1.7 1.7 0 0 0 8.96 19.36a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.08A1.7 1.7 0 0 0 4.64 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.07 4.14l.06.06A1.7 1.7 0 0 0 9 4.54 1.7 1.7 0 0 0 10 2.98V3a2 2 0 0 1 4 0v-.02a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87 1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 0 1 0 4h-.04A1.7 1.7 0 0 0 19.4 15Z"/></svg>
      </button>
    `;
    actions.querySelector('[data-chat-settings-open]')?.addEventListener('click', openChatSettingsSheet);
  }

  function renderSettingsToggle({ id, label, note, enabled, disabled }) {
    return `
      <div class="chat-setting-row${disabled ? ' disabled' : ''}">
        <div>
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(note || '')}</span>
        </div>
        <button type="button" class="chat-liquid-toggle${enabled ? ' active' : ''}" data-setting-toggle="${escapeHtml(id)}" ${disabled ? 'disabled' : ''} aria-pressed="${enabled ? 'true' : 'false'}"><i></i></button>
      </div>
    `;
  }

  function openChatSettingsSheet() {
    const existing = document.getElementById('chat-settings-sheet');
    if (existing) existing.remove();
    const pushAvailable = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window && isStandalonePwa();
    const pushEnabled = pushAvailable && Notification.permission === 'granted';
    const currentBg = currentChatBackgroundId();
    const sheet = document.createElement('div');
    sheet.id = 'chat-settings-sheet';
    sheet.className = 'chat-settings-sheet';
    sheet.innerHTML = `
      <div class="chat-settings-backdrop"></div>
      <section class="chat-settings-panel" role="dialog" aria-modal="true" aria-label="Настройки чата">
        <div class="chat-settings-grabber"></div>
        <div class="chat-settings-head">
          <div>
            <span>Общий чат</span>
            <h2>Настройки</h2>
          </div>
          <button type="button" data-chat-settings-close aria-label="Закрыть">×</button>
        </div>
        <div class="chat-settings-block">
          <h3>Уведомления</h3>
          ${renderSettingsToggle({
            id: 'email',
            label: 'Email-уведомления',
            note: 'Письмо о новых сообщениях, не чаще раза в 15 минут.',
            enabled: state.emailNotificationsEnabled,
          })}
          ${renderSettingsToggle({
            id: 'push',
            label: 'Push-уведомления',
            note: pushAvailable ? 'Мгновенные уведомления в веб-приложении.' : 'Доступно в веб-приложении, добавленном на экран Домой.',
            enabled: pushEnabled,
            disabled: !pushAvailable,
          })}
        </div>
        <div class="chat-settings-block">
          <h3>Фон чата</h3>
          <div class="chat-bg-picker">
            ${CHAT_BACKGROUNDS.map((bg) => `
              <button type="button" class="chat-bg-option${bg.id === currentBg ? ' active' : ''}" data-chat-bg="${escapeHtml(bg.id)}">
                <span style="background:${escapeHtml(bg.preview)}"></span>
                <strong>${escapeHtml(bg.label)}</strong>
              </button>
            `).join('')}
          </div>
        </div>
      </section>
    `;
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('active'));
    const close = () => {
      sheet.classList.remove('active');
      setTimeout(() => sheet.remove(), 260);
    };
    sheet.querySelector('.chat-settings-backdrop')?.addEventListener('click', close);
    sheet.querySelector('[data-chat-settings-close]')?.addEventListener('click', close);
    sheet.addEventListener('click', async (ev) => {
      const bgBtn = ev.target.closest('[data-chat-bg]');
      if (bgBtn) {
        applyChatBackground(bgBtn.dataset.chatBg);
        sheet.querySelectorAll('.chat-bg-option').forEach((btn) => btn.classList.toggle('active', btn === bgBtn));
        return;
      }
      const toggle = ev.target.closest('[data-setting-toggle]');
      if (!toggle || toggle.disabled) return;
      const next = !toggle.classList.contains('active');
      toggle.classList.toggle('active', next);
      toggle.setAttribute('aria-pressed', next ? 'true' : 'false');
      try {
        if (toggle.dataset.settingToggle === 'email') await setEmailNotificationsEnabled(next);
        if (toggle.dataset.settingToggle === 'push') await setPushNotificationsEnabled(next);
      } catch (err) {
        toggle.classList.toggle('active', !next);
        toggle.setAttribute('aria-pressed', !next ? 'true' : 'false');
        setStatus(err?.error || 'Не удалось сохранить настройки');
      }
    });
  }

  function shouldStickToBottom() {
    if (!list) return true;
    return list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  }

  function scrollToBottom() {
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }

  function renderLoader(label = 'Загружаем сообщения…') {
    return `
      <div class="sistema-loader-state">
        <div class="sistema-loader" aria-hidden="true">
          <span class="sistema-loader-bar"></span>
          <span class="sistema-loader-bar"></span>
          <span class="sistema-loader-bar"></span>
        </div>
        <span>${escapeHtml(label)}</span>
      </div>
    `;
  }

  function render() {
    if (!list) return;
    const keepBottom = shouldStickToBottom();
    const messages = Array.from(state.messages.values()).sort((a, b) => Number(a.id) - Number(b.id));

    if (state.loading) {
      if (empty) empty.classList.add('hidden');
      list.innerHTML = renderLoader('Загружаем чат…');
      return;
    }

    if (empty) empty.classList.toggle('hidden', messages.length > 0);
    list.innerHTML = messages.map((message) => {
      const own = message.is_own ? ' chat-message-own' : '';
      const pendingCls = message.pending ? ' pending' : '';
      const errorCls = message.error ? ' error' : '';
      const avatarHtml = message.is_own 
        ? '' 
        : (message.sender_avatar_url 
            ? `<div class="chat-message-avatar"><img src="${escapeHtml(message.sender_avatar_url)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;"></div>`
            : `<div class="chat-message-avatar">${escapeHtml((message.sender_name || 'У').slice(0, 1).toUpperCase())}</div>`
          );

      let statusIcon = '';
      if (message.pending) {
        statusIcon = '<span class="msg-status-icon pending-icon" style="opacity: 0.5; font-size: 10px; margin-left: 6px;" title="Отправка...">🕒</span>';
      } else if (message.error) {
        statusIcon = '<span class="msg-status-icon error-icon" style="color: #ff5555; font-size: 10px; margin-left: 6px;" title="Ошибка отправки">⚠️</span>';
      }

      let contentHtml = renderTextContent(message.text_content || '');
      if (message.type === 'audio_circle' && message.file_url) {
        contentHtml = `
          <div class="voice-player" data-src="${escapeHtml(message.file_url)}">
            <button class="voice-play-btn" type="button" aria-label="Проиграть">
              <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              <svg class="pause-icon hidden" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <div class="voice-waveform-wrap">
              <div class="voice-timeline">
                <div class="voice-progress"></div>
              </div>
              <span class="voice-duration">Голосовое сообщение</span>
            </div>
          </div>
        `;
      } else if ((message.type === 'video_circle' || message.type === 'video_attachment') && message.file_url) {
        contentHtml = `
          <div class="chat-video-circle-wrap" style="position: relative; overflow: visible; cursor: pointer;">
            <video class="chat-video-circle" src="${escapeHtml(message.file_url)}" playsinline webkit-playsinline muted autoplay preload="metadata" style="display: block; border-radius: 50%;"></video>
            <!-- SVG Progress Circle (fits exactly inside the 180px border) -->
            <svg class="chat-video-progress-svg" width="180" height="180" style="position: absolute; top: 0; left: 0; transform: rotate(-90deg); pointer-events: none; overflow: visible; z-index: 5;">
              <circle cx="90" cy="90" r="88" fill="transparent" stroke="rgba(255, 255, 255, 0.12)" stroke-width="3"></circle>
              <circle class="chat-video-progress-circle-bar" cx="90" cy="90" r="88" fill="transparent" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-dasharray="553" stroke-dashoffset="553" style="transition: stroke-dashoffset 0.1s linear;"></circle>
            </svg>
          </div>
        `;
      } else if (message.type === 'image_attachment' && message.file_url) {
        contentHtml = `
          <a class="chat-attachment chat-image-attachment" href="${escapeHtml(message.file_url)}" target="_blank" rel="noopener">
            <img src="${escapeHtml(message.file_url)}" alt="Прикрепленное изображение" loading="lazy" decoding="async" />
          </a>
          ${message.text_content ? renderTextContent(message.text_content) : ''}
        `;
      }

      return `
        <article class="chat-message${own}${pendingCls}${errorCls}" data-message-id="${escapeHtml(message.id)}">
          ${avatarHtml}
          <div class="chat-message-bubble">
            <div class="chat-message-meta">
              <span>${escapeHtml(message.sender_name || 'Участник')}</span>
              <time>${escapeHtml(timeLabel(message.created_at))}${statusIcon}</time>
            </div>
            ${renderReplyPreview(message.reply_to)}
            ${contentHtml}
            ${renderReactions(message.reactions)}
          </div>
        </article>
      `;
    }).join('');

    // Setup circular progress bars for video circles
    const circles = list.querySelectorAll('.chat-video-circle');
    circles.forEach((video) => {
      const wrap = video.closest('.chat-video-circle-wrap');
      const bar = wrap ? wrap.querySelector('.chat-video-progress-circle-bar') : null;
      if (!bar) return;

      video.addEventListener('timeupdate', () => {
        if (!video.duration) return;
        const progress = video.currentTime / video.duration;
        const offset = 553 - (progress * 553);
        bar.style.strokeDashoffset = offset;
      });
    });

    if (keepBottom) scrollToBottom();
  }

  render();

  list?.addEventListener('click', async (event) => {
    const reactionBtn = event.target.closest('.chat-reaction-chip');
    if (reactionBtn) {
      const article = reactionBtn.closest('.chat-message');
      const messageId = article?.dataset.messageId;
      const emoji = reactionBtn.dataset.reactionEmoji;
      if (messageId && emoji) {
        try {
          const data = await window.API.reactGeneralChatMessage(messageId, emoji);
          const message = state.messages.get(String(messageId));
          if (message) {
            message.reactions = data.reactions || [];
            state.messages.set(String(messageId), message);
            render();
          }
        } catch (err) {
          setStatus(err?.error || 'Не удалось поставить реакцию');
        }
      }
      return;
    }

    const replyBtn = event.target.closest('[data-scroll-reply]');
    if (replyBtn) {
      const target = list.querySelector(`[data-message-id="${CSS.escape(String(replyBtn.dataset.scrollReply))}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('chat-message-highlight');
        window.setTimeout(() => target.classList.remove('chat-message-highlight'), 1200);
      }
    }
  });

  function mergeMessages(messages) {
    let changed = false;
    (messages || []).forEach((message) => {
      if (!message || !message.id) return;
      const id = Number(message.id);
      if (id > state.latestId) state.latestId = id;
      const existing = state.messages.get(String(message.id));
      if (!existing || JSON.stringify(existing) !== JSON.stringify(message)) {
        state.messages.set(String(message.id), message);
        changed = true;
      }
    });
    if (changed) render();
  }

  async function loadMessages(silent) {
    try {
      if (!silent) setStatus('Загружаем чат…');
      const data = await window.API.getGeneralChatMessages(80);
      mergeMessages(data.messages || []);
      setStatus('Общий чат открыт');
    } catch (err) {
      setStatus(err?.error || 'Не удалось загрузить чат');
    }
  }

  // Helper to convert VAPID public key to Uint8Array for push manager
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Handle full Push subscription registration and saving to backend
  async function setupPushNotifications(silent = false) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported on this browser/device');
      return;
    }

    try {
      if (silent && Notification.permission !== 'granted') {
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const VAPID_PUBLIC_KEY = window.VAPID_PUBLIC_KEY || 'BJ2mtnvvuig_I_ZBVMQy4HaLMAeymgwY3fiSzLO81Vi7JQKpuknLALehKkQyEx7Y8RIqrzd0WTcP6xxxX7kTopI';
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      console.log('Successfully registered PushSubscription:', subscription);

      await window.API.request('POST', '/chat/subscribe', { subscription });
      console.log('PushSubscription successfully saved on backend');
    } catch (err) {
      console.error('Failed to configure Push Notifications:', err);
    }
  }

  function isStandalonePWA() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function getMobileOS() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    if (/android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
    return 'other';
  }

  // Handle display and actions of the top interactive permission banner
  function initNotificationBanner() {
    const banner = document.getElementById('notification-banner');
    if (!banner) return;

    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    const os = getMobileOS();
    const isStandalone = isStandalonePWA();

    // On iOS outside standalone PWA, push is technically impossible.
    // Show a smart banner prompting them to add to Home Screen.
    if (os === 'ios' && !isStandalone) {
      const bannerText = banner.querySelector('.notification-banner-text');
      const bannerButtons = banner.querySelector('.notification-banner-buttons');

      if (bannerText && bannerButtons) {
        bannerText.innerHTML = `
          <strong>Установите приложение для PUSH-уведомлений</strong>
          <span>Нажмите кнопку «Поделиться» внизу и выберите «На экран "Домой"».</span>
        `;
        bannerButtons.innerHTML = `
          <button class="banner-btn-decline" id="notification-decline-btn">Позже</button>
        `;

        if (localStorage.getItem('pwa-install-prompt-dismissed') === 'true') {
          return;
        }

        banner.classList.remove('hidden');

        document.getElementById('notification-decline-btn').addEventListener('click', () => {
          banner.classList.add('hidden');
          localStorage.setItem('pwa-install-prompt-dismissed', 'true');
        });
      }
      return;
    }

    if (Notification.permission === 'granted') {
      // Re-verify subscription with backend silently
      setupPushNotifications(true).catch(() => {});
      return;
    }

    if (Notification.permission === 'denied') {
      return;
    }

    if (localStorage.getItem('notifications-prompt-dismissed') === 'true') {
      return;
    }

    // Show banner since permission is default and user hasn't explicitly dismissed it
    banner.classList.remove('hidden');

    const acceptBtn = document.getElementById('notification-accept-btn');
    const declineBtn = document.getElementById('notification-decline-btn');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', async () => {
        banner.classList.add('hidden');
        await setupPushNotifications(false);
      });
    }

    if (declineBtn) {
      declineBtn.addEventListener('click', () => {
        banner.classList.add('hidden');
        localStorage.setItem('notifications-prompt-dismissed', 'true');
      });
    }
  }

  function openSubscriptionModal() {
    if (document.getElementById('ios-subscription-modal')) return;

    const style = document.createElement('style');
    style.id = 'ios-sub-modal-styles';
    style.textContent = `
      .ios-sub-modal {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .ios-sub-modal.active {
        opacity: 1;
        pointer-events: auto;
      }
      .ios-sub-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }
      .ios-sub-modal-card {
        position: relative;
        width: 100%;
        max-width: 420px;
        background: radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.12), transparent 45%), #0c0d12;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 38px;
        padding: 32px 24px 28px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2);
        color: #fff;
        text-align: center;
        transform: scale(0.9) translateY(20px);
        transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        display: flex;
        flex-direction: column;
        align-items: center;
        overflow: hidden;
      }
      .ios-sub-modal.active .ios-sub-modal-card {
        transform: scale(1) translateY(0);
      }
      .ios-sub-modal-close {
        position: absolute;
        top: 20px;
        right: 20px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.5);
        font-size: 20px;
        display: grid;
        place-items: center;
        cursor: pointer;
        transition: background 0.2s, color 0.2s;
        padding: 0;
        line-height: 1;
      }
      .ios-sub-modal-close:hover {
        background: rgba(255, 255, 255, 0.15);
        color: #fff;
      }
      .ios-sub-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 100px;
        padding: 6px 14px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.85);
        margin-bottom: 20px;
      }
      .ios-sub-title {
        font-size: 28px;
        font-weight: 800;
        letter-spacing: -0.04em;
        margin: 0 0 10px;
        line-height: 1.1;
      }
      .ios-sub-desc {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.55);
        margin: 0 0 24px;
        line-height: 1.5;
        max-width: 300px;
      }
      .ios-sub-features {
        width: 100%;
        list-style: none;
        padding: 0;
        margin: 0 0 28px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        text-align: left;
      }
      .ios-sub-feature-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.85);
        line-height: 1.4;
      }
      .ios-sub-feature-icon {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        display: grid;
        place-items: center;
        flex-shrink: 0;
        font-size: 11px;
        font-weight: 700;
      }
      .ios-sub-btn-buy {
        width: 100%;
        min-height: 52px;
        border-radius: 100px;
        background: #fff;
        color: #000;
        border: none;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: -0.01em;
        cursor: pointer;
        transition: opacity 0.2s, transform 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        box-shadow: 0 10px 25px rgba(255, 255, 255, 0.15);
      }
      .ios-sub-btn-buy:hover {
        opacity: 0.92;
        transform: translateY(-1px);
      }
      .ios-sub-btn-buy:active {
        transform: translateY(1px);
      }
      .ios-sub-footer {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.35);
        margin-top: 14px;
        line-height: 1.4;
      }
      @media (max-width: 520px) {
        .ios-sub-modal {
          align-items: center;
          padding: max(14px, env(safe-area-inset-top, 0px)) 10px max(14px, env(safe-area-inset-bottom, 0px));
        }
        .ios-sub-modal-backdrop {
          background: rgba(0, 0, 0, 0.62);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .ios-sub-modal-card {
          max-width: none;
          border-radius: 26px;
          padding: 20px 16px 16px;
          box-shadow: 0 18px 52px rgba(0, 0, 0, 0.54), inset 0 1px 0 rgba(255, 255, 255, 0.16);
        }
        .ios-sub-modal-close {
          top: 14px;
          right: 14px;
          width: 28px;
          height: 28px;
          font-size: 18px;
        }
        .ios-sub-badge {
          padding: 5px 11px;
          font-size: 10px;
          margin-bottom: 12px;
        }
        .ios-sub-title {
          font-size: 22px;
          line-height: 1.08;
          letter-spacing: -0.035em;
          margin-bottom: 8px;
          max-width: 280px;
        }
        .ios-sub-desc {
          font-size: 12.5px;
          line-height: 1.38;
          margin-bottom: 14px;
          max-width: 310px;
        }
        .ios-sub-features {
          gap: 9px;
          margin-bottom: 16px;
        }
        .ios-sub-feature-item {
          gap: 9px;
          font-size: 12.5px;
          line-height: 1.32;
        }
        .ios-sub-feature-icon {
          width: 18px;
          height: 18px;
          font-size: 10px;
        }
        .ios-sub-btn-buy {
          min-height: 46px;
          border-radius: 18px;
          font-size: 14px;
          gap: 6px;
        }
        .ios-sub-footer {
          margin-top: 10px;
          font-size: 10px;
          line-height: 1.3;
        }
      }
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'ios-subscription-modal';
    modal.className = 'ios-sub-modal';
    modal.innerHTML = `
      <div class="ios-sub-modal-backdrop"></div>
      <div class="ios-sub-modal-card">
        <button class="ios-sub-modal-close" type="button" aria-label="Закрыть">×</button>
        <div class="ios-sub-badge">Подписка Pro</div>
        <h2 class="ios-sub-title">Доступ в общий чат<br>Системы Молодцова</h2>
        <p class="ios-sub-desc">Подписка открывает Общий чат участников, все видео-разделы и расширенный доступ к Лизе — AI-помощнице системы.</p>
        
        <ul class="ios-sub-features">
          <li class="ios-sub-feature-item">
            <span class="ios-sub-feature-icon">✓</span>
            <span><strong>Общий чат:</strong> Живое общение, обмен опытом и поддержка участников.</span>
          </li>
          <li class="ios-sub-feature-item">
            <span class="ios-sub-feature-icon">✓</span>
            <span><strong>Лиза AI:</strong> Бережная помощь по материалам, курсам и практикам системы.</span>
          </li>
          <li class="ios-sub-feature-item">
            <span class="ios-sub-feature-icon">✓</span>
            <span><strong>Все материалы:</strong> Полный доступ к видео-разделам, аудио и практикам.</span>
          </li>
        </ul>

        <label style="display:flex;gap:10px;align-items:flex-start;margin:0 0 12px;color:rgba(255,255,255,.58);font-size:11.5px;line-height:1.45;text-align:left">
          <input data-payment-legal type="checkbox" style="width:20px;height:20px;margin:1px 0 0;flex:0 0 auto;accent-color:#4f7cff">
          <span>Я принимаю <a href="/offer/" target="_blank" rel="noopener noreferrer" style="color:rgba(255,255,255,.86);text-decoration:underline">оферту</a> и <a href="/terms/" target="_blank" rel="noopener noreferrer" style="color:rgba(255,255,255,.86);text-decoration:underline">пользовательское соглашение</a></span>
        </label>
        <button class="ios-sub-btn-buy" id="ios-sub-buy-btn" type="button" disabled style="opacity:.55">
          <span>Активировать подписку Pro</span>
          <span style="font-weight: 400; opacity: 0.6;">—</span>
          <span id="ios-sub-price-val">Загрузка...</span>
        </button>
        <p class="ios-sub-footer">Оплата проходит через защищённый шлюз ЮKassa. Для теста подписка действует 5 минут.</p>
      </div>
    `;

    document.body.appendChild(modal);

    setTimeout(() => modal.classList.add('active'), 20);
    if (window.injectTrialOption) window.injectTrialOption(modal);

    const closeBtn = modal.querySelector('.ios-sub-modal-close');
    const backdrop = modal.querySelector('.ios-sub-modal-backdrop');
    const buyBtn = modal.querySelector('#ios-sub-buy-btn');

    const handleClose = () => {
      if (modal.dataset.paymentInitiated === 'true') {
        buyBtn.disabled = false;
        buyBtn.style.opacity = '1';
        buyBtn.innerHTML = '<span>Оформить подписку</span><span style="font-weight:400;opacity:.6">—</span><span>2990 ₽</span>';
        delete modal.dataset.paymentInitiated;
      }
      modal.classList.remove('active');
      setTimeout(() => {
        modal.remove();
        style.remove();
        window.location.href = '/';
      }, 400);
    };

    closeBtn.addEventListener('click', handleClose);
    backdrop.addEventListener('click', handleClose);
    modal.querySelector('[data-payment-legal]')?.addEventListener('change', (event) => {
      buyBtn.disabled = !event.target.checked;
      buyBtn.style.opacity = event.target.checked ? '1' : '.55';
    });

    let targetPlanSlug = 'monthly';
    window.API.getPlans()
      .then(data => {
        var p = data && data.plans && data.plans.find(x => x.slug === 'monthly');
        if (p) {
          targetPlanSlug = p.slug;
        }
        modal.querySelector('#ios-sub-price-val').textContent = '2990 ₽';
      })
      .catch(() => {
        modal.querySelector('#ios-sub-price-val').textContent = '2990 ₽';
      });

    buyBtn.addEventListener('click', async () => {
      if (!window.requirePaymentLegalAccepted(modal)) return;
      buyBtn.disabled = true;
      buyBtn.style.opacity = '0.7';
      const originalText = buyBtn.innerHTML;
      buyBtn.innerHTML = 'Подготовка оплаты...';

      if (!window.API.isLoggedIn()) {
        if (window.openAuthModal) {
          window.openAuthModal('login');
          window.addEventListener('auth:change', function handler() {
            window.removeEventListener('auth:change', handler);
            buyBtn.disabled = false;
            buyBtn.style.opacity = '1';
            buyBtn.innerHTML = originalText;
            buyBtn.click();
          }, { once: true });
        } else {
          alert('Пожалуйста, авторизуйтесь для совершения покупки.');
          buyBtn.disabled = false;
          buyBtn.style.opacity = '1';
          buyBtn.innerHTML = originalText;
        }
        return;
      }

      try {
        const res = await window.API.createPayment({ plan_slug: targetPlanSlug, provider: 'yookassa' });
        if (window.API.redirectToPayment(res)) {
          modal.dataset.paymentInitiated = 'true';
          return;
        } else {
          alert('Ошибка создания платежа');
          buyBtn.disabled = false;
          buyBtn.style.opacity = '1';
          buyBtn.innerHTML = originalText;
        }
      } catch (err) {
        alert(err.error || 'Ошибка при переходе к оплате. Попробуйте позже.');
        buyBtn.disabled = false;
        buyBtn.style.opacity = '1';
        buyBtn.innerHTML = originalText;
      }
    });
  }

  window.openSubscriptionModalForAccess = openSubscriptionModal;

  installChatSettingsButton();

  async function boot() {
    try {
      setStatus('Подключаемся…');
      installChatSettingsButton();
      if (window.API.restoreSession) await window.API.restoreSession();
      if (window.API.maybeConfirmPayment) {
        try { await window.API.maybeConfirmPayment(); } catch (e) { /* continue with fresh subscription check */ }
      }
      const chatData = await window.API.getGeneralChat();
      state.userId = chatData?.user?.id || null;
      state.userRole = chatData?.user?.role || 'user';
      state.canSendMedia = !!chatData?.permissions?.can_send_media;
      updateComposerMediaAccess();
      try {
        const dashboard = await window.API.request('GET', '/profile/dashboard', null, { fresh: true });
        if (typeof dashboard?.user?.chat_email_notifications_enabled === 'boolean') {
          state.emailNotificationsEnabled = dashboard.user.chat_email_notifications_enabled;
        }
      } catch (e) {
        // Settings sheet will fall back to enabled until profile is available.
      }
      await loadMessages(true);
      connectSocket();
      installChatSettingsButton();
      setTimeout(installChatSettingsButton, 350);
    const mobileHeader = document.getElementById('app-mobile-header');
    if (mobileHeader) {
      const observer = new MutationObserver(() => installChatSettingsButton());
      observer.observe(mobileHeader, { childList: true, subtree: true });
    }

      // Configure interactive Web Push notification flow
      initNotificationBanner();
    } catch (err) {
      if (err && (err.status === 403 || err.code === 'NO_SUBSCRIPTION')) {
        setStatus('Требуется подписка Pro');
        openSubscriptionModal();
      } else {
        setStatus(err?.error || 'Чат временно недоступен');
      }
    } finally {
      state.loading = false;
      render();
    }
  }

  function connectSocket() {
    if (!window.io) {
      setStatus('Чат открыт. Realtime недоступен');
      return;
    }
    const socketOrigin = new URL(window.API.base, location.href).origin;
    state.socket = window.io(socketOrigin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: { token: window.API.accessToken || '' },
    });
    
    state.socket.on('connect', () => {
      state.socket.emit('chat:join', { room: 'general', token: window.API.accessToken || '' }, (ack) => {
        if (ack && ack.ok) {
          setStatus('Общий чат онлайн');
        } else if (ack && ack.code === 'NO_SUBSCRIPTION') {
          setStatus('Требуется подписка Pro');
          openSubscriptionModal();
        } else {
          setStatus('Realtime недоступен');
        }
      });
      
      // Auto Catch-up Sync after connection (if we missed messages while offline)
      if (state.latestId > 0) {
        window.API.getGeneralChatMessages(100, null, state.latestId)
          .then((res) => {
            if (res && res.messages && res.messages.length > 0) {
              mergeMessages(res.messages);
            }
          })
          .catch((err) => console.error('[reconnect-sync] Failed:', err));
      }
    });

    // Handle Page Visibility change (revive socket immediately when app wakes up from freeze)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.socket) {
        if (!state.socket.connected) {
          setStatus('Восстанавливаем подключение…');
          state.socket.connect();
        } else if (state.latestId > 0) {
          window.API.getGeneralChatMessages(100, null, state.latestId)
            .then((res) => {
              if (res && res.messages && res.messages.length > 0) {
                mergeMessages(res.messages);
              }
            })
            .catch((err) => console.error('[visibility-sync] Failed:', err));
        }
      }
    });

    state.socket.on('chat.message.created', (message) => {
      const isOwn = Number(message.sender_id) === Number(state.userId);
      mergeMessages([{ ...message, is_own: isOwn }]);

      // Trigger native notification if window is hidden/unfocused and message is from another user
      if (!isOwn && 'Notification' in window && Notification.permission === 'granted') {
        if (document.hidden || !document.hasFocus()) {
          const senderName = message.sender_name || 'Собеседник';
          let bodyText = message.text || '';
          if (message.audio_key) {
            bodyText = '🎵 Голосовое сообщение';
          } else if (message.video_slug) {
            bodyText = '🎥 Видеосообщение';
          } else if (message.file_key) {
            bodyText = '📎 Прикрепленный файл';
          }

          new Notification(senderName, {
            body: bodyText,
            icon: '/assets/icon-192.png',
            tag: 'chat-msg-' + message.id,
            renotify: true,
          });
        }
      }
    });
    state.socket.on('chat.message.updated', (message) => {
      const existing = state.messages.get(String(message.id)) || {};
      state.messages.set(String(message.id), {
        ...existing,
        ...message,
        is_own: Number(message.sender_id) === Number(state.userId)
      });
      render();
    });
    state.socket.on('chat.message.deleted', (data) => {
      state.messages.delete(String(data.id));
      render();
    });
    state.socket.on('chat.message.reactions', (payload) => {
      if (!payload || !payload.message_id) return;
      const message = state.messages.get(String(payload.message_id));
      if (!message) return;
      message.reactions = payload.reactions || [];
      state.messages.set(String(payload.message_id), message);
      render();
    });
    state.socket.on('connect_error', () => {
      setStatus('Чат открыт. Переподключаемся…');
    });
    state.socket.on('disconnect', () => {
      setStatus('Соединение с чатом потеряно');
    });
  }

  // Spawns iOS-style bottom Action Sheet context menu (Telegram style)
  function showMessageContextMenu(messageId, isOwn, ev) {
    ev?.preventDefault();
    ev?.stopPropagation();

    const msg = state.messages.get(String(messageId));
    if (!msg) return;

    // Remove existing sheet
    const existing = document.getElementById('chat-action-sheet');
    if (existing) existing.remove();

    const sheet = document.createElement('div');
    sheet.id = 'chat-action-sheet';
    sheet.className = 'ios-action-sheet';

    const ownButtons = `
      <button class="action-sheet-btn action-reply" data-action="reply">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v1"/></svg>
        <span>Ответить</span>
      </button>
      <button class="action-sheet-btn action-edit" data-action="edit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <span>Редактировать</span>
      </button>
      <button class="action-sheet-btn action-delete-all text-danger" data-action="delete-all">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span>Удалить у всех</span>
      </button>
    `;

    const otherButtons = `
      <button class="action-sheet-btn action-reply" data-action="reply">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v1"/></svg>
        <span>Ответить</span>
      </button>
      <button class="action-sheet-btn action-delete-self text-danger" data-action="delete-self">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span>Удалить у себя</span>
      </button>
    `;

    sheet.innerHTML = `
      <div class="action-sheet-overlay"></div>
      <div class="action-sheet-body">
        <div class="action-sheet-header">Сообщение от ${escapeHtml(msg.sender_name || 'участника')}</div>
        <div class="action-sheet-reactions">
          ${['❤️', '👍', '🔥', '🙏', '😂', '😮'].map((emoji) => `<button type="button" data-reaction="${emoji}">${emoji}</button>`).join('')}
        </div>
        <div class="action-sheet-group">
          ${isOwn ? ownButtons : otherButtons}
        </div>
        <div class="action-sheet-group">
          <button class="action-sheet-btn action-cancel" data-action="cancel">Отмена</button>
        </div>
      </div>
    `;

    document.body.appendChild(sheet);

    // Smooth animation layout trigger
    setTimeout(() => sheet.classList.add('active'), 20);

    const closeSheet = () => {
      sheet.classList.remove('active');
      setTimeout(() => sheet.remove(), 300);
    };

    sheet.querySelector('.action-sheet-overlay').addEventListener('click', closeSheet);
    sheet.querySelector('.action-cancel').addEventListener('click', closeSheet);
    sheet.querySelectorAll('[data-reaction]').forEach((button) => {
      button.addEventListener('click', async () => {
        const emoji = button.dataset.reaction;
        closeSheet();
        try {
          const data = await window.API.reactGeneralChatMessage(messageId, emoji);
          const message = state.messages.get(String(messageId));
          if (message) {
            message.reactions = data.reactions || [];
            state.messages.set(String(messageId), message);
            render();
          }
        } catch (err) {
          setStatus(err?.error || 'Не удалось поставить реакцию');
        }
      });
    });

    sheet.addEventListener('click', async (e) => {
      const btn = e.target.closest('.action-sheet-btn');
      if (!btn) return;
      const action = btn.dataset.action;
      if (!action || action === 'cancel') return;

      closeSheet();

      if (action === 'reply') {
        setReply(msg);
      } else if (action === 'edit') {
        state.editingMessageId = String(messageId);
        clearReply();
        input.value = msg.text_content || '';
        editBanner.classList.remove('hidden');
        input.focus();
        if (input.tagName === 'TEXTAREA') {
          input.style.height = 'auto';
          input.style.height = input.scrollHeight + 'px';
        }
      } else if (action === 'delete-all') {
        if (confirm('Вы уверены, что хотите удалить это сообщение у всех участников?')) {
          try {
            await window.API.deleteGeneralChatMessage(messageId);
            state.messages.delete(String(messageId));
            render();
            setStatus('Сообщение удалено');
            window.setTimeout(() => setStatus('Общий чат открыт'), 1200);
          } catch (err) {
            alert(err?.error || 'Не удалось удалить сообщение');
          }
        }
      } else if (action === 'delete-self') {
        // Local removal
        state.messages.delete(String(messageId));
        render();
        setStatus('Сообщение удалено у вас');
        window.setTimeout(() => setStatus('Общий чат открыт'), 1200);
      }
    });
  }

  // Pure Hold/Long-press detection
  let touchTimer = null;
  let hasMoved = false;
  let startX = 0;
  let startY = 0;
  let swipeTargetMsg = null;
  let swipeMessageId = null;
  let swipeReplyArmed = false;

  const handleStart = (ev, targetMsg) => {
    hasMoved = false;
    swipeTargetMsg = targetMsg;
    swipeMessageId = targetMsg.getAttribute('data-message-id');
    swipeReplyArmed = false;
    const touch = ev.touches ? ev.touches[0] : ev;
    startX = touch.clientX;
    startY = touch.clientY;

    const id = targetMsg.getAttribute('data-message-id');
    const isOwn = targetMsg.classList.contains('chat-message-own');

    touchTimer = setTimeout(() => {
      if (!hasMoved) {
        triggerHapticFeedback();
        showMessageContextMenu(id, isOwn, ev);
      }
    }, 550); // 550ms Telegram-style hold threshold
  };

  const handleMove = (ev) => {
    const touch = ev.touches ? ev.touches[0] : ev;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      hasMoved = true;
      if (touchTimer) clearTimeout(touchTimer);
    }

    if (!swipeTargetMsg || Math.abs(dy) > Math.abs(dx) * 0.7 || dx <= 0) return;
    const offset = Math.min(58, Math.max(0, dx));
    swipeTargetMsg.classList.add('chat-message-swiping');
    swipeTargetMsg.style.setProperty('--chat-swipe-x', `${offset}px`);
    const armed = offset >= 42;
    if (armed && !swipeReplyArmed) triggerHapticFeedback();
    swipeReplyArmed = armed;
    swipeTargetMsg.classList.toggle('chat-message-reply-armed', armed);
  };

  const handleEnd = () => {
    if (touchTimer) clearTimeout(touchTimer);
    if (swipeTargetMsg) {
      const msg = state.messages.get(String(swipeMessageId));
      if (swipeReplyArmed && msg) {
        setReply(msg);
      }
      swipeTargetMsg.classList.remove('chat-message-swiping', 'chat-message-reply-armed');
      swipeTargetMsg.style.removeProperty('--chat-swipe-x');
    }
    swipeTargetMsg = null;
    swipeMessageId = null;
    swipeReplyArmed = false;
  };

  list?.addEventListener('touchstart', (ev) => {
    const targetMsg = ev.target.closest('.chat-message');
    if (targetMsg) handleStart(ev, targetMsg);
  }, { passive: true });

  list?.addEventListener('touchmove', handleMove, { passive: true });
  list?.addEventListener('touchend', handleEnd, { passive: true });
  list?.addEventListener('touchcancel', handleEnd, { passive: true });

  list?.addEventListener('mousedown', (ev) => {
    const targetMsg = ev.target.closest('.chat-message');
    if (targetMsg) handleStart(ev, targetMsg);
  });
  list?.addEventListener('mousemove', handleMove);
  list?.addEventListener('mouseup', handleEnd);
  list?.addEventListener('mouseleave', handleEnd);

  // Prevent browser context menus on messages
  list?.addEventListener('contextmenu', (ev) => {
    if (ev.target.closest('.chat-message')) {
      ev.preventDefault();
    }
  });

  // Custom Audio Player click & seek handlers
  let activeAudio = null;
  let activePlayerEl = null;

  function openVideoModal(videoSrc) {
    const modal = document.createElement('div');
    modal.className = 'telegram-video-modal';
    modal.innerHTML = `
      <div class="video-modal-backdrop"></div>
      <div class="video-modal-content" style="position: relative;">
        <button class="video-modal-close" type="button" aria-label="Закрыть" style="z-index: 12;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <video class="video-modal-player" src="${escapeHtml(videoSrc)}" autoplay playsinline loop style="display: block; border-radius: 50%; width: 100%; height: 100%; object-fit: cover;"></video>
        
        <!-- White Circular Progress SVG -->
        <svg class="video-modal-progress-svg" width="100%" height="100%" viewBox="0 0 180 180" style="position: absolute; inset: 0; transform: rotate(-90deg); pointer-events: none; overflow: visible; z-index: 5;">
          <circle cx="90" cy="90" r="88" fill="transparent" stroke="rgba(255, 255, 255, 0.15)" stroke-width="3"></circle>
          <circle class="video-modal-progress-circle-bar" cx="90" cy="90" r="88" fill="transparent" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-dasharray="553" stroke-dashoffset="553" style="transition: stroke-dashoffset 0.1s linear;"></circle>
        </svg>

        <!-- Custom Glassmorphic Controls Overlay -->
        <div class="video-modal-controls" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 20px; z-index: 6; pointer-events: none; opacity: 0; transition: opacity 0.25s ease;">
          <button class="modal-control-btn seek-back" style="pointer-events: auto; background: rgba(0,0,0,0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%; width: 46px; height: 46px; display: grid; place-items: center; color: white; cursor: pointer; position: relative;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:20px;height:20px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            <span style="font-size: 8px; font-weight: 800; position: absolute; margin-top: 1px; color: #fff; font-family: system-ui, sans-serif;">10</span>
          </button>
          <button class="modal-control-btn play-pause" style="pointer-events: auto; background: rgba(0,0,0,0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%; width: 58px; height: 58px; display: grid; place-items: center; color: white; cursor: pointer;">
            <svg class="modal-play-icon" viewBox="0 0 24 24" fill="currentColor" style="width:24px;height:24px;display:none;"><path d="M8 5v14l11-7z"/></svg>
            <svg class="modal-pause-icon" viewBox="0 0 24 24" fill="currentColor" style="width:24px;height:24px;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          </button>
          <button class="modal-control-btn seek-forward" style="pointer-events: auto; background: rgba(0,0,0,0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%; width: 46px; height: 46px; display: grid; place-items: center; color: white; cursor: pointer; position: relative;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:20px;height:20px;"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
            <span style="font-size: 8px; font-weight: 800; position: absolute; margin-top: 1px; color: #fff; font-family: system-ui, sans-serif;">10</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const video = modal.querySelector('.video-modal-player');
    const bar = modal.querySelector('.video-modal-progress-circle-bar');
    const controls = modal.querySelector('.video-modal-controls');
    const playBtn = modal.querySelector('.play-pause');
    const playIcon = modal.querySelector('.modal-play-icon');
    const pauseIcon = modal.querySelector('.modal-pause-icon');
    const seekBack = modal.querySelector('.seek-back');
    const seekForward = modal.querySelector('.seek-forward');

    // Fade in
    setTimeout(() => modal.classList.add('active'), 20);

    let controlsTimeout;
    const showControls = () => {
      controls.style.opacity = '1';
      clearTimeout(controlsTimeout);
      controlsTimeout = setTimeout(() => {
        if (!video.paused) {
          controls.style.opacity = '0';
        }
      }, 2500);
    };

    modal.querySelector('.video-modal-content').addEventListener('click', (e) => {
      if (e.target.closest('.modal-control-btn') || e.target.closest('.video-modal-close')) return;
      showControls();
    });

    video.addEventListener('timeupdate', () => {
      if (!video.duration) return;
      const progress = video.currentTime / video.duration;
      const offset = 553 - (progress * 553);
      bar.style.strokeDashoffset = offset;
    });

    const updatePlayPauseIcons = () => {
      if (video.paused) {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        controls.style.opacity = '1';
        clearTimeout(controlsTimeout);
      } else {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        showControls();
      }
    };

    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
      updatePlayPauseIcons();
    });

    seekBack.addEventListener('click', (e) => {
      e.stopPropagation();
      video.currentTime = Math.max(0, video.currentTime - 10);
      showControls();
    });

    seekForward.addEventListener('click', (e) => {
      e.stopPropagation();
      video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
      showControls();
    });

    const closeModal = () => {
      modal.classList.remove('active');
      video.pause();
      setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('.video-modal-backdrop').addEventListener('click', closeModal);
    modal.querySelector('.video-modal-close').addEventListener('click', closeModal);

    showControls();
  }

  list?.addEventListener('click', (e) => {
    // 0. Handle Video Circle Clicks
    const videoCircle = e.target.closest('.chat-video-circle');
    if (videoCircle) {
      e.preventDefault();
      e.stopPropagation();
      openVideoModal(videoCircle.src);
      return;
    }

    // 1. Handle Play/Pause Button
    const playBtn = e.target.closest('.voice-play-btn');
    if (playBtn) {
      const playerEl = playBtn.closest('.voice-player');
      const url = playerEl.dataset.src;
      const playIcon = playBtn.querySelector('.play-icon');
      const pauseIcon = playBtn.querySelector('.pause-icon');
      const progressBar = playerEl.querySelector('.voice-progress');
      const durationLabel = playerEl.querySelector('.voice-duration');

      // If there is an active audio playing elsewhere, pause it
      if (activeAudio && activePlayerEl !== playerEl) {
        activeAudio.pause();
        const oldPlayBtn = activePlayerEl.querySelector('.voice-play-btn');
        if (oldPlayBtn) {
          oldPlayBtn.querySelector('.play-icon').classList.remove('hidden');
          oldPlayBtn.querySelector('.pause-icon').classList.add('hidden');
        }
      }

      if (activePlayerEl === playerEl && activeAudio) {
        if (activeAudio.paused) {
          activeAudio.play()
            .then(() => {
              playIcon.classList.add('hidden');
              pauseIcon.classList.remove('hidden');
            })
            .catch(err => console.error('Audio play failed:', err));
        } else {
          activeAudio.pause();
          playIcon.classList.remove('hidden');
          pauseIcon.classList.add('hidden');
        }
      } else {
        const audio = new Audio(url);
        audio.preload = 'auto';
        activeAudio = audio;
        activePlayerEl = playerEl;

        audio.addEventListener('timeupdate', () => {
          if (audio.duration) {
            const percent = (audio.currentTime / audio.duration) * 100;
            progressBar.style.width = percent + '%';
            const curMin = Math.floor(audio.currentTime / 60);
            const curSec = Math.floor(audio.currentTime % 60).toString().padStart(2, '0');
            const durMin = Math.floor(audio.duration / 60);
            const durSec = Math.floor(audio.duration % 60).toString().padStart(2, '0');
            durationLabel.textContent = `${curMin}:${curSec} / ${durMin}:${durSec}`;
          }
        });

        audio.addEventListener('loadedmetadata', () => {
          const durMin = Math.floor(audio.duration / 60);
          const durSec = Math.floor(audio.duration % 60).toString().padStart(2, '0');
          durationLabel.textContent = `0:00 / ${durMin}:${durSec}`;
        });

        audio.addEventListener('ended', () => {
          playIcon.classList.remove('hidden');
          pauseIcon.classList.add('hidden');
          progressBar.style.width = '0%';
          durationLabel.textContent = 'Голосовое сообщение';
          activeAudio = null;
          activePlayerEl = null;
        });

        audio.play()
          .then(() => {
            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');
          })
          .catch(err => {
            console.error('Audio play failed:', err);
          });
      }
      return;
    }

    // 2. Handle Timeline Clicks (seeking)
    const timeline = e.target.closest('.voice-timeline');
    if (timeline) {
      const playerEl = timeline.closest('.voice-player');
      if (activePlayerEl === playerEl && activeAudio && activeAudio.duration) {
        const rect = timeline.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const percent = clickX / width;
        activeAudio.currentTime = percent * activeAudio.duration;
      }
    }
  });

  // Keep the fixed chat composer above mobile keyboards and Android system navigation.
  if (window.visualViewport) {
    const onViewportResize = () => {
      const viewport = window.visualViewport;
      const bottomGap = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
      const inputFocused = document.activeElement === input;
      const systemBottom = !inputFocused && bottomGap > 0 && bottomGap < 96 ? bottomGap : 0;
      const keyboardHeight = inputFocused && bottomGap >= 96 ? bottomGap : 0;

      root.style.setProperty('--chat-viewport-height', `${Math.floor(viewport.height)}px`);
      root.style.setProperty('--chat-keyboard-height', `${keyboardHeight}px`);
      root.style.setProperty('--chat-system-bottom', `${systemBottom}px`);
      scrollToBottom();
    };
    window.visualViewport.addEventListener('resize', onViewportResize);
    window.visualViewport.addEventListener('scroll', onViewportResize);
    window.addEventListener('resize', onViewportResize);
    input?.addEventListener('focus', onViewportResize);
    input?.addEventListener('blur', () => window.setTimeout(onViewportResize, 80));
    onViewportResize();
  }

  // Prevent flying input box after iOS keyboard dismisses
  input?.addEventListener('blur', () => {
    window.scrollTo(0, 0);
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input?.value.trim();
    if (!text || state.sending) return;
    state.sending = true;
    if (sendButton) sendButton.disabled = true;
    try {
      if (state.editingMessageId) {
        const data = await window.API.updateGeneralChatMessage(state.editingMessageId, text);
        const existing = state.messages.get(String(state.editingMessageId)) || {};
        state.messages.set(String(state.editingMessageId), {
          ...existing,
          ...data.message,
          is_own: true
        });
        state.editingMessageId = null;
        editBanner.classList.add('hidden');
        setStatus('Сообщение изменено');
      } else {
        // Optimistic UI Send
        const tempId = `optimistic-${Date.now()}`;
        const mockMsg = {
          id: tempId,
          sender_id: state.userId,
          sender_name: window.__sistemaCurrentUser?.display_name || 'Я',
          reply_to_message_id: state.replyToMessage?.id || null,
          reply_to: state.replyToMessage ? {
            id: state.replyToMessage.id,
            sender_name: state.replyToMessage.sender_name || 'Участник',
            text_content: state.replyToMessage.text_content || null,
            type: state.replyToMessage.type || 'text',
          } : null,
          reactions: [],
          type: 'text',
          text_content: text,
          created_at: new Date().toISOString(),
          is_own: true,
          pending: true
        };
        
        // Render instantly
        state.messages.set(tempId, mockMsg);
        render();
        scrollToBottom();

        try {
          const data = await window.API.sendGeneralChatMessage(text, {
            reply_to_message_id: state.replyToMessage?.id || null,
          });
          // Clean up temp and merge actual published message
          state.messages.delete(tempId);
          mergeMessages(data.message ? [data.message] : []);
          clearReply();
          setStatus('Сообщение отправлено');
        } catch (err) {
          // Mark error state so user can retry or see failure
          mockMsg.pending = false;
          mockMsg.error = true;
          state.messages.set(tempId, mockMsg);
          render();
          throw err;
        }
      }
      input.value = '';
      clearReply();
      if (input.tagName === 'TEXTAREA') {
        input.style.height = 'auto';
      }
      render();
      scrollToBottom();
      window.setTimeout(() => setStatus('Общий чат открыт'), 1200);
    } catch (err) {
      setStatus(err?.error || 'Не удалось отправить сообщение');
    } finally {
      state.sending = false;
      if (sendButton) sendButton.disabled = false;
      input?.focus();
    }
  });

  // ─── Admin Media Logic (voice recording + gallery attachments) ───
  const recOverlay = document.getElementById('chat-rec-overlay');
  const previewWrap = document.getElementById('rec-video-preview-wrap');
  const videoPreview = document.getElementById('rec-video-preview');
  const recTimer = document.getElementById('rec-timer');
  const cancelBtn = document.getElementById('rec-cancel-btn');
  const stopBtn = document.getElementById('rec-stop-btn');

  const hasMediaSupport = typeof MediaRecorder !== 'undefined' && 
                          navigator.mediaDevices && 
                          typeof navigator.mediaDevices.getUserMedia === 'function';

  let mediaRecorder = null;
  let recordedChunks = [];
  let recordStream = null;
  let timerInterval = null;
  let recordingStartTime = 0;

  const startRecording = async (type) => {
    if (!state.canSendMedia) return;
    if (!hasMediaSupport) {
      alert('Запись аудио не поддерживается вашим браузером, или соединение не защищено (требуется HTTPS).');
      return;
    }
    try {
      recordedChunks = [];
      
      const constraints = {
        audio: true,
        video: type === 'video' ? { facingMode: 'user' } : false
      };
      
      recordStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (type === 'video') {
        previewWrap?.classList.remove('hidden');
        if (videoPreview) {
          videoPreview.srcObject = recordStream;
        }
      } else {
        previewWrap?.classList.add('hidden');
      }
      
      // Determine optimal mime type for cross-platform support (Chrome/iOS Safari)
      let options = {};
      if (type === 'video') {
        const candidates = [
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4',
          'video/quicktime',
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm'
        ];
        const chosen = candidates.find(mime => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mime));
        if (chosen) {
          options.mimeType = chosen;
        }
      } else {
        const candidates = [
          'audio/mp4',
          'audio/aac',
          'audio/webm;codecs=opus',
          'audio/webm'
        ];
        const chosen = candidates.find(mime => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mime));
        if (chosen) {
          options.mimeType = chosen;
        }
      }
      
      mediaRecorder = new MediaRecorder(recordStream, options);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };
      
      mediaRecorder.onstop = async () => {
        const mime = mediaRecorder.mimeType || (type === 'video' ? 'video/mp4' : 'audio/mp4');
        const blob = new Blob(recordedChunks, { type: mime });
        
        stopStream();
        
        if (recordedChunks.length === 0 || blob.size === 0) {
          alert('Не удалось записать медиафайл.');
          return;
        }
        
        await uploadAndSendMedia(blob, type, mime);
      };
      
      recOverlay?.classList.remove('hidden');
      mediaRecorder.start();
      
      // Start timer
      recordingStartTime = performance.now();
      updateTimer();
      timerInterval = setInterval(updateTimer, 500);
      
    } catch (err) {
      console.error(err);
      if (err.name === 'NotAllowedError' || err.message.includes('not allowed') || err.message.includes('permission')) {
        alert('Доступ к микрофону или камере заблокирован в настройках вашего iPhone.\n\nПожалуйста, нажмите на кнопку настроек (иконка "аА" или значок замка слева в адресной строке Safari) и разрешите доступ к Камере и Микрофону для этого сайта.');
      } else {
        alert('Ошибка доступа к микрофону или камере: ' + err.message);
      }
      stopStream();
    }
  };

  const updateTimer = () => {
    const elapsed = Math.floor((performance.now() - recordingStartTime) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    if (recTimer) recTimer.textContent = `${mm}:${ss}`;
    
    // Auto-stop at 1 minute
    if (elapsed >= 60) {
      stopRecording();
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    clearInterval(timerInterval);
    recOverlay?.classList.add('hidden');
  };

  const cancelRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = null; // discard
      mediaRecorder.stop();
    }
    clearInterval(timerInterval);
    stopStream();
    recOverlay?.classList.add('hidden');
  };

  const stopStream = () => {
    if (recordStream) {
      recordStream.getTracks().forEach(track => track.stop());
      recordStream = null;
    }
    if (videoPreview) videoPreview.srcObject = null;
  };

  const uploadAndSendMedia = async (blob, type, mime) => {
    const msgType = type === 'video' ? 'video_circle' : 'audio_circle';
    const maxSize = type === 'video' ? 50 * 1024 * 1024 : 15 * 1024 * 1024;
    if (blob.size > maxSize) {
      alert(type === 'video'
        ? 'Видео слишком большое. Максимум 50 МБ.'
        : 'Файл слишком большой. Максимум 15 МБ.');
      return;
    }

    try {
      setStatus('Отправляем файл…');
      
      // 1. Upload raw blob buffer to our S3 endpoint
      const response = await fetch(`${window.API.base}/chat/general/upload`, {
        method: 'POST',
        headers: {
          ...window.API.getAuthHeaders(),
          'Content-Type': mime,
        },
        body: blob,
      });
      
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      
      const uploadData = await response.json();
      if (!uploadData.file_url) {
        throw new Error('S3 upload returned empty URL');
      }
      
      // 2. Send as chat message of type audio_circle or video_circle
      const sendResponse = await window.API.request('POST', '/chat/general/messages', {
        type: msgType,
        file_url: uploadData.file_url,
        text: msgType === 'audio_circle' ? 'Голосовое сообщение' : ''
      });

      mergeMessages(sendResponse.message ? [sendResponse.message] : []);
      setStatus('Общий чат открыт');
      scrollToBottom();
      
    } catch (err) {
      console.error(err);
      setStatus('Не удалось отправить медиа');
      alert('Ошибка при загрузке или отправке: ' + err.message);
    }
  };

  // Bind recording events
  voiceRecBtn?.addEventListener('click', () => startRecording('audio'));
  videoRecBtn?.addEventListener('click', () => startRecording('video'));
  cancelBtn?.addEventListener('click', cancelRecording);
  stopBtn?.addEventListener('click', stopRecording);

  window.addEventListener('beforeunload', () => {
    if (state.socket) state.socket.disconnect();
  });

  function injectChatHeaderBack() {
    var header = document.getElementById('app-mobile-header');
    if (!header || header.querySelector('.chat-header-back')) return;
    var btn = document.createElement('a');
    btn.href = '/';
    btn.className = 'ai-header-back chat-header-back';
    btn.setAttribute('aria-label', 'Назад');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
    btn.addEventListener('touchstart', function(e) {
      e.preventDefault();
      if (history.length > 1) history.back(); else window.location.assign('/');
    });
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (history.length > 1) history.back(); else window.location.assign('/');
    });
    header.insertBefore(btn, header.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectChatHeaderBack);
  } else {
    setTimeout(injectChatHeaderBack, 0);
  }

  window.addEventListener('sistema:subscription-changed', async function(event) {
    const isPro = event.detail.active;
    const modal = document.getElementById('ios-subscription-modal');
    
    if (isPro) {
      if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
      }
      const statusText = document.getElementById('chat-status')?.textContent || '';
      if (statusText.includes('подписка') || statusText.includes('Подписка') || statusText.includes('Подключаемся')) {
        await boot();
      }
    } else {
      state.messages = [];
      setStatus('Требуется подписка Pro');
      render();
      openSubscriptionModal();
    }
  });

  boot();
})();
