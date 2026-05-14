const aiInput = document.getElementById('ai-input');
const aiSend = document.getElementById('ai-send');
const aiConversation = document.getElementById('ai-conversation');
const aiInputBar = document.querySelector('.ai-input-bar');
let aiBackTimer = null;

function syncAiIntroState() {
  const hasMessages = !!aiConversation.querySelector('.ai-message');
  document.body.classList.toggle('ai-has-messages', hasMessages);
}

function scrollAiToBottom(delay = 0) {
  window.setTimeout(() => {
    aiConversation.dataset.programmaticScroll = '1';
    aiConversation.scrollTop = aiConversation.scrollHeight;
    window.setTimeout(() => {
      delete aiConversation.dataset.programmaticScroll;
    }, 120);
  }, delay);
}

function hideAiBackTemporarily() {
  if (window.innerWidth > 768) return;
  document.body.classList.add('ai-back-hidden');
  clearTimeout(aiBackTimer);
  aiBackTimer = setTimeout(() => {
    document.body.classList.remove('ai-back-hidden');
  }, 900);
}

function addMessage(text, role = 'user', options = {}) {
  const msg = document.createElement('div');
  msg.className = 'ai-message ' + role;
  const bubble = document.createElement('div');
  bubble.className = 'ai-bubble';
  const name = document.createElement('span');
  name.className = 'ai-name';
  name.textContent = role === 'user' ? 'Вы' : 'AI-помощник';
  const content = document.createElement('span');
  content.className = 'ai-content';
  content.textContent = text;
  bubble.append(name, content);
  if (options.limitCta) {
    const actions = document.createElement('div');
    actions.className = 'ai-limit-actions';
    const link = document.createElement('a');
    link.className = 'ai-limit-pro-btn';
    link.href = '/path/';
    link.textContent = 'Вернуться к пути';
    actions.appendChild(link);
    bubble.appendChild(actions);
  }
  const time = document.createElement('span');
  time.className = 'ai-time';
  time.textContent = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  msg.append(bubble, time);
  aiConversation.appendChild(msg);
  syncAiIntroState();
  scrollAiToBottom();
  return { msg, content };
}

async function loadAiUsage() {
  if (!window.API || !window.API.isLoggedIn()) return;
  try {
    const data = await window.API.getAiUsage();
    updateUsage(data.usage);
  } catch {}
}

async function loadAiHistory() {
  if (!window.API || !window.API.isLoggedIn()) return;
  try {
    const data = await window.API.getAiHistory(80);
    aiConversation.innerHTML = '';
    (data.messages || []).forEach((message) => {
      addMessage(message.content || '', message.role === 'assistant' ? 'assistant' : 'user');
    });
    syncAiIntroState();
    scrollAiToBottom(40);
  } catch {}
}

function updateUsage(usage) {
  if (!usage) return;
  document.getElementById('ai-usage-pill').textContent =
    `AI сообщения: ${usage.used} · тестовый режим без лимита`;
}

async function submitQuestion() {
  const value = aiInput.value.trim();
  if (!value) return;
  if (!window.API || !window.API.isLoggedIn()) {
    if (window.openAuthModal) window.openAuthModal('login');
    else window.location.href = '/account/';
    return;
  }

  addMessage(value, 'user');
  aiInput.value = '';
  aiSend.disabled = true;
  aiInput.disabled = true;
  const assistant = addMessage('', 'assistant');
  assistant.msg.classList.add('streaming');
  try {
    await window.API.streamAiMessage(value, {
      onDelta(text) {
        assistant.content.textContent += text;
        scrollAiToBottom();
      },
      onUsage(usage) {
        updateUsage(usage);
      },
      onDone(data) {
        updateUsage(data.usage);
      },
    });
    if (!assistant.content.textContent.trim()) {
      assistant.content.textContent = 'Ответ не пришел. Попробуйте еще раз.';
    }
  } catch (err) {
    assistant.msg.remove();
    if (err.code === 'AI_LIMIT_REACHED') {
      updateUsage(err.usage);
      addMessage('Лимит сообщений на этот период закончился. Вернитесь к пути: можно продолжить через видео, аудио или практику.', 'assistant', { limitCta: true });
    } else {
      addMessage('Не удалось отправить сообщение. Попробуйте еще раз.', 'assistant');
    }
  } finally {
    assistant.msg.classList.remove('streaming');
    aiSend.disabled = false;
    aiInput.disabled = false;
    aiInput.focus();
  }
}

function updateAiLayoutMetrics() {
  if (aiInputBar) {
    document.documentElement.style.setProperty('--ai-composer-height', Math.ceil(aiInputBar.offsetHeight) + 'px');
  }
  if (!window.visualViewport || window.innerWidth > 768) {
    document.documentElement.style.setProperty('--ai-keyboard-offset', '0px');
    document.documentElement.style.setProperty('--ai-viewport-height', '100svh');
    return;
  }
  const keyboard = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
  document.documentElement.style.setProperty('--ai-keyboard-offset', keyboard + 'px');
  document.documentElement.style.setProperty('--ai-viewport-height', Math.floor(window.visualViewport.height) + 'px');
  scrollAiToBottom();
}

loadAiUsage();
loadAiHistory();
aiSend.addEventListener('click', submitQuestion);
aiConversation.addEventListener('scroll', () => {
  if (aiConversation.dataset.programmaticScroll === '1') return;
  hideAiBackTemporarily();
}, { passive: true });
aiInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') submitQuestion();
});
aiInput.addEventListener('focus', () => {
  document.body.classList.add('ai-input-focused');
  updateAiLayoutMetrics();
  scrollAiToBottom(120);
});
aiInput.addEventListener('blur', () => {
  document.body.classList.remove('ai-input-focused');
});

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateAiLayoutMetrics);
  window.visualViewport.addEventListener('scroll', updateAiLayoutMetrics);
}
window.addEventListener('resize', updateAiLayoutMetrics);
updateAiLayoutMetrics();
