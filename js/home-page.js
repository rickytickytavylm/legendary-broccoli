const ONBOARDING_COMPLETE_KEY = 'sistema:onboarding-complete';
const ONBOARDING_PROFILE_KEY = 'sistema:onboarding-profile';
const ONBOARDING_SCHEMA_KEY = 'sistema:onboarding-schema';
const ONBOARDING_SCHEMA_VERSION = 'device-v1';
const SPLASH_SEEN_KEY = 'sistema:intro-splash-seen';
const TODAY_OPENED_PROGRAMS_KEY = 'sistema:today-opened-programs';
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

const onboardingSteps = [
  {
    key: 'name',
    label: 'Шаг 1 из 3',
    title: 'Как вас зовут?',
    desc: 'Имя нужно только для личного обращения в профиле и рекомендациях.',
    input: {
      placeholder: 'Ваше имя',
    },
  },
  {
    key: 'focus',
    label: 'Шаг 2 из 3',
    title: 'Что сейчас важнее?',
    desc: 'Выберите направление. Система покажет две подходящие программы для старта.',
    options: [
      { value: 'calm', label: 'Спокойствие' },
      { value: 'body', label: 'Тело / симптомы' },
      { value: 'relationships', label: 'Отношения' },
      { value: 'selfworth', label: 'Опора' },
      { value: 'selfstudy', label: 'Понять себя глубже' },
      { value: 'communication', label: 'Коммуникация / конфликты' },
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
    heroImage: '/assets/webp/calm_sss.webp',
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
    programs: [
      { title: 'Психосоматика', desc: 'Связь эмоций, стресса и телесных симптомов.', href: '/psihosomatika/', image: '/assets/webp/psysomatic.webp' },
      { title: 'Телесная терапия', desc: 'Практики, которые возвращают внимание в тело.', href: '/terapiya/', image: '/assets/webp/theraphy.webp' },
    ],
  },
  relationships: {
    title: 'Отношения',
    desc: 'Два входа: зависимые сценарии и мужско-женская динамика.',
    short: 'отношения',
    heroImage: '/assets/webp/relative_second.webp',
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
    programs: [
      { title: 'Работа с травмами', desc: 'Кризисы, травматичный опыт и восстановление опоры.', href: '/dermer/', image: '/assets/webp/geshtalt.webp' },
      { title: 'Гештальт-подход', desc: 'Контакт, эмоции, границы и возвращение к себе.', href: '/geshtalt/', image: '/assets/webp/courses.webp' },
    ],
  },
  selfstudy: {
    title: 'Понять себя глубже',
    desc: 'Два входа: базовая программа для самопонимания и библиотека материалов.',
    short: 'самопонимание',
    heroImage: '/assets/webp/find_myself.webp',
    programs: [
      { title: 'Гештальт-подход', desc: 'Эмоции, потребности, контакт и границы.', href: '/geshtalt/', image: '/assets/webp/courses.webp' },
      { title: 'Антология', desc: 'Сборник материалов и практик для более широкого входа.', href: '/antologiya/', image: '/assets/webp/antology.webp' },
    ],
  },
  communication: {
    title: 'Коммуникация и конфликты',
    desc: 'Два входа: навыки общения и сценарии в отношениях.',
    short: 'коммуникация и конфликты',
    heroImage: '/assets/webp/conflicts_programs.webp',
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
  const tracker = document.querySelector(`[data-today-${prefix}-tracker]`);
  const ring = document.querySelector(`[data-today-${prefix}-ring]`);
  const ringText = document.querySelector(`[data-today-${prefix}-ring-text]`);
  const href = program?.href || '';
  if (link && program?.href) link.setAttribute('href', program.href);
  if (action) action.textContent = programOpened(href) ? 'Продолжить' : 'Начать';
  if (tracker) tracker.textContent = 'Считаем материалы';
  if (ring) ring.style.setProperty('--pct', 0);
  if (ringText) ringText.textContent = '0/0';
  fetchProgramLessonCount(href).then((count) => {
    if (!tracker || link?.getAttribute('href') !== href) return;
    const done = programOpened(href) ? 1 : 0;
    if (!count) {
      tracker.textContent = programOpened(href) ? 'Программа открыта' : 'Материалы внутри';
      if (ringText) ringText.textContent = programOpened(href) ? '1' : '0';
      return;
    }
    tracker.textContent = `${done} из ${count} дней`;
    if (ring) {
      ring.classList.remove('is-animated');
      ring.style.setProperty('--pct', 0);
      requestAnimationFrame(() => {
        ring.classList.add('is-animated');
        ring.style.setProperty('--pct', Math.round((done / count) * 100));
      });
    }
    if (ringText) ringText.textContent = `${done}/${count}`;
  });
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
  if (hero) hero.style.setProperty('--ux-bg', `url('${route.hero}')`);
  if (main) main.style.setProperty('--ux-bg', `url('${route.image}')`);
  if (secondaryCard && route.secondary) secondaryCard.style.setProperty('--ux-bg', `url('${route.secondary.image}')`);
  if (secondaryTitle && route.secondary) secondaryTitle.textContent = route.secondary.title;
  if (secondaryDesc && route.secondary) secondaryDesc.textContent = route.secondary.desc;
  setTodayProgramState('primary', route.primary);
  setTodayProgramState('secondary', route.secondary);
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
  onboardingState.name = cleanName(onboardingState.name) || 'Гость';
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
    window.API.updateProfile({ display_name: onboardingState.name }).catch(() => {});
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
  let input = document.querySelector('[data-onboarding-name-input]');
  if (hint) {
    hint.textContent = step.input
      ? 'Введите имя'
      : step.result
      ? 'Рекомендацию можно изменить позже'
      : 'Выберите один вариант';
  }
  if (!options) return;
  options.classList.toggle('hidden', Boolean(step.result || step.input));
  if (result) result.classList.toggle('hidden', !step.result);
  if (!input) {
    input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'given-name';
    input.className = 'onboarding-name-input hidden';
    input.setAttribute('data-onboarding-name-input', '');
    input.addEventListener('input', () => {
      onboardingState.name = cleanName(input.value);
    });
    options.parentElement?.insertBefore(input, options);
  }
  input.classList.toggle('hidden', !step.input);
  if (step.input) {
    input.placeholder = step.input.placeholder;
    input.value = onboardingState.name || '';
    window.setTimeout(() => input.focus(), 80);
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
  if (step.input) return cleanName(onboardingState[step.key]).length >= 2;
  const value = onboardingState[step.key];
  return step.multiple ? asArray(value).length > 0 : Boolean(value);
}

function initOnboarding() {
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
    return;
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
  const boot = () => {
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
  };

  if (window.API?.getProfileSession) {
    window.API.getProfileSession()
      .then((data) => {
        if (data && data.exists === false && localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true') {
          resetLocalOnboardingForFreshDevice();
        }
      })
      .catch(() => {
        if (!window.API?.isLoggedIn?.() && localStorage.getItem(ONBOARDING_SCHEMA_KEY) !== ONBOARDING_SCHEMA_VERSION) {
          resetLocalOnboardingForFreshDevice();
        }
      })
      .finally(boot);
    return;
  }
  boot();
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
