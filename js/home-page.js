const ONBOARDING_COMPLETE_KEY = 'sistema:onboarding-complete';
const ONBOARDING_PROFILE_KEY = 'sistema:onboarding-profile';
const SPLASH_SEEN_KEY = 'sistema:intro-splash-seen';

const onboardingSteps = [
  {
    key: 'focus',
    label: 'Шаг 1 из 6',
    title: 'С чем вы пришли сейчас?',
    desc: 'Можно выбрать несколько. Мы не ставим диагноз, а собираем стартовую траекторию.',
    multiple: true,
    options: [
      { value: 'stress', label: 'Тревога / стресс' },
      { value: 'body', label: 'Тело / симптомы' },
      { value: 'relationships', label: 'Отношения' },
      { value: 'selfworth', label: 'Самооценка / опора' },
      { value: 'conflict', label: 'Коммуникация / конфликт' },
      { value: 'selfstudy', label: 'Хочу понять себя' },
      { value: 'professional', label: 'Профессиональный интерес' },
    ],
  },
  {
    key: 'intensity',
    label: 'Шаг 2 из 6',
    title: 'Насколько это сейчас остро?',
    desc: 'Это помогает не отправлять вас в длинную лекцию, когда нужен мягкий вход.',
    options: [
      { value: 'calm', label: 'Спокойно, хочу разобраться' },
      { value: 'daily', label: 'Мешает в течение дня' },
      { value: 'strong', label: 'Сильно влияет на сон, работу или отношения' },
      { value: 'gentle', label: 'Сейчас тяжело, нужен очень мягкий вход' },
    ],
  },
  {
    key: 'manifestation',
    label: 'Шаг 3 из 6',
    title: 'Где это больше проявляется?',
    desc: 'Один запрос может жить в теле, мыслях, отношениях или действиях.',
    multiple: true,
    options: [
      { value: 'body', label: 'В теле' },
      { value: 'thoughts', label: 'В мыслях' },
      { value: 'relations', label: 'В отношениях' },
      { value: 'actions', label: 'В решениях и действиях' },
      { value: 'work', label: 'В работе / профессии' },
      { value: 'unclear', label: 'Пока не понимаю' },
    ],
  },
  {
    key: 'format',
    label: 'Шаг 4 из 6',
    title: 'Как вам проще начать?',
    desc: 'Выберите реальные форматы, не идеальную версию себя.',
    multiple: true,
    options: [
      { value: 'short', label: '5-10 минут' },
      { value: 'audio', label: 'Аудио' },
      { value: 'video', label: 'Видео' },
      { value: 'practice', label: 'Практика' },
      { value: 'deep', label: 'Глубокий разбор' },
      { value: 'ai', label: 'Разговор с AI' },
      { value: 'group', label: 'Группа / эфир' },
    ],
  },
  {
    key: 'experience',
    label: 'Шаг 5 из 6',
    title: 'Какой у вас опыт?',
    desc: 'От этого зависит язык маршрута: проще, глубже или профессиональнее.',
    options: [
      { value: 'first', label: 'Впервые' },
      { value: 'studied', label: 'Уже изучал психологию' },
      { value: 'therapy', label: 'Был опыт терапии' },
      { value: 'specialist', label: 'Я специалист' },
      { value: 'simple', label: 'Хочу без сложной теории' },
    ],
  },
  {
    key: 'result',
    label: 'Шаг 6 из 6',
    title: 'Ваш стартовый маршрут',
    desc: 'Это не диагноз. Это первый способ войти в Систему без перегруза.',
    result: true,
    options: [],
  },
];

const onboardingState = {};
let onboardingIndex = 0;

const routes = {
  stabilization: {
    title: 'Стабилизация и опора',
    desc: 'Сначала короткий материал и телесная регуляция, потом глубокие объяснения.',
    firstStep: 'Снизить стресс',
    firstStepDesc: 'Начните с короткого входа по стрессу. После этого AI поможет сформулировать наблюдение.',
    href: '/marathons/#section-stress',
    image: '/assets/webp/stress-mar.webp',
    hero: '/assets/webp/ai_back.webp',
  },
  body: {
    title: 'Тело и симптомы',
    desc: 'Маршрут через психосоматику, мягкую телесную практику и наблюдение состояния.',
    firstStep: 'Психосоматика',
    firstStepDesc: 'Начните с связи психики и тела, затем добавьте короткую практику.',
    href: '/psihosomatika/',
    image: '/assets/webp/psysomatic.webp',
    hero: '/assets/webp/psysomatic.webp',
  },
  relationships: {
    title: 'Отношения и границы',
    desc: 'Фокус на коммуникации, созависимости, конфликтах и возвращении собственной позиции.',
    firstStep: 'Границы и близость',
    firstStepDesc: 'Начните с отношений, затем можно перейти в созависимость или коммуникации.',
    href: '/sozavisimost/',
    image: '/assets/webp/coda2.webp',
    hero: '/assets/webp/man_woman.webp',
  },
  selfworth: {
    title: 'Самооценка и внутренняя опора',
    desc: 'Короткий вход через самооценку, затем гештальт и эмоциональный интеллект.',
    firstStep: 'Самооценка',
    firstStepDesc: 'Начните с марафона самооценки и сохраните один вывод после просмотра.',
    href: '/marathons/#section-samoocenka',
    image: '/assets/webp/myself_mar.webp',
    hero: '/assets/webp/myself_mar.webp',
  },
  selfstudy: {
    title: 'Понять себя глубже',
    desc: 'Базовый маршрут через гештальт: эмоции, потребности, контакт и сопротивления.',
    firstStep: 'Гештальт-подход',
    firstStepDesc: 'Начните с вводного материала, а таймкоды и AI-разбор помогут не утонуть в длинной лекции.',
    href: '/geshtalt/',
    image: '/assets/webp/courses.webp',
    hero: '/assets/webp/new_geshtalt.webp',
  },
  professional: {
    title: 'Профессиональная траектория',
    desc: 'Супервизия, терапевтические сессии, коммуникации и библиотека материалов.',
    firstStep: 'Супервизия',
    firstStepDesc: 'Начните с профессиональных разборов, затем добавьте гештальт-сессии и антологию.',
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
  const focus = asArray(profile.focus);
  const manifestation = asArray(profile.manifestation);
  const intensity = profile.intensity;
  const experience = profile.experience;
  if (experience === 'specialist' || focus.includes('professional') || manifestation.includes('work')) return 'professional';
  if (intensity === 'gentle' || intensity === 'strong' || focus.includes('stress')) return 'stabilization';
  if (focus.includes('body') || manifestation.includes('body')) return 'body';
  if (focus.includes('relationships') || focus.includes('conflict') || manifestation.includes('relations')) return 'relationships';
  if (focus.includes('selfworth')) return 'selfworth';
  return 'selfstudy';
}

function routeConfig(profile = onboardingState) {
  return routes[selectedRouteKey(profile)] || routes.selfstudy;
}

function showNewHomeState(state) {
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
  if (todayTitle) todayTitle.textContent = route.title;
  if (todaySubtitle) todaySubtitle.textContent = route.desc;
  if (stepTitle) stepTitle.textContent = route.firstStep;
  if (stepDesc) stepDesc.textContent = route.firstStepDesc;
  if (hero) hero.style.setProperty('--ux-bg', `url('${route.hero}')`);
  if (main) main.style.setProperty('--ux-bg', `url('${route.image}')`);
  if (primary) primary.setAttribute('href', route.href);
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
      ? 'Маршрут можно изменить позже'
      : (step.multiple ? 'Можно выбрать несколько вариантов' : 'Выберите один вариант');
  }
  if (!options) return;
  options.classList.toggle('hidden', Boolean(step.result));
  if (result) result.classList.toggle('hidden', !step.result);
  if (step.result) {
    const route = routeConfig();
    document.querySelector('[data-result-title]').textContent = route.title;
    document.querySelector('[data-result-desc]').textContent = `${route.desc} Первый шаг: ${route.firstStep}.`;
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
  document.querySelector('[data-today-checkin]')?.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    document.querySelectorAll('[data-today-checkin] button').forEach((item) => item.classList.toggle('active', item === button));
    localStorage.setItem('sistema:last-checkin', JSON.stringify({ value: button.textContent.trim(), at: new Date().toISOString() }));
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
