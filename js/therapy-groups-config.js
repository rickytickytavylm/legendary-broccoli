window.SISTEMA_YOGA_TELEGRAM_CLUB_URL = 'https://t.me/+P3saVqIBL8gzZTIy';

window.SISTEMA_THERAPY_ROUTE_KEYS = ['calm', 'body', 'relationships', 'selfworth', 'selfstudy', 'communication'];

window.SISTEMA_THERAPY_GROUPS = {
  calm: {
    routeKey: 'calm',
    kind: 'telegram-club',
    title: 'Йога / Забота о себе',
    directionLabel: 'Йога / Забота о себе',
    cardTitle: 'Йога клуб',
    leader: 'Руслан Молодцов',
    image: '/assets/webp/king_calm.webp',
    externalUrl: window.SISTEMA_YOGA_TELEGRAM_CLUB_URL,
    cardDesc: 'Закрытый канал Руслана Молодцова: йога-конференции в Zoom и живое сообщество.',
    cta: 'Открыть клуб',
  },
  body: {
    routeKey: 'body',
    kind: 'therapy-chat',
    title: 'Тело и симптомы',
    directionLabel: 'Тело / симптомы',
    leader: 'Анастасия Резакина',
    image: '/assets/webp/body.webp',
    cardDesc: 'Чат со специалистом и участниками направления по теме тела и симптомов.',
  },
  relationships: {
    routeKey: 'relationships',
    kind: 'therapy-chat',
    title: 'Отношения / созависимость',
    directionLabel: 'Отношения / созависимость',
    leader: 'Владимир Земелькин',
    image: '/assets/webp/coda2.webp',
    cardDesc: 'Чат со специалистом и участниками направления по теме отношений и созависимости.',
  },
  selfworth: {
    routeKey: 'selfworth',
    kind: 'therapy-chat',
    title: 'Самооценка и опора',
    directionLabel: 'Опора',
    leader: 'Владимир Земелькин',
    image: '/assets/webp/opora.webp',
    cardDesc: 'Чат со специалистом и участниками направления по теме самооценки и внутренней опоры.',
  },
  selfstudy: {
    routeKey: 'selfstudy',
    kind: 'therapy-chat',
    title: 'Понять себя глубже',
    directionLabel: 'Самопонимание',
    leader: 'Дмитрий Любкин',
    image: '/assets/webp/find_myself.webp',
    cardDesc: 'Чат со специалистом и участниками направления по теме самопонимания.',
  },
  communication: {
    routeKey: 'communication',
    kind: 'therapy-chat',
    title: 'Коммуникация и конфликты',
    directionLabel: 'Коммуникация',
    leader: 'Станислав Борисов',
    image: '/assets/webp/masterofcommication.webp',
    cardDesc: 'Чат со специалистом и участниками направления по теме коммуникации и конфликтов.',
  },
};

window.getUserDirectionRouteKey = function getUserDirectionRouteKey() {
  try {
    const profile = JSON.parse(localStorage.getItem('sistema:onboarding-profile') || '{}');
    if (window.SISTEMA_THERAPY_ROUTE_KEYS.includes(profile.focus)) return profile.focus;
    if (window.SISTEMA_THERAPY_ROUTE_KEYS.includes(profile.routeKey)) return profile.routeKey;
  } catch (e) {
    /* ignore */
  }
  return 'relationships';
};

window.getTherapyGroupDestination = function getTherapyGroupDestination(routeKey) {
  const key = routeKey || window.getUserDirectionRouteKey();
  const cfg = window.SISTEMA_THERAPY_GROUPS[key];
  if (cfg && cfg.kind === 'telegram-club' && cfg.externalUrl) {
    return { routeKey: key, href: cfg.externalUrl, external: true, cfg };
  }
  const resolved = key && window.SISTEMA_THERAPY_GROUPS[key] ? key : 'relationships';
  return {
    routeKey: resolved,
    href: `/therapy-group/?route=${encodeURIComponent(resolved)}`,
    external: false,
    cfg: window.SISTEMA_THERAPY_GROUPS[resolved],
  };
};

window.getTherapyGroupCardState = function getTherapyGroupCardState(routeKey) {
  const key = routeKey || window.getUserDirectionRouteKey();
  const cfg = window.SISTEMA_THERAPY_GROUPS[key];
  if (!cfg) return null;
  if (cfg.kind === 'telegram-club') {
    return {
      routeKey: key,
      href: cfg.externalUrl,
      external: true,
      panelTitle: 'Йога клуб',
      panelSubtitle: 'Закрытый канал и Zoom-конференции по йоге.',
      cardTitle: cfg.cardTitle || cfg.title,
      leader: `Ведущий: ${cfg.leader}`,
      desc: cfg.cardDesc,
      cta: cfg.cta || 'Открыть клуб',
      showPro: false,
    };
  }
  return {
    routeKey: key,
    href: `/therapy-group/?route=${encodeURIComponent(key)}`,
    external: false,
    panelTitle: 'Терапевтическая группа',
    panelSubtitle: 'Групповой чат по вашему направлению с ведущим программы.',
    cardTitle: 'Терапевтическая группа',
    leader: `Ведущий: ${cfg.leader}`,
    desc: cfg.cardDesc || 'Чат со специалистом и участниками вашего направления по конкретной теме.',
    cta: 'Открыть чат',
    showPro: true,
  };
};
