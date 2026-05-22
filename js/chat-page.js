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
  };

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
    if (status) status.textContent = text || '';
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
    if (empty) empty.classList.toggle('hidden', messages.length > 0);
    list.innerHTML = messages.map((message) => {
      const own = message.is_own ? ' chat-message-own' : '';
      return `
        <article class="chat-message${own}" data-message-id="${escapeHtml(message.id)}">
          <div class="chat-message-avatar">${escapeHtml((message.sender_name || 'У').slice(0, 1).toUpperCase())}</div>
          <div class="chat-message-bubble">
            <div class="chat-message-meta">
              <span>${escapeHtml(message.sender_name || 'Участник')}</span>
              <time>${escapeHtml(timeLabel(message.created_at))}</time>
            </div>
            <div class="chat-message-text">${escapeHtml(message.text_content || '')}</div>
          </div>
        </article>
      `;
    }).join('');
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

  async function boot() {
    try {
      setStatus('Подключаемся…');
      const chatData = await window.API.getGeneralChat();
      state.userId = chatData?.user?.id || null;
      await loadMessages(true);
      connectSocket();
    } catch (err) {
      setStatus(err?.error || 'Чат временно недоступен');
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
      mergeMessages([{ ...message, is_own: Number(message.sender_id) === Number(state.userId) }]);
    });
    state.socket.on('connect_error', () => {
      setStatus('Чат открыт. Переподключаемся…');
    });
    state.socket.on('disconnect', () => {
      setStatus('Соединение с чатом потеряно');
    });
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input?.value.trim();
    if (!text || state.sending) return;
    state.sending = true;
    if (sendButton) sendButton.disabled = true;
    try {
      const data = await window.API.sendGeneralChatMessage(text);
      input.value = '';
      mergeMessages(data.message ? [data.message] : []);
      scrollToBottom();
      setStatus('Сообщение отправлено');
      window.setTimeout(() => setStatus('Общий чат открыт'), 1200);
    } catch (err) {
      setStatus(err?.error || 'Не удалось отправить сообщение');
    } finally {
      state.sending = false;
      if (sendButton) sendButton.disabled = false;
      input?.focus();
    }
  });

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
