(() => {
  const PROFILE_KEY = 'sistema:onboarding-profile';

  const routes = {
    stabilization: {
      title: 'Стабилизация и опора',
      desc: 'Сегодня: снизить напряжение, не уходя в длинную теорию.',
      step: 'Снизить стресс',
      stepDesc: 'Откройте короткий материал по стрессу. Затем зафиксируйте один вывод через AI.',
      href: '/marathons/#section-stress',
      image: '/assets/webp/stress-mar.webp',
      hero: '/assets/webp/ai_back.webp',
    },
    body: {
      title: 'Тело и симптомы',
      desc: 'Сегодня: понять связь состояния и тела без самодиагностики.',
      step: 'Психосоматика',
      stepDesc: 'Посмотрите первый материал по психосоматике и отметьте, где это проявляется в теле.',
      href: '/psihosomatika/',
      image: '/assets/webp/psysomatic.webp',
      hero: '/assets/webp/psysomatic.webp',
    },
    relationships: {
      title: 'Отношения и границы',
      desc: 'Сегодня: увидеть один повторяющийся сценарий в контакте.',
      step: 'Границы и близость',
      stepDesc: 'Откройте материал про границы и сформулируйте один пример из своей жизни.',
      href: '/sozavisimost/',
      image: '/assets/webp/coda2.webp',
      hero: '/assets/webp/man_woman.webp',
    },
    selfworth: {
      title: 'Самооценка и внутренняя опора',
      desc: 'Сегодня: вернуть одну точку опоры вместо самокритики.',
      step: 'Самооценка',
      stepDesc: 'Откройте блок по самооценке и выпишите одну мысль, которую стоит проверить.',
      href: '/marathons/#section-samoocenka',
      image: '/assets/webp/myself_mar.webp',
      hero: '/assets/webp/myself_mar.webp',
    },
    selfstudy: {
      title: 'Понять себя глубже',
      desc: 'Сегодня: назвать эмоцию, потребность и то, что мешает контакту.',
      step: 'Гештальт-подход',
      stepDesc: 'Откройте вводный материал по гештальту. Таймкоды и AI-разбор помогут взять главное.',
      href: '/geshtalt/',
      image: '/assets/webp/courses.webp',
      hero: '/assets/webp/new_geshtalt.webp',
    },
    professional: {
      title: 'Профессиональная траектория',
      desc: 'Сегодня: взять один профессиональный разбор и применить его к практике.',
      step: 'Супервизия',
      stepDesc: 'Откройте супервизионный материал и сформулируйте вопрос для разбора.',
      href: '/superviziya/',
      image: '/assets/webp/supervision.webp',
      hero: '/assets/webp/supervision.webp',
    },
  };

  function routeFromProfile() {
    try {
      const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      return routes[profile.routeKey] || routes.selfstudy;
    } catch (e) {
      return routes.selfstudy;
    }
  }

  function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function setHref(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute('href', value);
  }

  function setBg(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.style.setProperty('--ux-bg', `url('${value}')`);
  }

  const route = routeFromProfile();
  setText('[data-path-title]', route.title);
  setText('[data-path-desc]', route.desc);
  setText('[data-path-step-title]', route.step);
  setText('[data-path-step-desc]', route.stepDesc);
  setText('[data-path-task-video]', route.step);
  setHref('[data-path-primary]', route.href);
  setHref('[data-path-step-link]', route.href);
  setBg('[data-path-hero]', route.hero);
  setBg('[data-path-now]', route.image);
})();
