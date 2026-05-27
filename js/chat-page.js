(function initCommunityChat() {
  const root = document.querySelector('[data-chat-root]');
  if (!root || !window.API) return;

  const list = root.querySelector('[data-chat-messages]');
  const form = root.querySelector('[data-chat-form]');
  const input = root.querySelector('[data-chat-input]');
  const status = root.querySelector('[data-chat-status]');
  const empty = root.querySelector('[data-chat-empty]');
  const sendButton = root.querySelector('[data-chat-send]');
  const state = {
    messages: new Map(),
    latestId: 0,
    socket: null,
    userId: null,
    sending: false,
    editingMessageId: null,
    loading: true,
  };

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

  editBanner.querySelector('#chat-cancel-edit-btn')?.addEventListener('click', () => {
    state.editingMessageId = null;
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

  function shouldStickToBottom() {
    if (!list) return true;
    return list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  }

  function scrollToBottom() {
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }

  function render() {
    if (!list) return;
    const keepBottom = shouldStickToBottom();
    const messages = Array.from(state.messages.values()).sort((a, b) => Number(a.id) - Number(b.id));

    if (state.loading) {
      if (empty) empty.classList.add('hidden');
      list.innerHTML = `
        <div class="chat-loading-shimmer">
          <div class="shimmer-bubble"></div>
          <div class="shimmer-bubble own"></div>
          <div class="shimmer-bubble"></div>
        </div>
      `;
      return;
    }

    if (empty) empty.classList.toggle('hidden', messages.length > 0);
    list.innerHTML = messages.map((message) => {
      const own = message.is_own ? ' chat-message-own' : '';
      const avatarHtml = message.is_own 
        ? '' 
        : `<div class="chat-message-avatar">${escapeHtml((message.sender_name || 'У').slice(0, 1).toUpperCase())}</div>`;

      let contentHtml = `<div class="chat-message-text">${escapeHtml(message.text_content || '').replace(/\n/g, '<br>')}</div>`;
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
      } else if (message.type === 'video_circle' && message.file_url) {
        contentHtml = `
          <div class="chat-video-circle-wrap" style="position: relative; overflow: visible; cursor: pointer;">
            <video class="chat-video-circle" src="${escapeHtml(message.file_url)}" playsinline webkit-playsinline loop muted autoplay preload="metadata" style="display: block; border-radius: 50%;"></video>
            <!-- SVG Progress Circle (fits exactly inside the 180px border) -->
            <svg class="chat-video-progress-svg" width="180" height="180" style="position: absolute; top: 0; left: 0; transform: rotate(-90deg); pointer-events: none; overflow: visible; z-index: 5;">
              <circle cx="90" cy="90" r="88" fill="transparent" stroke="rgba(255, 255, 255, 0.12)" stroke-width="3"></circle>
              <circle class="chat-video-progress-circle-bar" cx="90" cy="90" r="88" fill="transparent" stroke="#8baaff" stroke-width="3" stroke-linecap="round" stroke-dasharray="553" stroke-dashoffset="553" style="transition: stroke-dashoffset 0.1s linear;"></circle>
            </svg>
          </div>
        `;
      }

      return `
        <article class="chat-message${own}" data-message-id="${escapeHtml(message.id)}">
          ${avatarHtml}
          <div class="chat-message-bubble">
            <div class="chat-message-meta">
              <span>${escapeHtml(message.sender_name || 'Участник')}</span>
              <time>${escapeHtml(timeLabel(message.created_at))}</time>
            </div>
            ${contentHtml}
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
      const VAPID_PUBLIC_KEY = 'BJ2mtnvvuig_I_ZBVMQy4HaLMAeymgwY3fiSzLO81Vi7JQKpuknLALehKkQyEx7Y8RIqrzd0WTcP6xxxX7kTopI';
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

  async function boot() {
    try {
      setStatus('Подключаемся…');
      const chatData = await window.API.getGeneralChat();
      state.userId = chatData?.user?.id || null;
      await loadMessages(true);
      connectSocket();

      // Configure interactive Web Push notification flow
      initNotificationBanner();
    } catch (err) {
      setStatus(err?.error || 'Чат временно недоступен');
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
    });
    state.socket.on('connect', () => {
      state.socket.emit('chat:join', { room: 'general' }, (ack) => {
        setStatus(ack && ack.ok ? 'Общий чат онлайн' : 'Чат открыт');
      });
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
            bodyText = '🎥 Видеосообщение (кружочек)';
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
      state.messages.set(String(message.id), {
        ...message,
        is_own: Number(message.sender_id) === Number(state.userId)
      });
      render();
    });
    state.socket.on('chat.message.deleted', (data) => {
      state.messages.delete(String(data.id));
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
      <button class="action-sheet-btn action-delete-self text-danger" data-action="delete-self">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span>Удалить у себя</span>
      </button>
    `;

    sheet.innerHTML = `
      <div class="action-sheet-overlay"></div>
      <div class="action-sheet-body">
        <div class="action-sheet-header">Сообщение от ${escapeHtml(msg.sender_name || 'участника')}</div>
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

    sheet.addEventListener('click', async (e) => {
      const btn = e.target.closest('.action-sheet-btn');
      if (!btn) return;
      const action = btn.dataset.action;
      if (!action || action === 'cancel') return;

      closeSheet();

      if (action === 'edit') {
        state.editingMessageId = String(messageId);
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

  const handleStart = (ev, targetMsg) => {
    hasMoved = false;
    const touch = ev.touches ? ev.touches[0] : ev;
    startX = touch.clientX;
    startY = touch.clientY;

    const id = targetMsg.getAttribute('data-message-id');
    const isOwn = targetMsg.classList.contains('chat-message-own');

    touchTimer = setTimeout(() => {
      if (!hasMoved) {
        showMessageContextMenu(id, isOwn, ev);
      }
    }, 550); // 550ms Telegram-style hold threshold
  };

  const handleMove = (ev) => {
    const touch = ev.touches ? ev.touches[0] : ev;
    if (Math.abs(touch.clientX - startX) > 8 || Math.abs(touch.clientY - startY) > 8) {
      hasMoved = true;
      if (touchTimer) clearTimeout(touchTimer);
    }
  };

  const handleEnd = () => {
    if (touchTimer) clearTimeout(touchTimer);
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
      <div class="video-modal-content">
        <button class="video-modal-close" type="button" aria-label="Закрыть">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <video class="video-modal-player" src="${escapeHtml(videoSrc)}" autoplay playsinline controls loop></video>
      </div>
    `;
    document.body.appendChild(modal);

    // Fade in
    setTimeout(() => modal.classList.add('active'), 20);

    const closeModal = () => {
      modal.classList.remove('active');
      const video = modal.querySelector('video');
      if (video) video.pause();
      setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('.video-modal-backdrop').addEventListener('click', closeModal);
    modal.querySelector('.video-modal-close').addEventListener('click', closeModal);
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
      const systemBottom = bottomGap > 0 && bottomGap < 96 ? bottomGap : 0;
      const keyboardHeight = systemBottom ? 0 : bottomGap;

      root.style.setProperty('--chat-viewport-height', `${Math.floor(viewport.height)}px`);
      root.style.setProperty('--chat-keyboard-height', `${keyboardHeight}px`);
      root.style.setProperty('--chat-system-bottom', `${systemBottom}px`);
      scrollToBottom();
    };
    window.visualViewport.addEventListener('resize', onViewportResize);
    window.visualViewport.addEventListener('scroll', onViewportResize);
    window.addEventListener('resize', onViewportResize);
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
        state.messages.set(String(state.editingMessageId), {
          ...data.message,
          is_own: true
        });
        state.editingMessageId = null;
        editBanner.classList.add('hidden');
        setStatus('Сообщение изменено');
      } else {
        const data = await window.API.sendGeneralChatMessage(text);
        mergeMessages(data.message ? [data.message] : []);
        setStatus('Сообщение отправлено');
      }
      input.value = '';
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

  // ─── Media Recording Logic (Voice & Circular Videos) ───
  const voiceRecBtn = document.getElementById('chat-voice-rec-btn');
  const videoRecBtn = document.getElementById('chat-video-rec-btn');
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
  let recordingType = null; // 'audio' or 'video'

  const startRecording = async (type) => {
    if (!hasMediaSupport) {
      alert('Запись аудио и кружочков не поддерживается вашим браузером, или соединение не защищено (требуется HTTPS).');
      return;
    }
    try {
      recordingType = type;
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
      const msgType = type === 'video' ? 'video_circle' : 'audio_circle';
      const sendResponse = await window.API.request('POST', '/chat/general/messages', {
        type: msgType,
        file_url: uploadData.file_url,
        text: msgType === 'video' ? 'Кружочек' : 'Голосовое сообщение'
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
      window.location.assign('/');
    });
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      window.location.assign('/');
    });
    header.insertBefore(btn, header.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectChatHeaderBack);
  } else {
    setTimeout(injectChatHeaderBack, 0);
  }

  boot();
})();
