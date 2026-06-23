const ONBOARDING_COMPLETE_KEY = 'sistema:onboarding-complete';
const ONBOARDING_PROFILE_KEY = 'sistema:onboarding-profile';
const ONBOARDING_SCHEMA_KEY = 'sistema:onboarding-schema';
const ONBOARDING_SCHEMA_VERSION = 'device-v1';
const SPLASH_SEEN_KEY = 'sistema:intro-splash-seen';
const ONBOARDING_AFTER_AUTH_KEY = 'sistema:onboarding-after-auth';
const TODAY_OPENED_PROGRAMS_KEY = 'sistema:today-opened-programs';
const LIZA_TOUR_SEEN_KEY = 'sistema:liza-main-tour-seen';
const TODAY_LESSON_COUNT_ENDPOINTS = {
  geshtalt: '/content/geshtalt-lessons',
  sozavisimost: '/content/sozavisimost-lessons',
  psihosomatika: '/content/psihosomatika-lessons',
  mj: '/content/mj-lessons',
  yoga: '/content/yoga-lessons',
  dermer: '/content/dermer-lessons',
  gipnoz: '/content/gipnoz-lessons',
  master: '/content/master-lessons',
  superviziya: '/content/superviziya-lessons',
  antologiya: '/content/antologiya-lessons',
};

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  console.log('Captured beforeinstallprompt event for PWA installation');
});

const onboardingSteps = [
  {
    key: 'name',
    label: 'Шаг 1 из 5',
    title: 'Как вас зовут?',
    desc: 'Имя нужно только для личного обращения в профиле и рекомендациях.',
    input: {
      placeholder: 'Ваше имя',
    },
  },
  {
    key: 'focus',
    label: 'Шаг 2 из 5',
    title: 'Что сейчас важнее?',
    desc: 'Выберите направление. Система покажет две подходящие программы для старта.',
    options: [
      { value: 'calm', label: 'Йога / Забота о себе' },
      { value: 'body', label: 'Тело / симптомы' },
      { value: 'relationships', label: 'Отношения / созависимость' },
      { value: 'selfworth', label: 'Опора' },
      { value: 'selfstudy', label: 'Понять себя глубже' },
      { value: 'communication', label: 'Коммуникация / конфликты' },
    ],
  },
  {
    key: 'result',
    label: 'Шаг 3 из 5',
    title: 'Направление выбрано',
    desc: 'Покажем две подходящие программы. AI останется рядом и поможет выбрать между ними.',
    result: true,
  },
  {
    key: 'install',
    label: 'Шаг 4 из 5',
    title: 'Установка приложения',
    desc: 'Для лучшего отображения и мгновенных уведомлений на экране блокировки.',
    install: true,
  },
  {
    key: 'final',
    label: 'Шаг 5 из 5',
    title: 'Настройка уведомлений',
    desc: 'Оповещения будут отправляться на почту или push.',
    final: true,
  },
];

const onboardingState = {};
let onboardingIndex = 0;

function getDeviceContext() {
  const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
  const isAndroid = /android/i.test(ua);
  const isIOS = /ipad|iphone|ipod/.test(ua) && !window.MSStream;
  const isTelegram = /telegram/i.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isChrome = /chrome|crios/i.test(ua) && !/edge|opr|yf/i.test(ua);
  const isYandex = /yabrowser/i.test(ua);

  return { isAndroid, isIOS, isTelegram, isStandalone, isChrome, isYandex };
}

const routes = {
  calm: {
    title: 'Йога / Забота о себе',
    desc: 'Два мягких входа: через движение и через внимание к телу.',
    short: 'йога / забота о себе',
    heroImage: '/assets/webp/king_calm.webp',
    heroPos: 'center 38%',
    programs: [
      { title: 'Мини-йога', desc: 'Мягкое начало через дыхание и движение.', href: '/yoga/', image: '/assets/webp/mini-yoga.webp' },
      { title: 'Телесная терапия', desc: 'Вернуть внимание в тело и снизить внутреннее напряжение.', href: '/terapiya/', image: '/assets/webp/theraphy.webp' },
    ],
  },
  body: {
    title: 'Тело и симптомы',
    desc: 'Два входа: понять психосоматику и мягко вернуться в телесное ощущение.',
    short: 'тело и симптомы',
    heroImage: '/assets/webp/body.webp',
    heroPos: 'center 40%',
    programs: [
      { title: 'Психосоматика', desc: 'Связь эмоций, стресса и телесных симптомов.', href: '/psihosomatika/', image: '/assets/webp/psysomatic.webp' },
      { title: 'Телесная терапия', desc: 'Практики, которые возвращают внимание в тело.', href: '/terapiya/', image: '/assets/webp/theraphy.webp' },
    ],
  },
  relationships: {
    title: 'Отношения / созависимость',
    desc: 'Основной вход — созависимость; дополнительно — мужско-женская динамика.',
    short: 'отношения / созависимость',
    heroImage: '/assets/webp/new_soc.webp',
    heroPos: 'center 35%',
    programs: [
      { title: 'Созависимость', desc: 'Границы, привязанность и повторяющиеся сценарии.', href: '/sozavisimost/', image: '/assets/webp/coda2.webp' },
      { title: 'Мужское и Женское', desc: 'Психология отношений и природа полов.', href: '/mj/', image: '/assets/webp/man_woman.webp' },
    ],
  },
  selfworth: {
    title: 'Самооценка и опора',
    desc: 'Два входа: восстановление опоры и контакт с собой.',
    short: 'самооценка и опора',
    heroImage: '/assets/webp/opora.webp',
    heroPos: 'center 28%',
    programs: [
      { title: 'Работа с травмами', desc: 'Кризисы, травматичный опыт и восстановление опоры.', href: '/dermer/', image: '/assets/webp/geshtalt.webp' },
      { title: 'Гештальт-подход', desc: 'Контакт, эмоции, границы and возвращение к себе.', href: '/geshtalt/', image: '/assets/webp/courses.webp' },
    ],
  },
  selfstudy: {
    title: 'Понять себя глубже',
    desc: 'Два входа: базовая программа для самопонимания и работа с состояниями внимания.',
    short: 'самопонимание',
    heroImage: '/assets/webp/find_myself.webp',
    heroPos: 'center 35%',
    programs: [
      { title: 'Гештальт-подход', desc: 'Эмоции, потребности, контакт и границы.', href: '/geshtalt/', image: '/assets/webp/courses.webp' },
      { title: 'Гипноз', desc: 'Внимание, трансовые состояния и безопасная работа с внушением.', href: '/gipnoz/', image: '/assets/webp/hipno.webp' },
    ],
  },
  communication: {
    title: 'Коммуникация и конфликты',
    desc: 'Два входа: навыки общения и сценарии в отношениях.',
    short: 'коммуникация и конфликты',
    heroImage: '/assets/webp/conflicts_programs.webp',
    heroPos: 'center 42%',
    programs: [
      { title: 'Мастер Коммуникаций', desc: 'Навыки общения, диалог и управление конфликтом.', href: '/master/', image: '/assets/webp/masterofcommication.webp' },
      { title: 'Созависимость', desc: 'Границы и повторяющиеся сценарии в контакте.', href: '/sozavisimost/', image: '/assets/webp/coda2.webp' },
    ],
  },
};

const todayRouteKeys = ['calm', 'body', 'relationships', 'selfworth', 'selfstudy', 'communication'];
let currentTodayRouteKey = null;
let todayTouchStartX = 0;
let todayTouchStartY = 0;
let pendingLizaTour = false;

function displayUserName(user) {
  if (!user) return '';
  const emailName = user.email ? user.email.split('@')[0] : '';
  const phoneName = user.phone ? user.phone.replace(/^\+7/, '+7 ') : '';
  return user.display_name || user.first_name || user.yandex_login || emailName || phoneName || '';
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

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function routeConfig(profile = onboardingState, routeKey) {
  const route = routes[routeKey || selectedRouteKey(profile)] || routes.selfstudy;
  const entry = 'video';
  const programs = route.programs || routes.selfstudy.programs;
  const primary = programs[0];
  const secondary = programs[1] || programs[0];
  const entryText = 'Начните с первого материала внутри выбранной программы.';
  const copy = {
    ...route,
    primary,
    secondary,
    firstStep: primary.title,
    firstStepDesc: `${primary.desc} ${entryText}`,
    href: primary.href,
    image: primary.image,
    hero: route.heroImage || primary.image,
  };
  return copy;
}

function onboardingProfile() {
  try {
    return JSON.parse(localStorage.getItem(ONBOARDING_PROFILE_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function saveTodayRouteKey(routeKey, sync = true) {
  if (!routes[routeKey]) return;
  const profile = onboardingProfile();
  const route = routeConfig(profile, routeKey);
  const savedProfile = {
    ...profile,
    focus: routeKey,
    routeKey,
    route: route.title,
    focusLabel: route.title,
    firstStep: route.firstStep,
    firstStepDesc: route.firstStepDesc,
    primary: route.primary,
    secondary: route.secondary,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(savedProfile));
  if (sync && window.API?.trackActivity) {
    window.API.trackActivity('onboarding_route_changed', {
      entity_type: 'onboarding',
      entity_id: routeKey,
      metadata: savedProfile,
    }).catch(() => {});
  }
}

function syncTodayRouteFromRecentActivity(activity = []) {
  const latest = (activity || []).find((item) => item.event_type === 'onboarding_route_changed' && item.metadata?.routeKey);
  if (!latest || !routes[latest.metadata.routeKey]) return false;
  const local = onboardingProfile();
  const localAt = Date.parse(local.updatedAt || local.completedAt || 0) || 0;
  const remoteAt = Date.parse(latest.created_at || latest.metadata.updatedAt || 0) || 0;
  if (remoteAt && remoteAt < localAt) return false;
  localStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(latest.metadata));
  currentTodayRouteKey = latest.metadata.routeKey;
  return true;
}

function programSlugFromHref(href = '') {
  return href.replace(/^https?:\/\/[^/]+/i, '').split('?')[0].replace(/^\/|\/$/g, '');
}

function openedPrograms() {
  try {
    return JSON.parse(localStorage.getItem(TODAY_OPENED_PROGRAMS_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function markProgramOpened(href) {
  const slug = programSlugFromHref(href);
  if (!slug) return;
  localStorage.setItem(TODAY_OPENED_PROGRAMS_KEY, JSON.stringify({
    ...openedPrograms(),
    [slug]: new Date().toISOString(),
  }));
}

function programOpened(href) {
  const slug = programSlugFromHref(href);
  return Boolean(slug && openedPrograms()[slug]);
}

async function fetchProgramLessonCount(href) {
  const slug = programSlugFromHref(href);
  if (!slug || !window.API?.getProgram) return null;
  try {
    const data = await window.API.getProgram(slug);
    return Array.isArray(data.lessons) ? data.lessons.length : null;
  } catch (e) {
    const fallbackEndpoint = TODAY_LESSON_COUNT_ENDPOINTS[slug];
    if (!fallbackEndpoint || !window.API?.request) return null;
    try {
      const data = await window.API.request('GET', fallbackEndpoint);
      return Array.isArray(data.lessons) ? data.lessons.length : null;
    } catch (fallbackError) {
      return null;
    }
  }
}

function setTodayProgramState(prefix, program) {
  const link = document.querySelector(`[data-today-${prefix === 'primary' ? 'primary' : 'secondary-link'}]`);
  const action = document.querySelector(`[data-today-${prefix}-action]`);
  const href = program?.href || '';
  if (link && program?.href) link.setAttribute('href', program.href);
  if (action) action.textContent = programOpened(href) ? 'Продолжить' : 'Начать';
}

function playSplashSound() {
  // Splash is intentionally silent.
}

function resetLocalOnboardingForFreshDevice() {
  localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
  localStorage.removeItem(ONBOARDING_PROFILE_KEY);
  localStorage.removeItem(ONBOARDING_SCHEMA_KEY);
  localStorage.removeItem(SPLASH_SEEN_KEY);
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
  const profile = onboardingProfile();
  currentTodayRouteKey = routeKey || currentTodayRouteKey || selectedRouteKey(profile);
  const route = routeConfig(profile, currentTodayRouteKey);
  const kicker = document.querySelector('[data-today-kicker]');
  const todayTitle = document.querySelector('[data-today-title]');
  const todaySubtitle = document.querySelector('[data-today-subtitle]');
  const stepTitle = document.querySelector('[data-today-step-title]');
  const stepDesc = document.querySelector('[data-today-step-desc]');
  const hero = document.querySelector('[data-today-hero]');
  const main = document.querySelector('[data-today-main]');
  const secondaryCard = document.querySelector('[data-today-secondary]');
  const secondaryTitle = document.querySelector('[data-today-secondary-title]');
  const secondaryDesc = document.querySelector('[data-today-secondary-desc]');
  const dots = document.querySelector('[data-today-dots]');
  if (kicker) {
    const name = cleanName(profile.name);
    kicker.textContent = name ? `Добро пожаловать, ${name}` : 'Сегодня';
  }
  if (todayTitle) todayTitle.textContent = route.title;
  if (todaySubtitle) todaySubtitle.textContent = route.desc;
  if (stepTitle) stepTitle.textContent = route.firstStep;
  if (stepDesc) stepDesc.textContent = route.firstStepDesc;
  if (hero) {
    hero.style.setProperty('--ux-bg', `url('${route.hero}')`);
    if (route.heroPos) {
      hero.style.setProperty('--ux-bg-pos', route.heroPos);
    } else {
      hero.style.removeProperty('--ux-bg-pos');
    }
  }
  if (main) main.style.setProperty('--ux-bg', `url('${route.image}')`);
  if (secondaryCard && route.secondary) secondaryCard.style.setProperty('--ux-bg', `url('${route.secondary.image}')`);
  if (secondaryTitle && route.secondary) secondaryTitle.textContent = route.secondary.title;
  if (secondaryDesc && route.secondary) secondaryDesc.textContent = route.secondary.desc;
  setTodayProgramState('primary', route.primary);
  setTodayProgramState('secondary', route.secondary);
  if (dots) {
    dots.innerHTML = todayRouteKeys.map((key) => `<span class="${key === currentTodayRouteKey ? 'active' : ''}"></span>`).join('');
  }
  const therapyRoute = currentTodayRouteKey || selectedRouteKey(profile);
  const therapyCfg = window.SISTEMA_THERAPY_GROUPS && window.SISTEMA_THERAPY_GROUPS[therapyRoute];
  const therapyState = window.getTherapyGroupCardState
    ? window.getTherapyGroupCardState(therapyRoute)
    : null;
  const therapyCard = document.querySelector('[data-today-therapy-group]');
  const therapyPanel = document.querySelector('[data-today-therapy-panel]');
  if (therapyCard && therapyCfg && therapyState) {
    therapyCard.classList.remove('is-soon');
    therapyCard.href = therapyState.href;
    therapyCard.removeAttribute('aria-disabled');
    if (therapyState.external) {
      therapyCard.setAttribute('target', '_blank');
      therapyCard.setAttribute('rel', 'noopener noreferrer');
    } else {
      therapyCard.removeAttribute('target');
      therapyCard.removeAttribute('rel');
    }
    therapyCard.style.setProperty('--ux-bg', `url('${therapyCfg.image}')`);
    therapyCard.setAttribute('aria-label', therapyState.external ? 'Открыть йога-клуб' : 'Открыть терапевтическую группу');
    const therapyTitle = therapyCard.querySelector('[data-today-therapy-title]');
    const therapyLeader = therapyCard.querySelector('[data-today-therapy-leader]');
    const therapyDesc = therapyCard.querySelector('[data-today-therapy-desc]');
    const therapySoon = therapyCard.querySelector('[data-therapy-soon-badge]');
    const therapyPro = therapyCard.querySelector('[data-therapy-pro-badge]');
    const therapyCta = therapyCard.querySelector('[data-therapy-cta]');
    if (therapyTitle) therapyTitle.textContent = therapyState.cardTitle;
    if (therapyLeader) therapyLeader.textContent = therapyState.leader;
    if (therapyDesc) therapyDesc.textContent = therapyState.desc;
    if (therapySoon) therapySoon.classList.add('hidden');
    if (therapyPro) therapyPro.classList.toggle('hidden', !therapyState.showPro);
    if (therapyCta) therapyCta.textContent = therapyState.cta;
    if (therapyPanel) {
      const panelKicker = therapyPanel.querySelector('[data-therapy-panel-kicker]');
      const panelTitle = therapyPanel.querySelector('[data-therapy-panel-title]');
      const panelSubtitle = therapyPanel.querySelector('[data-therapy-panel-subtitle]');
      if (panelKicker) panelKicker.classList.toggle('hidden', !therapyState.showPro);
      if (panelTitle) panelTitle.textContent = therapyState.panelTitle;
      if (panelSubtitle) panelSubtitle.textContent = therapyState.panelSubtitle;
    }
  }
}

function shiftTodayRoute(delta) {
  const currentIndex = Math.max(0, todayRouteKeys.indexOf(currentTodayRouteKey || selectedRouteKey(JSON.parse(localStorage.getItem(ONBOARDING_PROFILE_KEY) || '{}'))));
  const nextIndex = (currentIndex + delta + todayRouteKeys.length) % todayRouteKeys.length;
  const nextKey = todayRouteKeys[nextIndex];
  saveTodayRouteKey(nextKey);
  renderToday(nextKey);
}

const lizaTourSteps = [
  {
    kicker: 'Добро пожаловать',
    title: 'Я Лиза, ваш AI-проводник',
    text: 'Система подбирает для вас маршрут, программы и практики на вкладке «Сегодня». Если понадобится помощь, Лиза находится ниже в разделе «Помощь и поддержка».',
  },
];

function showLizaTourIfNeeded(force = false) {
  const tour = document.getElementById('liza-tour');
  if (!tour) return;
  if (!force && localStorage.getItem(LIZA_TOUR_SEEN_KEY) === 'true') return;
  const kicker = document.getElementById('liza-tour-kicker');
  const title = document.getElementById('liza-tour-title');
  const text = document.getElementById('liza-tour-text');
  const next = document.getElementById('liza-tour-next');
  const closeButtons = tour.querySelectorAll('[data-liza-tour-skip]');

  function renderStep() {
    const step = lizaTourSteps[0];
    if (kicker) kicker.textContent = step.kicker;
    if (title) title.textContent = step.title;
    if (text) text.textContent = step.text;
    if (next) next.textContent = 'Понятно';
  }

  function closeTour() {
    localStorage.setItem(LIZA_TOUR_SEEN_KEY, 'true');
    tour.classList.add('hidden');
    tour.setAttribute('aria-hidden', 'true');
  }

  if (next && next.dataset.lizaTourBound !== 'true') {
    next.dataset.lizaTourBound = 'true';
    next.addEventListener('click', closeTour);
  }

  closeButtons.forEach((button) => {
    if (button.dataset.lizaTourBound === 'true') return;
    button.dataset.lizaTourBound = 'true';
    button.addEventListener('click', closeTour);
  });

  renderStep();
  tour.classList.remove('hidden');
  tour.setAttribute('aria-hidden', 'false');
}

function finishOnboarding() {
  const route = routeConfig();
  onboardingState.name = cleanName(onboardingState.name) || displayUserName(window.__sistemaCurrentUser) || 'Пользователь';
  const completedAt = new Date().toISOString();
  const savedProfile = {
    ...onboardingState,
    routeKey: selectedRouteKey(),
    route: route.title,
    focusLabel: route.title,
    firstStep: route.firstStep,
    firstStepHref: route.href,
    secondStep: route.secondary?.title,
    secondStepHref: route.secondary?.href,
    primary: route.primary,
    secondary: route.secondary,
    completedAt,
  };
  localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  localStorage.setItem(ONBOARDING_SCHEMA_KEY, ONBOARDING_SCHEMA_VERSION);
  localStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(savedProfile));
  if (window.API?.updateProfile) {
    window.API.updateProfile({ display_name: onboardingState.name, onboarding_complete: true }).catch(() => {});
  }
  if (window.API?.logActivity) {
    window.API.logActivity({
      event_type: 'onboarding_complete',
      entity_type: 'onboarding',
      entity_id: savedProfile.routeKey,
      metadata: savedProfile,
    }).catch(() => {});
  }
  renderToday();
  showNewHomeState('today');
  pendingLizaTour = true;
  window.setTimeout(() => showLizaTourIfNeeded(true), 450);
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
  const hint = document.querySelector('[data-onboarding-hint]');
  const result = document.querySelector('[data-onboarding-result]');
  const input = document.querySelector('[data-onboarding-name-input]');
  const inlineBtn = document.querySelector('[data-onboarding-inline-btn]');

  const ctx = getDeviceContext();

  // Dynamic content overrides for PWA install and Final steps based on browser/device context
  if (step.install) {
    if (ctx.isStandalone) {
      step.title = 'Приложение установлено!';
      step.desc = 'Система уже запущена как полноценное PWA приложение. Пользуйтесь с удовольствием!';
    } else if (ctx.isIOS) {
      step.title = 'Установка на iPhone';
      if (ctx.isTelegram) {
        step.desc = 'Вы открыли Систему внутри Telegram. Чтобы установить PWA, нажмите на иконку Safari внизу, выберите «Открыть в Safari», а затем следуйте инструкции.';
      } else {
        step.desc = 'Для работы во весь экран без рамок браузера и мгновенного доступа установите приложение на домашний экран.';
      }
    } else if (ctx.isAndroid) {
      step.title = 'Установка на Android';
      if (deferredInstallPrompt) {
        step.desc = 'Нажмите «Установить» ниже, чтобы добавить Систему на главный экран для мгновенного доступа и мгновенных push-уведомлений.';
      } else if (ctx.isTelegram) {
        step.desc = 'Вы открыли Систему внутри Telegram. Чтобы запустить установку, нажмите на три точки вверху, выберите «Открыть в Chrome», а затем нажмите кнопку «Установить».';
      } else if (ctx.isYandex) {
        step.desc = 'В Яндекс.Браузере вы можете добавить ярлык через меню (три точки → Добавить на главный экран). Или откройте сайт в Google Chrome для стандартной установки.';
      } else {
        step.desc = 'Для запуска во весь экран без адресной строки рекомендуем использовать Google Chrome. Вы также можете добавить ярлык через меню вашего текущего браузера.';
      }
    } else {
      step.title = 'Установка приложения';
      if (deferredInstallPrompt) {
        step.desc = 'Установите Систему на компьютер как полноценное приложение.';
      } else {
        step.desc = 'Для лучшего отображения откройте сайт в браузере Google Chrome и нажмите на иконку «Установить» в правой части адресной строки.';
      }
    }
  } else if (step.final) {
    step.title = 'Настройка уведомлений';
    if (ctx.isStandalone) {
      step.desc = 'Всё готово! Разрешите отправку уведомлений при первом запуске, чтобы вовремя получать информацию о практиках, вебинарах и обновлениях.';
    } else if (onboardingState.installChoice === 'skipped') {
      step.desc = 'Установку можно будет сделать позже. Пока важные напоминания и материалы будем отправлять на почту. В Яндекс.Почте такие письма могут попадать в категорию «Рассылки».';
    } else if (ctx.isIOS) {
      step.desc = 'После добавления на домашний экран откройте приложение и разрешите уведомления. До установки напоминания будут приходить на почту; в Яндекс.Почте проверьте категорию «Рассылки».';
    } else if (ctx.isAndroid) {
      step.desc = 'Push-уведомления будут приходить после установки приложения. Если установка была пропущена — напоминания отправляем на почту. В Яндекс.Почте они могут быть в «Рассылках».';
    } else {
      step.desc = 'Оповещения будут отправляться на указанную при регистрации почту. В Яндекс.Почте письма могут попадать в «Рассылки». Установите PWA приложение для push-уведомлений на рабочий стол.';
    }
  }

  if (label) label.textContent = step.label;
  if (title) title.textContent = step.title;
  if (desc) desc.textContent = step.desc;
  if (progress) progress.style.width = `${((onboardingIndex + 1) / onboardingSteps.length) * 100}%`;
  if (dots) {
    dots.innerHTML = onboardingSteps.map((_, index) => `<span class="${index === onboardingIndex ? 'active' : ''} ${index < onboardingIndex ? 'done' : ''}"></span>`).join('');
  }
  if (back) back.disabled = onboardingIndex === 0;
  if (next) next.textContent = onboardingIndex === onboardingSteps.length - 1 ? 'В систему' : 'Далее';
  
  if (hint) {
    hint.classList.toggle('hidden', Boolean(step.install || step.final));
    hint.textContent = step.input
      ? 'Введите имя'
      : step.result
      ? 'Рекомендацию можно изменить позже'
      : 'Выберите один вариант';
  }
  if (!options) return;
  
  options.classList.toggle('hidden', Boolean(step.result || step.input || step.install || step.final));
  if (result) result.classList.toggle('hidden', !step.result);

  const installCard = document.getElementById('onboarding-install-card');
  const skipBtn = document.getElementById('onboarding-install-skip-btn');
  const finalCard = document.getElementById('onboarding-final-card');
  
  if (finalCard) finalCard.classList.toggle('hidden', !step.final);
  
  if (installCard) {
    installCard.classList.toggle('hidden', !step.install);
    if (skipBtn) skipBtn.classList.toggle('hidden', !step.install);
    
    if (step.install) {
      const androidBtn = document.getElementById('onboarding-install-android-btn');
      const iosBtn = document.getElementById('onboarding-install-ios-btn');

      if (ctx.isStandalone) {
        if (androidBtn) androidBtn.classList.add('hidden');
        if (iosBtn) iosBtn.classList.add('hidden');
      } else {
        if (ctx.isAndroid) {
          if (androidBtn) {
            androidBtn.classList.remove('hidden');
            androidBtn.textContent = 'Установить';
          }
          if (iosBtn) iosBtn.classList.add('hidden');
        } else if (ctx.isIOS) {
          if (androidBtn) androidBtn.classList.add('hidden');
          if (iosBtn) {
            iosBtn.classList.toggle('hidden', ctx.isTelegram);
            iosBtn.textContent = 'Как установить?';
          }
        } else {
          if (deferredInstallPrompt) {
            if (androidBtn) {
              androidBtn.classList.remove('hidden');
              androidBtn.textContent = 'Установить';
            }
          } else {
            if (androidBtn) androidBtn.classList.add('hidden');
          }
          if (iosBtn) iosBtn.classList.add('hidden');
        }
      }
    }
  }

  if (input) {
    input.classList.toggle('hidden', !step.input);
    if (step.input) {
      input.placeholder = step.input.placeholder;
      input.value = onboardingState.name || '';
      if (!input.dataset.bound) {
        input.setAttribute('data-bound', 'true');
        input.addEventListener('input', () => {
          onboardingState.name = cleanName(input.value);
          if (inlineBtn) {
            inlineBtn.disabled = !hasStepAnswer(step);
          }
        });
      }
      window.setTimeout(() => input.focus(), 80);
    }
  }

  if (inlineBtn) {
    inlineBtn.classList.toggle('hidden', Boolean(step.install));
    if (step.install) {
      inlineBtn.style.setProperty('display', 'none', 'important');
    } else {
      inlineBtn.style.removeProperty('display');
    }
    inlineBtn.textContent = step.final ? 'В систему' : step.result ? 'Начать' : 'Далее';
    inlineBtn.disabled = !hasStepAnswer(step);
  }
  if (next) {
    next.closest('.onboarding-actions')?.classList.add('hidden');
  }

  if (step.input || step.install || step.final) {
    return;
  }
  if (step.result) {
    const route = routeConfig();
    if (result) result.style.setProperty('--result-bg', `url('${route.hero}')`);
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
  if (step.install) return true;
  if (step.final) return true;
  if (step.input) return cleanName(onboardingState[step.key]).length >= 2;
  const value = onboardingState[step.key];
  return step.multiple ? asArray(value).length > 0 : Boolean(value);
}

function initOnboarding() {
  function startYandexOnboardingLogin() {
    if (!window.API?.yandexLoginUrl) return;
    localStorage.setItem(ONBOARDING_AFTER_AUTH_KEY, 'true');
    window.location.href = window.API.yandexLoginUrl('/');
  }

  // Handle Android PWA installation click
  document.getElementById('onboarding-install-android-btn')?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      alert('Установка в данный момент недоступна. Браузер заблокировал системный диалог. Вы можете установить приложение через три точки в меню вашего браузера (Добавить на главный экран).');
      return;
    }
    const androidBtn = document.getElementById('onboarding-install-android-btn');
    if (androidBtn) {
      androidBtn.disabled = true;
      androidBtn.dataset.originalText = androidBtn.textContent;
      androidBtn.textContent = 'Установка…';
    }
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    deferredInstallPrompt = null;
    if (androidBtn) {
      androidBtn.disabled = false;
      androidBtn.textContent = androidBtn.dataset.originalText || 'Установить';
    }
    if (outcome === 'accepted') {
      onboardingState.installChoice = 'accepted';
      onboardingIndex += 1;
      renderOnboarding();
    }
  });

  // Handle iOS PWA guide modal triggers
  const iosModal = document.getElementById('pwa-ios-modal');
  const iosCloseBtn = document.getElementById('pwa-ios-close-btn');
  const iosOverlay = document.getElementById('pwa-ios-overlay');
  const iosConfirmBtn = document.getElementById('pwa-ios-confirm-btn');

  document.getElementById('onboarding-install-ios-btn')?.addEventListener('click', () => {
    if (iosModal) iosModal.classList.remove('hidden');
  });

  document.getElementById('onboarding-install-skip-btn')?.addEventListener('click', () => {
    onboardingState.installChoice = 'skipped';
    onboardingIndex += 1;
    renderOnboarding();
  });

  const closeIosModal = () => {
    if (iosModal) iosModal.classList.add('hidden');
  };

  iosCloseBtn?.addEventListener('click', closeIosModal);
  iosOverlay?.addEventListener('click', closeIosModal);
  iosConfirmBtn?.addEventListener('click', () => {
    closeIosModal();
    const step = onboardingSteps[onboardingIndex];
    if (step && step.install) {
      onboardingState.installChoice = 'guided';
      onboardingIndex += 1;
      renderOnboarding();
    }
  });

  document.querySelector('[data-intro-login]')?.addEventListener('click', () => {
    return;
  });
  document.querySelector('[data-auth-choice-back]')?.addEventListener('click', () => {
    showAuthGatewayMode('welcome');
  });
  document.querySelector('[data-telegram-login]')?.addEventListener('click', () => {
    return;
  });
  document.querySelector('[data-yandex-login]')?.addEventListener('click', () => {
    startYandexOnboardingLogin();
  });
  document.querySelector('[data-onboarding-start]')?.addEventListener('click', () => {
    onboardingIndex = 0;
    renderOnboarding();
    showNewHomeState('onboarding');
  });
  document.querySelector('[data-onboarding-inline-btn]')?.addEventListener('click', (ev) => {
    ev.preventDefault();
    document.querySelector('[data-onboarding-next]')?.click();
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
    if (onboardingIndex === onboardingSteps.length - 2 && onboardingSteps[onboardingIndex].install) {
      const ua = navigator.userAgent || navigator.vendor || window.opera;
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      if (isIOS && !isStandalone) {
        const iosModal = document.getElementById('pwa-ios-modal');
        if (iosModal) iosModal.classList.remove('hidden');
        return;
      }
    }
    const step = onboardingSteps[onboardingIndex];
    if (!hasStepAnswer(step)) {
      if (step.input) return;
      const first = step.options[0];
      onboardingState[step.key] = step.multiple ? [optionValue(first)] : optionValue(first);
    }
    onboardingIndex += 1;
    renderOnboarding();
  });
  document.querySelector('[data-today-prev]')?.addEventListener('click', () => shiftTodayRoute(-1));
  document.querySelector('[data-today-next]')?.addEventListener('click', () => shiftTodayRoute(1));
  document.querySelectorAll('[data-today-primary], [data-today-secondary-link]').forEach((link) => {
    link.addEventListener('click', () => markProgramOpened(link.getAttribute('href') || ''));
  });
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
  const isRealUser = (u) => {
    if (!u) return false;
    return !!(u.yandex_id || u.telegram_id || u.email || u.phone);
  };

  const isPWA = () => {
    if (window.navigator?.standalone === true) return true;
    return window.matchMedia?.('(display-mode: standalone)')?.matches || false;
  };

  const boot = (user) => {
    const realUser = isRealUser(user) ? user : null;
    window.__sistemaCurrentUser = realUser;
    const completed = !!realUser?.onboarding_complete;
    const continueOnboarding = localStorage.getItem(ONBOARDING_AFTER_AUTH_KEY) === 'true';
    const navEntry = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    const isBackForward = navEntry && (navEntry.type === 'back_forward' || navEntry.type === 'prerender');
    const skipHomeSplash = sessionStorage.getItem('skipHomeSplash') === '1';
    if (skipHomeSplash) sessionStorage.removeItem('skipHomeSplash');
    const skipSplashDelay = (isBackForward || skipHomeSplash) && realUser && completed;
    showNewHomeState('splash');
    if (realUser && !realUser.pwa_installed && isPWA()) {
      window.API?.updateProfile?.({ pwa_installed: true }).catch(() => {});
    }
    window.setTimeout(() => {
      if (realUser && continueOnboarding && !completed) {
        localStorage.removeItem(ONBOARDING_AFTER_AUTH_KEY);
        onboardingIndex = 0;
        onboardingState.name = displayUserName(realUser);
        renderOnboarding();
        showNewHomeState('onboarding');
        return;
      }
      if (!realUser) {
        localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
        showAuthGatewayMode('welcome');
        showNewHomeState('intro');
        return;
      }
      localStorage.removeItem(ONBOARDING_AFTER_AUTH_KEY);
      if (completed) {
        const showToday = () => {
          renderToday();
          showNewHomeState('today');
          if (pendingLizaTour) {
            pendingLizaTour = false;
            window.setTimeout(() => showLizaTourIfNeeded(), 450);
          }
        };
        if (window.API?.request) {
          window.API.request('GET', '/profile/dashboard', null, { fresh: true })
            .then((dashboard) => syncTodayRouteFromRecentActivity(dashboard?.recent_activity || []))
            .catch(() => {})
            .finally(showToday);
        } else {
          showToday();
        }
        return;
      }
      onboardingIndex = 0;
      onboardingState.name = displayUserName(realUser);
      renderOnboarding();
      showNewHomeState('onboarding');
    }, skipSplashDelay ? 0 : 1200);
  };

  const restoreAndBoot = () => {
    if (window.API?.restoreSession) {
      window.API.restoreSession()
        .then((user) => boot(user))
        .catch(() => boot(null));
      return;
    }
    boot(null);
  };

  window.addEventListener('auth:change', (event) => {
    const user = event?.detail?.user || window.__sistemaCurrentUser;
    if (user && isRealUser(user)) {
      const completed = !!user.onboarding_complete;
      localStorage.removeItem(ONBOARDING_AFTER_AUTH_KEY);
      if (completed) {
        renderToday();
        showNewHomeState('today');
      } else {
        onboardingIndex = 0;
        onboardingState.name = displayUserName(user);
        renderOnboarding();
        showNewHomeState('onboarding');
      }
    }
  });

  restoreAndBoot();
}

window.refreshAuthUI = function(user) {
  const btn = document.getElementById('nav-auth-btn');
  const link = document.getElementById('nav-account-link');
  if (btn) btn.style.display = 'none';
  if (link) link.style.display = 'inline-flex';
};

window.refreshAuthUI();

if (window.API.isLoggedIn()) {
  window.API.me().then(r => window.refreshAuthUI(r.user)).catch(() => {});
}

initOnboarding();

/* ─── Premium Physical Polaroid Quotes Stack Logic ─── */
function initInsightDeck() {
  const deck = document.getElementById('insight-deck');
  const prevBtn = document.getElementById('insight-prev-btn');
  const nextBtn = document.getElementById('insight-next-btn');
  const counterText = document.getElementById('insight-counter-text');
  const quoteText = document.getElementById('insight-quote-text');
  const authorText = document.getElementById('insight-author-text');
  
  if (!deck) return;

  const quotesData = [
    {
      quote: '«Ваш фокус определяет вашу реальность. Где внимание — там и сила.»',
      author: 'Руслан Молодцов',
      image: '/assets/webp/ai_back.webp'
    },
    {
      quote: '«Тревога — это просто заблокированное возбуждение и энергия, которые ждут вашего разрешения проявиться.»',
      author: 'Руслан Молодцов',
      image: '/assets/webp/king_calm.webp'
    },
    {
      quote: '«Тело никогда не врет. Когда разум придумывает оправдания, тело всегда показывает чистую правду.»',
      author: 'Руслан Молодцов',
      image: '/assets/webp/coman.webp'
    },
    {
      quote: '«Истинная сила начинается там, где вы прекращаете бороться с собой и начинаете себя исследовать.»',
      author: 'Руслан Молодцов',
      image: '/assets/webp/hipno.webp'
    },
    {
      quote: '«Каждый симптом в теле — это не поломка, а зашифрованное послание от вашего подсознания.»',
      author: 'Руслан Молодцов',
      image: '/assets/webp/courses.webp'
    }
  ];

  let activeIndex = 0;
  let isAnimating = false;
  const cards = deck.querySelectorAll('.insight-card');

  function updateDeck() {
    cards.forEach((card, i) => {
      const relIndex = (i - activeIndex + cards.length) % cards.length;
      
      // Reset normal transitions
      card.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.3, 1), opacity 0.5s ease, z-index 0.6s';

      if (relIndex === 0) {
        // Active top card
        card.style.transform = 'translate3d(0, 0, 0) rotate(0deg) scale(1)';
        card.style.opacity = '1';
        card.style.zIndex = '10';
        card.style.pointerEvents = 'auto';
      } else if (relIndex === 1) {
        // Second card, slightly rotated right, scaled down
        card.style.transform = 'translate3d(6px, -4px, -20px) rotate(4.5deg) scale(0.95)';
        card.style.opacity = '0.85';
        card.style.zIndex = '5';
        card.style.pointerEvents = 'none';
      } else if (relIndex === 2) {
        // Third card, slightly rotated left, scaled down more
        card.style.transform = 'translate3d(-8px, -2px, -40px) rotate(-5.5deg) scale(0.9)';
        card.style.opacity = '0.6';
        card.style.zIndex = '2';
        card.style.pointerEvents = 'none';
      } else if (relIndex === 3) {
        // Fourth card, rotated right
        card.style.transform = 'translate3d(10px, 2px, -60px) rotate(3deg) scale(0.85)';
        card.style.opacity = '0.4';
        card.style.zIndex = '1';
        card.style.pointerEvents = 'none';
      } else {
        card.style.transform = 'translate3d(0, 0, -80px) rotate(0deg) scale(0.8)';
        card.style.opacity = '0';
        card.style.zIndex = '0';
        card.style.pointerEvents = 'none';
      }
    });

    // Update quote details on the side/below
    const data = quotesData[activeIndex];
    if (quoteText) quoteText.textContent = data.quote;
    if (authorText) authorText.textContent = data.author;
    if (counterText) {
      counterText.textContent = `${activeIndex + 1} / ${cards.length}`;
    }
  }

  function changeCard(nextIdx, direction = 'next') {
    if (isAnimating) return;
    isAnimating = true;

    const prevIdx = activeIndex;
    const prevCardEl = cards[prevIdx];

    const slideX = direction === 'next' ? '-140%' : '140%';
    const slideRotate = direction === 'next' ? '-15deg' : '15deg';

    // Smooth physical toss animation
    prevCardEl.style.transition = 'transform 0.45s cubic-bezier(0.25, 1, 0.3, 1), opacity 0.4s ease';
    prevCardEl.style.transform = `translate3d(${slideX}, -10px, 0) rotate(${slideRotate}) scale(0.95)`;
    prevCardEl.style.opacity = '0.1';
    prevCardEl.style.zIndex = '15'; // Keep on top during slide

    activeIndex = nextIdx;

    setTimeout(() => {
      // Re-render other cards positions in background
      updateDeck();

      // Smoothly place the tossed card to its new background position
      setTimeout(() => {
        isAnimating = false;
      }, 350);
    }, 200);
  }

  function nextCard() {
    const nextIdx = (activeIndex + 1) % cards.length;
    changeCard(nextIdx, 'next');
  }

  function prevCard() {
    const nextIdx = (activeIndex - 1 + cards.length) % cards.length;
    changeCard(nextIdx, 'prev');
  }

  // Tapping the card deck advances it
  deck.addEventListener('click', (e) => {
    e.stopPropagation();
    nextCard();
  });

  if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prevCard(); });
  if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); nextCard(); });

  // Swipe support for mobile card throwing
  let startX = 0;
  let startY = 0;
  
  deck.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  deck.addEventListener('touchend', (e) => {
    const diffX = e.changedTouches[0].clientX - startX;
    const diffY = e.changedTouches[0].clientY - startY;

    if (Math.abs(diffX) > 60 && Math.abs(diffY) < 100) {
      if (diffX > 0) {
        prevCard();
      } else {
        nextCard();
      }
    }
  }, { passive: true });

  updateDeck();
}

// Initialise deck on page load
document.addEventListener('DOMContentLoaded', () => {
  initFeedCarousel();
});
// Also initialize when rendering Today screen just in case of state changes
const originalRenderToday = window.renderToday;
window.renderToday = function(routeKey) {
  if (originalRenderToday) originalRenderToday(routeKey);
  initFeedCarousel();
};

/* ─── Premium 3D Coverflow Feed Carousel Logic ─── */
function initFeedCarousel() {
  const stage = document.getElementById('feed-carousel');
  if (!stage) return;

  const cards = stage.querySelectorAll('.carousel-3d-card');
  let activeIndex = 1; // start with center card (Index 1: Meditation Day) as focused

  function updateCarousel() {
    cards.forEach((card, i) => {
      // Find relative difference in a 3-element loop
      let diff = i - activeIndex;
      if (diff < -1) diff += 3;
      if (diff > 1) diff -= 3;

      if (diff === 0) {
        // Focused Center card
        card.style.transform = 'translate3d(0, 0, 0) rotateY(0deg) scale(1)';
        card.style.opacity = '1';
        card.style.zIndex = '10';
        card.classList.add('active-focus');
      } else if (diff === 1) {
        // Right card - rotated towards center, pushed back
        card.style.transform = 'translate3d(82%, 0, -140px) rotateY(-40deg) scale(0.85)';
        card.style.opacity = '0.75';
        card.style.zIndex = '5';
        card.classList.remove('active-focus');
      } else if (diff === -1) {
        // Left card - rotated towards center, pushed back
        card.style.transform = 'translate3d(-82%, 0, -140px) rotateY(40deg) scale(0.85)';
        card.style.opacity = '0.75';
        card.style.zIndex = '5';
        card.classList.remove('active-focus');
      }
    });
  }

  stage.addEventListener('click', (e) => {
    const card = e.target.closest('.carousel-3d-card');
    if (!card) return;

    const idx = parseInt(card.dataset.index, 10);
    const postId = card.dataset.postId;

    if (idx === activeIndex) {
      // Already focused, open the post directly in the feed!
      location.href = `/feed/#post-${postId}`;
    } else {
      // Zoom focus on this item
      activeIndex = idx;
      updateCarousel();
    }
  });

  // Swipe gestures support for carousel on mobile
  let startX = 0;
  stage.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  stage.addEventListener('touchend', (e) => {
    const diffX = e.changedTouches[0].clientX - startX;
    if (Math.abs(diffX) > 50) {
      if (diffX > 0) {
        // Swipe Right -> show previous card
        activeIndex = (activeIndex - 1 + 3) % 3;
      } else {
        // Swipe Left -> show next card
        activeIndex = (activeIndex + 1) % 3;
      }
      updateCarousel();
    }
  }, { passive: true });

  updateCarousel();
}

function initMarathonCarousel() {
  const root = document.querySelector('[data-marathon-carousel]');
  if (!root) return;
  const stage = root.querySelector('.home-marathon-orbit-stage');
  const cards = Array.from(root.querySelectorAll('.home-marathon-card'));
  if (!stage || !cards.length) return;

  cards.forEach((card) => {
    card.classList.add('is-active');
    const bg = card.style.getPropertyValue('--card-bg') || '';
    const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
    if (!match) return;
    const img = new Image();
    img.src = match[1];
  });
  root.classList.add('is-ready');

  // Drag-to-scroll мышью; на тач-устройствах работает нативный скролл
  let pointerId = null;
  let startX = 0;
  let startScroll = 0;
  let dragged = false;

  stage.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScroll = stage.scrollLeft;
    dragged = false;
  });

  stage.addEventListener('pointermove', (event) => {
    if (pointerId === null || event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    if (!dragged && Math.abs(dx) < 6) return;
    if (!dragged) {
      dragged = true;
      stage.classList.add('is-dragging');
      try { stage.setPointerCapture(pointerId); } catch (e) {}
    }
    stage.scrollLeft = startScroll - dx;
  });

  function endDrag(event) {
    if (pointerId === null || (event && event.pointerId !== pointerId)) return;
    pointerId = null;
    stage.classList.remove('is-dragging');
  }

  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // Глушим клик по карточке, если это был drag, а не клик
  stage.addEventListener('click', (event) => {
    if (!dragged) return;
    event.preventDefault();
    event.stopPropagation();
    dragged = false;
  }, true);
}

document.addEventListener('DOMContentLoaded', initMarathonCarousel);
