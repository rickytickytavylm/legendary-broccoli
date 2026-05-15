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
    desc: 'Выберите ближайший запрос. Система подберет одну программу для старта.',
    options: [
      { value: 'calm', label: 'Спокойствие' },
      { value: 'body', label: 'Тело / симптомы' },
      { value: 'relationships', label: 'Отношения' },
      { value: 'selfworth', label: 'Самооценка / опора' },
      { value: 'selfstudy', label: 'Понять себя глубже' },
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
      { value: 'ai', label: 'С AI' },
    ],
  },
  {
    key: 'result',
    label: 'Шаг 3 из 3',
    title: 'Программа выбрана',
    desc: 'Это стартовая рекомендация. Весь каталог остается доступен в разделе “Программы”.',
    result: true,
    options: [],
  },
];

const onboardingState = {};
let onboardingIndex = 0;

const routes = {
  calm: {
    title: 'Начните с Гештальта',
    desc: 'Для спокойного входа: эмоции, контакт, границы и возвращение к себе.',
    short: 'спокойствие',
    firstStep: 'Гештальт-подход',
    firstStepDesc: 'Откройте программу “Гештальт-подход” и начните с первого материала.',
    href: '/geshtalt/',
    image: '/assets/webp/courses.webp',
    hero: '/assets/webp/new_geshtalt.webp',
  },
  body: {
    title: 'Понять тело и симптомы',
    desc: 'Сегодня: увидеть связь состояния и тела без самодиагностики.',
    short: 'тело и симптомы',
    firstStep: 'Психосоматика',
    firstStepDesc: 'Посмотрите первый материал по психосоматике и отметьте, где это проявляется в теле.',
    href: '/psihosomatika/',
    image: '/assets/webp/psysomatic.webp',
    hero: '/assets/webp/psysomatic.webp',
  },
  relationships: {
    title: 'Разобраться в отношениях',
    desc: 'Сегодня: увидеть один повторяющийся сценарий в контакте.',
    short: 'отношения',
    firstStep: 'Границы и близость',
    firstStepDesc: 'Откройте материал про границы и сформулируйте один пример из своей жизни.',
    href: '/sozavisimost/',
    image: '/assets/webp/coda2.webp',
    hero: '/assets/webp/man_woman.webp',
  },
  selfworth: {
    title: 'Опора через Гештальт',
    desc: 'Для работы с самооценкой начните с контакта с собой и своими потребностями.',
    short: 'самооценка и опора',
    firstStep: 'Гештальт-подход',
    firstStepDesc: 'Откройте программу “Гештальт-подход”: это самый точный старт для опоры и самопонимания.',
    href: '/geshtalt/',
    image: '/assets/webp/courses.webp',
    hero: '/assets/webp/new_geshtalt.webp',
  },
  selfstudy: {
    title: 'Понять себя глубже',
    desc: 'Сегодня: назвать эмоцию, потребность и то, что мешает контакту.',
    short: 'самопонимание',
    firstStep: 'Гештальт-подход',
    firstStepDesc: 'Откройте вводный материал по гештальту. Таймкоды и AI-разбор помогут взять главное.',
    href: '/geshtalt/',
    image: '/assets/webp/courses.webp',
    hero: '/assets/webp/new_geshtalt.webp',
  },
  professional: {
    title: 'Профессиональный разбор',
    desc: 'Сегодня: взять один профессиональный разбор и применить его к практике.',
    short: 'профессиональный интерес',
    firstStep: 'Супервизия',
    firstStepDesc: 'Откройте супервизионный материал и сформулируйте вопрос для разбора.',
    href: '/superviziya/',
    image: '/assets/webp/supervision.webp',
    hero: '/assets/webp/supervision.webp',
  },
};

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

function routeConfig(profile = onboardingState) {
  const route = routes[selectedRouteKey(profile)] || routes.selfstudy;
  const entry = profile.entry || 'material';
  const copy = { ...route };
  if (entry === 'ai') {
    copy.firstStep = 'Разобрать запрос с AI';
    copy.firstStepDesc = `Скажите AI, что сейчас важнее: ${route.short}. Он предложит материал и поможет начать без поиска.`;
    copy.href = '/ai/';
    copy.image = '/assets/webp/ai_back.webp';
  } else if (entry === 'audio') {
    copy.firstStepDesc = `Откройте программу “${route.firstStep}” и переключитесь в аудиоформат.`;
  } else if (entry === 'short') {
    copy.firstStepDesc = `Начните с первого материала программы “${route.firstStep}”. Не нужно выбирать из каталога.`;
  } else if (entry === 'video') {
    copy.firstStepDesc = `Откройте видео в программе “${route.firstStep}”. Таймкоды и AI-разбор помогут взять главное.`;
  }
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

function renderToday() {
  const profile = JSON.parse(localStorage.getItem(ONBOARDING_PROFILE_KEY) || '{}');
  const route = routeConfig(profile);
  const todayTitle = document.querySelector('[data-today-title]');
  const todaySubtitle = document.querySelector('[data-today-subtitle]');
  const stepTitle = document.querySelector('[data-today-step-title]');
  const stepDesc = document.querySelector('[data-today-step-desc]');
  const hero = document.querySelector('[data-today-hero]');
  const main = document.querySelector('[data-today-main]');
  const primary = document.querySelector('[data-today-primary]');
  const heroAction = document.querySelector('[data-today-hero-action]');
  if (todayTitle) todayTitle.textContent = route.title;
  if (todaySubtitle) todaySubtitle.textContent = route.desc;
  if (stepTitle) stepTitle.textContent = route.firstStep;
  if (stepDesc) stepDesc.textContent = route.firstStepDesc;
  if (hero) hero.style.setProperty('--ux-bg', `url('${route.hero}')`);
  if (main) main.style.setProperty('--ux-bg', `url('${route.image}')`);
  if (primary) primary.setAttribute('href', route.href);
  if (heroAction) heroAction.setAttribute('href', route.href);
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
    document.querySelector('[data-result-title]').textContent = route.firstStep;
    document.querySelector('[data-result-desc]').textContent = `${route.desc} Первый шаг уже выбран, без каталога и лишнего поиска.`;
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
  if (user || window.API.isLoggedIn()) {
    if (btn) btn.style.display = 'none';
    if (link) link.style.display = 'inline-flex';
  }
};

if (window.API.isLoggedIn()) {
  window.API.me().then(r => window.refreshAuthUI(r.user)).catch(() => {});
}

initOnboarding();
