const aiInput = document.getElementById('ai-input');
const aiSend = document.getElementById('ai-send');
const aiConversation = document.getElementById('ai-conversation');
const aiInputBar = document.querySelector('.ai-input-bar');

const AI_COURSE_LINKS = [
  { title: 'Гештальт-подход', href: '/geshtalt/', aliases: ['Гештальт-подход', 'Гештальт'] },
  { title: 'Психосоматика', href: '/psihosomatika/', aliases: ['Психосоматика'] },
  { title: 'Мини-йога', href: '/yoga/', aliases: ['Мини-йога', 'Мини йога', 'Йога'] },
  { title: 'Работа с травмами', href: '/dermer/', aliases: ['Работа с травмами', 'Травмы'] },
  { title: 'Гипноз', href: '/gipnoz/', aliases: ['Гипноз'] },
  { title: 'Супервизия', href: '/superviziya/', aliases: ['Супервизия'] },
  { title: 'Мастер Коммуникаций', href: '/master/', aliases: ['Мастер Коммуникаций', 'Мастер коммуникаций'] },
  { title: 'Телесная терапия', href: '/terapiya/', aliases: ['Телесная терапия', 'Телесная практика'] },
  { title: 'Антология', href: '/antologiya/', aliases: ['Антология'] },
  { title: 'Созависимость', href: '/sozavisimost/', aliases: ['Созависимость'] },
  { title: 'Мужское и Женское', href: '/mj/', aliases: ['Мужское и Женское', 'Мужское и женское'] },
  { title: 'Самооценка', href: '/marathons/#section-samoocenka', aliases: ['Самооценка'] },
  { title: 'Конфликты', href: '/marathons/#section-konflikty', aliases: ['Конфликты'] },
  { title: 'Материнство и опора', href: '/marathons/#section-rezakina', aliases: ['Материнство и опора', 'Материнство'] },
  { title: 'Йога и терапия', href: '/event-yoga/', aliases: ['Йога и терапия', 'ивент Йога и терапия', 'Ивент Системы'] },
];

const AI_PSYCHOLOGIST_LINKS = [
  { title: 'Светлана Плешакова', href: '/psychologists/pleshakova-svetlana/', aliases: ['Светлана Плешакова', 'Плешакова', 'Светлана'] },
  { title: 'Анастасия Резакина', href: '/psychologists/rezakina-anastasia/', aliases: ['Анастасия Резакина', 'Резакина', 'Анастасия'] },
  { title: 'Владимир Земелькин', href: '/psychologists/zemelkin-vladimir/', aliases: ['Владимир Земелькин', 'Земелькин', 'Владимир'] },
  { title: 'Станислав Борисов', href: '/psychologists/borisov-stanislav/', aliases: ['Станислав Борисов', 'Борисов', 'Станислав'] },
  { title: 'Мария Падурец', href: '/psychologists/padurec-maria/', aliases: ['Мария Падурец', 'Падурец', 'Мария'] },
  { title: 'Дмитрий Лубкин', href: '/psychologists/lubkin-dmitry/', aliases: ['Дмитрий Лубкин', 'Лубкин', 'Дмитрий'] },
  { title: 'Психологи Системы', href: '/psychologists/', aliases: ['психологи Системы', 'список психологов', 'все психологи'] },
];

const AI_TOPIC = new URLSearchParams(window.location.search).get('topic') || '';
const PSYCHOLOGIST_SELECTION_MESSAGE = [
  'Хочу подобрать психолога внутри Системы под свой запрос.',
  'Пожалуйста, начни с короткой бережной беседы: задай мне несколько уточняющих вопросов о главном запросе, состоянии, формате работы и предпочтительном подходе.',
  'После моих ответов предложи 1-2 психологов из базы Системы и объясни, почему они подходят.'
].join(' ');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const AI_QUOTE_OPEN = new Set(['«', '„', '“', '"', '‚', '‘']);
const AI_QUOTE_CLOSE = new Set(['»', '“', '”', '"', '‘', '’']);

function renderAiAssistantHtml(text) {
  const sorted = AI_COURSE_LINKS.concat(AI_PSYCHOLOGIST_LINKS)
    .flatMap((course) => course.aliases.map((alias) => ({ ...course, alias })))
    .sort((a, b) => b.alias.length - a.alias.length);
  const source = String(text || '');
  const matches = [];

  sorted.forEach((course) => {
    // Многословные/составные названия выделяем всегда — они однозначны.
    // Одиночные общие слова (тревога, самооценка, имя) — только когда это явно ссылка:
    // либо в кавычках, либо когда в тексте есть путь страницы (модель её рекомендует).
    const isDistinct = /[\s\-]/.test(course.alias);
    const hrefMentioned = source.includes(course.href);
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(course.alias)})(?=$|[^\\p{L}\\p{N}])`, 'giu');
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const prefixLength = match[1].length;
      const start = match.index + prefixLength;
      const end = start + match[2].length;
      const quoted = AI_QUOTE_OPEN.has(source[start - 1] || '') && AI_QUOTE_CLOSE.has(source[end] || '');
      if (!(isDistinct || hrefMentioned || quoted)) continue;
      if (matches.some((item) => start < item.end && end > item.start)) continue;
      matches.push({ start, end, href: course.href, label: source.slice(start, end) });
    }
  });

  matches.sort((a, b) => a.start - b.start);
  let cursor = 0;
  let html = '';
  matches.forEach((match) => {
    html += escapeHtml(source.slice(cursor, match.start)).replace(/\n/g, '<br>');
    html += `<a class="ai-course-link" href="${match.href}">${escapeHtml(match.label)}</a>`;
    cursor = match.end;
  });
  html += escapeHtml(source.slice(cursor)).replace(/\n/g, '<br>');
  return html;
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
  if (role === 'assistant') {
    content.innerHTML = renderAiAssistantHtml(text);
  } else {
    content.textContent = text;
  }
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
    maybeStartPsychologistSelection(data.messages || []);
  } catch {}
}

function updateUsage(usage) {
  if (!usage) return;
  document.getElementById('ai-usage-pill').textContent =
    `AI сообщения: ${usage.used || 0} · без лимита`;
}

async function submitQuestion(forcedValue = '') {
  const value = String(forcedValue || aiInput.value || '').trim();
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
        assistant.content.dataset.rawText = (assistant.content.dataset.rawText || '') + text;
        assistant.content.innerHTML = renderAiAssistantHtml(assistant.content.dataset.rawText);
        scrollAiToBottom();
      },
      onUsage(usage) {
        updateUsage(usage);
      },
      onDone(data) {
        updateUsage(data.usage);
      },
    });
    const finalText = assistant.content.dataset.rawText || assistant.content.textContent || '';
    if (!finalText.trim()) {
      assistant.content.innerHTML = renderAiAssistantHtml('Ответ не пришел. Попробуйте еще раз.');
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

function applyAiTopic() {
  if (AI_TOPIC !== 'psychologist-selection') return;
  const title = document.querySelector('.ai-title');
  const desc = document.querySelector('.ai-desc');
  if (title) title.innerHTML = 'Подбор психолога<br>с AI';
  if (desc) desc.textContent = 'Лиза поможет аккуратно описать запрос и сузить выбор специалиста Системы.';
  if (aiInput) aiInput.placeholder = 'Опишите запрос своими словами';
}

function maybeStartPsychologistSelection(historyMessages) {
  return;
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
    if (history.length > 1) history.back(); else window.location.assign('/');
  }, { capture: true, passive: false });
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    if (history.length > 1) history.back(); else window.location.assign('/');
  });
  header.insertBefore(btn, header.firstChild);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectAiHeaderBack);
} else {
  setTimeout(injectAiHeaderBack, 0);
}

applyAiTopic();
loadAiUsage();
loadAiHistory();
aiSend.addEventListener('click', () => submitQuestion());
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
