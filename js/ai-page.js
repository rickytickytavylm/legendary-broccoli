const aiInput = document.getElementById('ai-input');
const aiSend = document.getElementById('ai-send');
const aiConversation = document.getElementById('ai-conversation');
const aiInputBar = document.querySelector('.ai-input-bar');
const aiBack = document.querySelector('[data-ai-back]');

function goHomeFromAi(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
  }
  window.location.assign('/');
}

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
    link.href = '/';
    link.textContent = 'Вернуться на сегодня';
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
  if (!window.API) return;
  try {
    const data = await window.API.getAiUsage();
    updateUsage(data.usage);
  } catch {}
}

async function loadAiHistory() {
  if (!window.API) return;
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
    `AI сообщения: ${usage.used || 0} · без лимита`;
}

async function submitQuestion() {
  const value = aiInput.value.trim();
  if (!value) return;
  if (!window.API) return;

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
    addMessage('Не удалось отправить сообщение. Проверьте подключение сервера и ключ DeepSeek, затем попробуйте еще раз.', 'assistant');
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

function injectAiHeaderBack() {
  var header = document.getElementById('app-mobile-header');
  if (!header || header.querySelector('.ai-header-back')) return;
  var btn = document.createElement('a');
  btn.href = '/';
  btn.className = 'ai-header-back';
  btn.setAttribute('aria-label', 'Назад');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
  btn.addEventListener('touchstart', function(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    window.location.assign('/');
  }, { capture: true, passive: false });
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    window.location.assign('/');
  });
  header.insertBefore(btn, header.firstChild);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectAiHeaderBack);
} else {
  setTimeout(injectAiHeaderBack, 0);
}

loadAiUsage();
loadAiHistory();
aiSend.addEventListener('click', submitQuestion);
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

document.addEventListener('touchstart', (event) => {
  if (event.target.closest('[data-ai-back]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign('/');
  }
}, { capture: true, passive: false });

document.addEventListener('pointerdown', (event) => {
  if (event.target.closest('[data-ai-back]')) goHomeFromAi(event);
}, true);

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-ai-back]')) goHomeFromAi(event);
}, true);
