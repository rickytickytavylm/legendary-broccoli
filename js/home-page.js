const ONBOARDING_COMPLETE_KEY = 'sistema:onboarding-complete';
const ONBOARDING_PROFILE_KEY = 'sistema:onboarding-profile';
const SPLASH_SEEN_KEY = 'sistema:intro-splash-seen';
const SPLASH_AUDIO_SRC = '/assets/audio/opening-sistema.mp3';
let splashSoundPlayed = false;

const onboardingSteps = [
  {
    key: 'focus',
    label: 'Шаг 1 из 3',
    title: 'Что сейчас важнее?',
    desc: 'Выберите направление. Система покажет две подходящие программы для старта.',
    options: [
      { value: 'calm', label: 'Спокойствие' },
      { value: 'body', label: 'Тело / симптомы' },
      { value: 'relationships', label: 'Отношения' },
      { value: 'selfworth', label: 'Самооценка / опора' },
      { value: 'selfstudy', label: 'Понять себя глубже' },
      { value: 'communication', label: 'Коммуникация / конфликты' },
      { value: 'statework', label: 'Глубинная работа' },
      { value: 'professional', label: 'Я специалист' },
    ],
  },
  {
    key: 'entry',
    label: 'Шаг 2 из 3',
    title: 'Как лучше начать?',
    desc: 'Один формат входа. Контент тот же, меняется только способ начать.',
    options: [
      { value: 'short', label: 'Коротко' },
      { value: 'video', label: 'Видео' },
      { value: 'audio', label: 'Аудио' },
    ],
  },
  {
    key: 'result',
    label: 'Шаг 3 из 3',
    title: 'Направление выбрано',
    desc: 'Покажем две подходящие программы. AI останется рядом и поможет выбрать между ними.',
    result: true,
    options: [],
  },
];

const onboardingState = {};
let onboardingIndex = 0;

const routes = {
  calm: {
    title: 'Спокойствие',
    desc: 'Два мягких входа: через движение и через внимание к телу.',
    short: 'спокойствие',
    programs: [
      { title: 'Мини-йога', desc: 'Мягкое начало через дыхание и движение.', href: '/yoga/', image: '/assets/webp/mini-yoga.webp' },
      { title: 'Телесная терапия', desc: 'Вернуть внимание в тело и снизить внутреннее напряжение.', href: '/terapiya/', image: '/assets/webp/theraphy.webp' },
    ],
  },
  body: {
    title: 'Тело и симптомы',
    desc: 'Два входа: понять психосоматику и мягко вернуться в телесное ощущение.',
    short: 'тело и симптомы',
    programs: [
      { title: 'Психосоматика', desc: 'Связь эмоций, стресса и телесных симптомов.', href: '/psihosomatika/', image: '/assets/webp/psysomatic.webp' },
      { title: 'Телесная терапия', desc: 'Практики, которые возвращают внимание в тело.', href: '/terapiya/', image: '/assets/webp/theraphy.webp' },
    ],
  },
  relationships: {
    title: 'Отношения',
    desc: 'Два входа: зависимые сценарии и мужско-женская динамика.',
    short: 'отношения',
    programs: [
      { title: 'Созависимость', desc: 'Границы, привязанность и повторяющиеся сценарии.', href: '/sozavisimost/', image: '/assets/webp/coda2.webp' },
      { title: 'Мужское и Женское', desc: 'Психология отношений и природа полов.', href: '/mj/', image: '/assets/webp/man_woman.webp' },
    ],
  },
  selfworth: {
    title: 'Самооценка и опора',
    desc: 'Два входа: восстановление опоры и контакт с собой.',
    short: 'самооценка и опора',
    programs: [
      { title: 'Работа с травмами', desc: 'Кризисы, травматичный опыт и восстановление опоры.', href: '/dermer/', image: '/assets/webp/geshtalt.webp' },
      { title: 'Гештальт-подход', desc: 'Контакт, эмоции, границы и возвращение к себе.', href: '/geshtalt/', image: '/assets/webp/courses.webp' },
    ],
  },
  selfstudy: {
    title: 'Понять себя глубже',
    desc: 'Два входа: базовая программа для самопонимания и библиотека материалов.',
    short: 'самопонимание',
    programs: [
      { title: 'Гештальт-подход', desc: 'Эмоции, потребности, контакт и границы.', href: '/geshtalt/', image: '/assets/webp/courses.webp' },
      { title: 'Антология', desc: 'Сборник материалов и практик для более широкого входа.', href: '/antologiya/', image: '/assets/webp/antology.webp' },
    ],
  },
  communication: {
    title: 'Коммуникация и конфликты',
    desc: 'Два входа: навыки общения и сценарии в отношениях.',
    short: 'коммуникация и конфликты',
    programs: [
      { title: 'Мастер Коммуникаций', desc: 'Навыки общения, диалог и управление конфликтом.', href: '/master/', image: '/assets/webp/masterofcommication.webp' },
      { title: 'Созависимость', desc: 'Границы и повторяющиеся сценарии в контакте.', href: '/sozavisimost/', image: '/assets/webp/coda2.webp' },
    ],
  },
  statework: {
    title: 'Глубинная работа',
    desc: 'Два входа: состояние, внимание и работа с внутренним опытом.',
    short: 'глубинная работа',
    programs: [
      { title: 'Гипноз', desc: 'Техники и практики гипнотерапии.', href: '/gipnoz/', image: '/assets/webp/hipno.webp' },
      { title: 'Гештальт-подход', desc: 'Контакт, эмоции и возвращение к себе.', href: '/geshtalt/', image: '/assets/webp/courses.webp' },
    ],
  },
  professional: {
    title: 'Профессиональный разбор',
    desc: 'Два входа для специалистов: супервизия и коммуникация.',
    short: 'профессиональный интерес',
    programs: [
      { title: 'Супервизия', desc: 'Профессиональная поддержка психологов.', href: '/superviziya/', image: '/assets/webp/supervision.webp' },
      { title: 'Мастер Коммуникаций', desc: 'Навыки общения и профессионального контакта.', href: '/master/', image: '/assets/webp/masterofcommication.webp' },
    ],
  },
};

const todayRouteKeys = ['calm', 'body', 'relationships', 'selfworth', 'selfstudy', 'communication', 'statework', 'professional'];
let currentTodayRouteKey = null;
let todayTouchStartX = 0;
let todayTouchStartY = 0;

function displayUserName(user) {
  if (!user) return '';
  const emailName = user.email ? user.email.split('@')[0] : '';
  const phoneName = user.phone ? user.phone.replace(/^\+7/, '+7 ') : '';
  return user.display_name || user.first_name || emailName || phoneName || '';
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function optionLabel(option) {
  return typeof option === 'string' ? option : option.label;
}

function optionValue(option) {
  return typeof option === 'string' ? option : option.value;
}

function selectedRouteKey(profile = onboardingState) {
  return routes[profile.focus] ? profile.focus : 'selfstudy';
}

function routeConfig(profile = onboardingState, routeKey) {
  const route = routes[routeKey || selectedRouteKey(profile)] || routes.selfstudy;
  const entry = profile.entry || 'material';
  const programs = route.programs || routes.selfstudy.programs;
  const primary = programs[0];
  const secondary = programs[1] || programs[0];
  const entryText = entry === 'audio'
    ? 'Начните с аудиоформата внутри выбранной программы.'
    : entry === 'short'
      ? 'Начните с первого материала, без поиска по каталогу.'
      : 'Начните с видео внутри выбранной программы.';
  const copy = {
    ...route,
    primary,
    secondary,
    firstStep: primary.title,
    firstStepDesc: `${primary.desc} ${entryText}`,
    href: primary.href,
    image: primary.image,
    hero: primary.image,
  };
  return copy;
}

function playSplashSound() {
  if (splashSoundPlayed) return;
  splashSoundPlayed = true;
  try {
    const audio = new Audio(SPLASH_AUDIO_SRC);
    audio.preload = 'auto';
    audio.volume = 0.9;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
  } catch (e) {}
}

function showNewHomeState(state) {
  if (state === 'splash') playSplashSound();
  document.documentElement.classList.remove('home-boot-today', 'home-boot-first-run');
  document.body.classList.toggle('home-splash-active', state === 'splash');
  document.body.classList.toggle('home-first-run-active', state === 'intro' || state === 'onboarding' || state === 'splash');
  document.body.classList.toggle('home-today-active', state === 'today');
  document.getElementById('system-intro')?.classList.toggle('hidden', state !== 'intro');
  document.getElementById('onboarding-flow')?.classList.toggle('hidden', state !== 'onboarding');
  document.getElementById('today-screen')?.classList.toggle('hidden', state !== 'today');
  document.body.classList.toggle('home-onboarding-active', state !== 'today');
}

function showAuthGatewayMode(mode) {
  const welcome = document.querySelector('[data-auth-welcome]');
  const providers = document.querySelector('[data-auth-providers]');
  if (welcome) welcome.classList.toggle('hidden', mode !== 'welcome');
  if (providers) providers.classList.toggle('hidden', mode !== 'providers');
}

function renderToday(routeKey) {
  const profile = JSON.parse(localStorage.getItem(ONBOARDING_PROFILE_KEY) || '{}');
  currentTodayRouteKey = routeKey || currentTodayRouteKey || selectedRouteKey(profile);
  const route = routeConfig(profile, currentTodayRouteKey);
  const routeIndex = Math.max(0, todayRouteKeys.indexOf(currentTodayRouteKey));
  const todayTitle = document.querySelector('[data-today-title]');
  const todaySubtitle = document.querySelector('[data-today-subtitle]');
  const stepTitle = document.querySelector('[data-today-step-title]');
  const stepDesc = document.querySelector('[data-today-step-desc]');
  const hero = document.querySelector('[data-today-hero]');
  const main = document.querySelector('[data-today-main]');
  const secondaryCard = document.querySelector('[data-today-secondary]');
  const secondaryTitle = document.querySelector('[data-today-secondary-title]');
  const secondaryDesc = document.querySelector('[data-today-secondary-desc]');
  const secondaryLink = document.querySelector('[data-today-secondary-link]');
  const primary = document.querySelector('[data-today-primary]');
  const heroAction = document.querySelector('[data-today-hero-action]');
  const progress = document.querySelector('[data-today-progress]');
  const dots = document.querySelector('[data-today-dots]');
  if (todayTitle) todayTitle.textContent = route.title;
  if (todaySubtitle) todaySubtitle.textContent = route.desc;
  if (stepTitle) stepTitle.textContent = route.firstStep;
  if (stepDesc) stepDesc.textContent = route.firstStepDesc;
  if (hero) hero.style.setProperty('--ux-bg', `url('${route.hero}')`);
  if (main) main.style.setProperty('--ux-bg', `url('${route.image}')`);
  if (secondaryCard && route.secondary) secondaryCard.style.setProperty('--ux-bg', `url('${route.secondary.image}')`);
  if (secondaryTitle && route.secondary) secondaryTitle.textContent = route.secondary.title;
  if (secondaryDesc && route.secondary) secondaryDesc.textContent = route.secondary.desc;
  if (secondaryLink && route.secondary) secondaryLink.setAttribute('href', route.secondary.href);
  if (primary) primary.setAttribute('href', route.href);
  if (heroAction) heroAction.setAttribute('href', route.href);
  if (progress) progress.textContent = `${routeIndex + 1} из ${todayRouteKeys.length}`;
  if (dots) {
    dots.innerHTML = todayRouteKeys.map((key) => `<span class="${key === currentTodayRouteKey ? 'active' : ''}"></span>`).join('');
  }
}

function shiftTodayRoute(delta) {
  const currentIndex = Math.max(0, todayRouteKeys.indexOf(currentTodayRouteKey || selectedRouteKey(JSON.parse(localStorage.getItem(ONBOARDING_PROFILE_KEY) || '{}'))));
  const nextIndex = (currentIndex + delta + todayRouteKeys.length) % todayRouteKeys.length;
  renderToday(todayRouteKeys[nextIndex]);
}

function finishOnboarding() {
  const route = routeConfig();
  localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  localStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify({
    ...onboardingState,
    routeKey: selectedRouteKey(),
    route: route.title,
    firstStep: route.firstStep,
    firstStepHref: route.href,
    secondStep: route.secondary?.title,
    secondStepHref: route.secondary?.href,
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
  const dots = document.querySelector('[data-onboarding-dots]');
  const options = document.querySelector('[data-onboarding-options]');
  const back = document.querySelector('[data-onboarding-back]');
  const next = document.querySelector('[data-onboarding-next]');
  if (label) label.textContent = step.label;
  if (title) title.textContent = step.title;
  if (desc) desc.textContent = step.desc;
  if (progress) progress.style.width = `${((onboardingIndex + 1) / onboardingSteps.length) * 100}%`;
  if (dots) {
    dots.innerHTML = onboardingSteps.map((_, index) => `<span class="${index === onboardingIndex ? 'active' : ''} ${index < onboardingIndex ? 'done' : ''}"></span>`).join('');
  }
  if (back) back.disabled = onboardingIndex === 0;
  if (next) next.textContent = onboardingIndex === onboardingSteps.length - 1 ? 'Начать' : 'Далее';
  const hint = document.querySelector('[data-onboarding-hint]');
  const result = document.querySelector('[data-onboarding-result]');
  if (hint) {
    hint.textContent = step.result
      ? 'Рекомендацию можно изменить позже'
      : 'Выберите один вариант';
  }
  if (!options) return;
  options.classList.toggle('hidden', Boolean(step.result));
  if (result) result.classList.toggle('hidden', !step.result);
  if (step.result) {
    const route = routeConfig();
    document.querySelector('[data-result-kicker]').textContent = 'Сегодня';
    document.querySelector('[data-result-title]').textContent = route.title;
    document.querySelector('[data-result-desc]').textContent = `${route.primary.title} и ${route.secondary.title}. Две программы появятся на главной.`;
    return;
  }
  const selected = asArray(onboardingState[step.key]);
  options.innerHTML = step.options.map((option) => {
    const value = optionValue(option);
    return `
    <button type="button" class="${selected.includes(value) ? 'active' : ''}" data-onboarding-option="${value}">
      <span>${optionLabel(option)}</span>
      <i aria-hidden="true"></i>
    </button>
  `;
  }).join('');
}

function selectOnboardingOption(step, value) {
  if (!step.multiple) {
    onboardingState[step.key] = value;
    return;
  }
  const selected = new Set(asArray(onboardingState[step.key]));
  if (selected.has(value)) selected.delete(value);
  else selected.add(value);
  onboardingState[step.key] = Array.from(selected);
}

function hasStepAnswer(step) {
  if (step.result) return true;
  const value = onboardingState[step.key];
  return step.multiple ? asArray(value).length > 0 : Boolean(value);
}

function initOnboarding() {
  document.querySelector('[data-intro-login]')?.addEventListener('click', () => {
    showAuthGatewayMode('providers');
  });
  document.querySelector('[data-auth-choice-back]')?.addEventListener('click', () => {
    showAuthGatewayMode('welcome');
  });
  document.querySelector('[data-telegram-login]')?.addEventListener('click', () => {
    if (window.startTelegramLogin) window.startTelegramLogin();
    else if (window.openAuthModal) window.openAuthModal();
  });
  document.querySelector('[data-yandex-login]')?.addEventListener('click', () => {
    if (window.API && window.API.yandexLoginUrl) window.location.href = window.API.yandexLoginUrl();
  });
  document.querySelector('[data-onboarding-start]')?.addEventListener('click', () => {
    onboardingIndex = 0;
    renderOnboarding();
    showNewHomeState('onboarding');
  });
  document.querySelector('[data-onboarding-options]')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-onboarding-option]');
    if (!button) return;
    const step = onboardingSteps[onboardingIndex];
    selectOnboardingOption(step, button.dataset.onboardingOption);
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
    if (!hasStepAnswer(step)) {
      const first = step.options[0];
      onboardingState[step.key] = step.multiple ? [optionValue(first)] : optionValue(first);
    }
    onboardingIndex += 1;
    renderOnboarding();
  });
  document.querySelector('[data-today-prev]')?.addEventListener('click', () => shiftTodayRoute(-1));
  document.querySelector('[data-today-next]')?.addEventListener('click', () => shiftTodayRoute(1));
  document.querySelector('[data-today-hero]')?.addEventListener('touchstart', (event) => {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    todayTouchStartX = touch.clientX;
    todayTouchStartY = touch.clientY;
  }, { passive: true });
  document.querySelector('[data-today-hero]')?.addEventListener('touchend', (event) => {
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - todayTouchStartX;
    const dy = touch.clientY - todayTouchStartY;
    if (Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    shiftTodayRoute(dx < 0 ? 1 : -1);
  }, { passive: true });
  const completed = localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
  const splashSeen = localStorage.getItem(SPLASH_SEEN_KEY) === 'true';
  if (completed) {
    renderToday();
    showNewHomeState('today');
    return;
  }
  if (!splashSeen) {
    showNewHomeState('splash');
    localStorage.setItem(SPLASH_SEEN_KEY, 'true');
    window.setTimeout(() => showNewHomeState('intro'), 2400);
    return;
  }
  showNewHomeState('intro');
}

window.refreshAuthUI = function(user) {
  const btn = document.getElementById('nav-auth-btn');
  const link = document.getElementById('nav-account-link');
  const greeting = document.querySelector('[data-today-greeting]');
  const name = displayUserName(user);
  if (user || window.API.isLoggedIn()) {
    if (btn) btn.style.display = 'none';
    if (link) link.style.display = 'inline-flex';
  }
  if (greeting) greeting.textContent = name ? `Добро пожаловать, ${name}` : 'Добро пожаловать';
};

if (window.API.isLoggedIn()) {
  window.API.me().then(r => window.refreshAuthUI(r.user)).catch(() => {});
}

initOnboarding();
