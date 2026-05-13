const ONBOARDING_COMPLETE_KEY = 'sistema:onboarding-complete';
const ONBOARDING_PROFILE_KEY = 'sistema:onboarding-profile';

const onboardingSteps = [
  {
    key: 'focus',
    label: 'Шаг 1 из 5',
    title: 'Что сейчас важнее?',
    desc: 'Выберите ближайший запрос. Это не диагноз, а точка входа в материалы.',
    options: ['Тревога и стресс', 'Тело и симптомы', 'Отношения', 'Самооценка', 'Усталость', 'Хочу понять себя', 'Просто изучаю'],
  },
  {
    key: 'format',
    label: 'Шаг 2 из 5',
    title: 'Какой формат ближе?',
    desc: 'Система учтет, как вам удобнее входить в материал.',
    options: ['Короткие видео', 'Глубокие лекции', 'Аудио', 'Практики', 'AI-сопровождение', 'Группа'],
  },
  {
    key: 'time',
    label: 'Шаг 3 из 5',
    title: 'Сколько времени в день?',
    desc: 'Маршрут должен быть посильным, а не идеальным на бумаге.',
    options: ['5 минут', '15 минут', '30 минут', 'Глубже по выходным'],
  },
  {
    key: 'community',
    label: 'Шаг 4 из 5',
    title: 'Нужна ли поддержка группы?',
    desc: 'Можно выбрать тихий режим и подключиться позже.',
    options: ['Да', 'Позже', 'Хочу читать без участия', 'Нет'],
  },
  {
    key: 'result',
    label: 'Шаг 5 из 5',
    title: 'Ваш стартовый путь',
    desc: 'Мы собрали мягкий вход. Его можно изменить в любой момент.',
    options: ['Начать с первого шага'],
  },
];

const onboardingState = {};
let onboardingIndex = 0;

function selectedFocus() {
  return onboardingState.focus || 'Хочу понять себя';
}

function routeTitle() {
  const focus = selectedFocus();
  if (/тревога|стресс/i.test(focus)) return 'Стресс и тело: мягкий вход';
  if (/тело|симптом/i.test(focus)) return 'Психосоматика: связь эмоций и тела';
  if (/отнош/i.test(focus)) return 'Отношения и границы';
  if (/самооцен/i.test(focus)) return 'Самооценка и внутренняя опора';
  if (/устал/i.test(focus)) return 'Восстановление и бережный ритм';
  return 'Первый маршрут в системе';
}

function showNewHomeState(state) {
  document.getElementById('system-intro')?.classList.toggle('hidden', state !== 'intro');
  document.getElementById('onboarding-flow')?.classList.toggle('hidden', state !== 'onboarding');
  document.getElementById('today-screen')?.classList.toggle('hidden', state !== 'today');
  document.body.classList.toggle('home-onboarding-active', state !== 'today');
}

function renderToday() {
  const profile = JSON.parse(localStorage.getItem(ONBOARDING_PROFILE_KEY) || '{}');
  const focus = profile.focus || selectedFocus();
  const title = routeTitle();
  const todayTitle = document.querySelector('[data-today-title]');
  const todaySubtitle = document.querySelector('[data-today-subtitle]');
  const stepTitle = document.querySelector('[data-today-step-title]');
  const stepDesc = document.querySelector('[data-today-step-desc]');
  if (todayTitle) todayTitle.textContent = title;
  if (todaySubtitle) todaySubtitle.textContent = `Запрос: ${focus}. Сегодня лучше сделать один спокойный шаг.`;
  if (stepTitle) stepTitle.textContent = 'Первый шаг маршрута';
  if (stepDesc) stepDesc.textContent = 'Откройте практики, выберите короткий материал и после просмотра сохраните наблюдение через AI.';
}

function finishOnboarding() {
  localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  localStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify({
    ...onboardingState,
    route: routeTitle(),
    completedAt: new Date().toISOString(),
  }));
  renderToday();
  showNewHomeState('today');
}

function renderOnboarding() {
  const step = onboardingSteps[onboardingIndex];
  const label = document.querySelector('[data-onboarding-step-label]');
  const title = document.querySelector('[data-onboarding-title]');
  const desc = document.querySelector('[data-onboarding-desc]');
  const progress = document.querySelector('[data-onboarding-progress]');
  const options = document.querySelector('[data-onboarding-options]');
  const back = document.querySelector('[data-onboarding-back]');
  const next = document.querySelector('[data-onboarding-next]');
  if (label) label.textContent = step.label;
  if (title) title.textContent = step.title;
  if (desc) desc.textContent = step.desc;
  if (progress) progress.style.width = `${((onboardingIndex + 1) / onboardingSteps.length) * 100}%`;
  if (back) back.disabled = onboardingIndex === 0;
  if (next) next.textContent = onboardingIndex === onboardingSteps.length - 1 ? 'Начать' : 'Дальше';
  if (!options) return;
  options.innerHTML = step.options.map((option) => `
    <button type="button" class="${onboardingState[step.key] === option ? 'active' : ''}" data-onboarding-option="${option}">
      ${option}
    </button>
  `).join('');
}

function initOnboarding() {
  document.querySelector('[data-onboarding-start]')?.addEventListener('click', () => {
    onboardingIndex = 0;
    renderOnboarding();
    showNewHomeState('onboarding');
  });
  document.querySelector('[data-onboarding-options]')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-onboarding-option]');
    if (!button) return;
    const step = onboardingSteps[onboardingIndex];
    onboardingState[step.key] = button.dataset.onboardingOption;
    renderOnboarding();
  });
  document.querySelector('[data-onboarding-back]')?.addEventListener('click', () => {
    onboardingIndex = Math.max(0, onboardingIndex - 1);
    renderOnboarding();
  });
  document.querySelector('[data-onboarding-next]')?.addEventListener('click', () => {
    if (onboardingIndex === onboardingSteps.length - 1) {
      finishOnboarding();
      return;
    }
    const step = onboardingSteps[onboardingIndex];
    if (!onboardingState[step.key]) onboardingState[step.key] = step.options[0];
    onboardingIndex += 1;
    renderOnboarding();
  });
  document.querySelector('[data-today-checkin]')?.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    document.querySelectorAll('[data-today-checkin] button').forEach((item) => item.classList.toggle('active', item === button));
    localStorage.setItem('sistema:last-checkin', JSON.stringify({ value: button.textContent.trim(), at: new Date().toISOString() }));
  });

  if (localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true') {
    renderToday();
    showNewHomeState('today');
  } else {
    showNewHomeState('intro');
  }
}

if (window.ProgramCatalog) {
  window.ProgramCatalog.renderRail('#home-program-rail', 4);
  window.ProgramCatalog.renderWebinarRail('#home-webinar-rail');
  window.ProgramCatalog.renderMarathonRail('#home-marathon-rail');
  window.ProgramCatalog.renderResourceRail('#home-resource-rail');
}

window.refreshAuthUI = function(user) {
  const btn = document.getElementById('nav-auth-btn');
  const link = document.getElementById('nav-account-link');
  if (user || window.API.isLoggedIn()) {
    if (btn) btn.style.display = 'none';
    if (link) link.style.display = 'inline-flex';
  }
};

if (window.API.isLoggedIn()) {
  window.API.me().then(r => window.refreshAuthUI(r.user)).catch(() => {});
}

initOnboarding();
