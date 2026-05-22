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
      const avatarHtml = message.is_own 
        ? '' 
        : `<div class="chat-message-avatar">${escapeHtml((message.sender_name || 'У').slice(0, 1).toUpperCase())}</div>`;
      
      const actionsHtml = message.is_own 
        ? `<div class="chat-message-actions">
             <button class="chat-action-btn btn-edit" data-edit-id="${message.id}" aria-label="Редактировать">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
             </button>
             <button class="chat-action-btn btn-delete" data-delete-id="${message.id}" aria-label="Удалить">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
             </button>
           </div>`
         : '';

      return `
        <article class="chat-message${own}" data-message-id="${escapeHtml(message.id)}">
          ${avatarHtml}
          <div class="chat-message-bubble">
            <div class="chat-message-meta">
              <span>${escapeHtml(message.sender_name || 'Участник')}</span>
              <time>${escapeHtml(timeLabel(message.created_at))}</time>
              ${actionsHtml}
            </div>
            <div class="chat-message-text">${escapeHtml(message.text_content || '').replace(/\n/g, '<br>')}</div>
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

  // Event Delegation for message edit & delete actions
  list?.addEventListener('click', async (ev) => {
    const editBtn = ev.target.closest('[data-edit-id]');
    const deleteBtn = ev.target.closest('[data-delete-id]');

    if (editBtn) {
      ev.preventDefault();
      const id = editBtn.getAttribute('data-edit-id');
      const msg = state.messages.get(id);
      if (msg) {
        state.editingMessageId = id;
        input.value = msg.text_content || '';
        editBanner.classList.remove('hidden');
        input.focus();
        if (input.tagName === 'TEXTAREA') {
          input.style.height = 'auto';
          input.style.height = input.scrollHeight + 'px';
        }
      }
    } else if (deleteBtn) {
      ev.preventDefault();
      const id = deleteBtn.getAttribute('data-delete-id');
      if (confirm('Вы уверены, что хотите удалить это сообщение?')) {
        try {
          await window.API.deleteGeneralChatMessage(id);
          state.messages.delete(id);
          render();
          setStatus('Сообщение удалено');
          window.setTimeout(() => setStatus('Общий чат открыт'), 1200);
        } catch (err) {
          alert(err?.error || 'Не удалось удалить сообщение');
        }
      }
    }
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
