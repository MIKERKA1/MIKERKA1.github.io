// RU лежит прямо в разметке и запоминается при старте; здесь только EN и строки для JS.
const en = {
  skip: 'Skip to content',
  navLabel: 'Sections', navServices: 'Services', navProjects: 'Work', navProcess: 'Process', navContact: 'Contact',
  home: 'Denis — home', langShort: 'RU', langLabel: 'RU — переключить на русский', themeLabel: 'Toggle theme',
  status: 'Taking new projects', city: 'Moscow',
  name: 'Denis', age: '19 y.o.',
  role1: 'I build websites', role2: 'and', role3: 'Telegram bots',
  lede: 'Websites that load fast and bring in leads, and bots that take orders and book clients on their own. Tell me about your task — I’ll suggest a solution and give you a timeline.',
  ctaTg: 'Message me on Telegram', ctaWork: 'See my work',
  aboutLabel: 'About', aboutTitle: 'I write the code myself and own the result',
  about1: 'I’m 19 and I build websites and Telegram bots. You work with me directly, no managers in between: you message me, and I’m the one writing the code. So questions get sorted quickly, without a chain of forwards.',
  about2: 'I care that a site opens fast even on a cheap phone and that a bot understands people from the first message. If there’s a simpler and cheaper way to solve your task, I’ll tell you before we start.',
  fact1a: 'Directly', fact1b: 'you talk to the person doing the work',
  fact2a: 'Price and timeline', fact2b: 'agreed before we start',
  fact3a: 'Code and access', fact3b: 'stay with you',
  servicesLabel: 'Services', servicesTitle: 'What I do',
  svcSitesTitle: 'Websites', svcSitesText: 'Landing pages, multi-page sites and web apps.',
  svcSites1: 'Landing page for ads or a product launch', svcSites2: 'Company website with several pages',
  svcSites3: 'Catalog, user account, content admin panel', svcSites4: 'Forms, payments, analytics, leads sent to Telegram',
  svcSites5: 'Mobile-first layout and basic SEO', svcSitesCta: 'Discuss a website →',
  svcBotsTitle: 'Telegram bots', svcBotsText: 'Bots that take over the routine: orders, bookings, notifications.',
  svcBots1: 'Shop with catalog, cart and payments', svcBots2: 'Client booking and visit reminders',
  svcBots3: 'Notifications about orders and website leads', svcBots4: 'Integrations: Google Sheets, CRM, any API',
  svcBots5: 'Mini App and admin panel right inside Telegram', svcBotsCta: 'Discuss a bot →',
  projectsLabel: 'Work', projectsTitle: 'What’s already built',
  filterLabel: 'Filter by type', filterAll: 'All', filterSites: 'Websites', filterBots: 'Bots', addProject: '+ Add project',
  stackLabel: 'Stack', stackTitle: 'What I use', stackFront: 'Frontend', stackBack: 'Backend and data', stackBots: 'Bots', stackTools: 'Motion and tools',
  processLabel: 'Process', processTitle: 'How I work',
  step1t: 'Request', step1: 'Message me on Telegram with what you need. I’ll ask a couple of questions to understand the task, not to upsell.',
  step2t: 'Estimate', step2: 'I give you a price and a timeline, and we write down what’s included. No surprises at the end.',
  step3t: 'Build', step3: 'I show work-in-progress versions, you see the real thing and request changes along the way.',
  step4t: 'Launch', step4: 'I deploy, connect the domain and hand over access. If something comes up after launch, I’ll fix it.',
  contactLabel: 'Contact', contactTitle: 'Got a task? Message me.',
  contactSub: 'Telegram is the fastest way to reach me. Describe the task, drop a link to an example, or just say “I need a website”.',
  mail: 'Email', footerNote: 'Built with Vite, anime.js and Motion',
  login: 'Log in', logout: 'Log out', edit: 'Edit', delete: 'Delete',
};

// Строки, которые нужны только из JS (карточки, админка).
const js = {
  ru: {
    site: 'Сайт', bot: 'Бот', open: 'Открыть ↗', openBot: 'Бот в TG ↗', github: 'GitHub ↗',
    loadError: 'Не получилось загрузить проекты. Обновите страницу чуть позже.', empty: 'Здесь пока пусто.',
    imgAlt: 'Превью проекта', login: 'Войти', logout: 'Выйти',
  },
  en: {
    site: 'Website', bot: 'Bot', open: 'Open ↗', openBot: 'Open bot ↗', github: 'GitHub ↗',
    loadError: 'Couldn’t load projects. Please refresh a bit later.', empty: 'Nothing here yet.',
    imgAlt: 'Project preview', login: 'Log in', logout: 'Log out',
  },
};

const ruText = new WeakMap();
const ruAttr = new WeakMap();
const listeners = [];

export const lang = () => document.documentElement.lang === 'en' ? 'en' : 'ru';
export const t = (key) => js[lang()][key] ?? key;
export const onLangChange = (fn) => listeners.push(fn);

export function applyLang(root = document) {
  const isEn = lang() === 'en';
  for (const el of root.querySelectorAll('[data-i18n]')) {
    if (!ruText.has(el)) ruText.set(el, el.textContent);
    el.textContent = isEn ? en[el.dataset.i18n] ?? ruText.get(el) : ruText.get(el);
  }
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    const [attr, key] = el.dataset.i18nAttr.split(':');
    if (!ruAttr.has(el)) ruAttr.set(el, el.getAttribute(attr));
    el.setAttribute(attr, isEn ? en[key] : ruAttr.get(el));
  }
  if (root === document) {
    document.title = isEn ? 'Denis · websites and Telegram bots developer' : 'Денис · разработчик сайтов и Telegram-ботов';
  }
}

export function setLang(next) {
  document.documentElement.lang = next;
  try { localStorage.setItem('lang', next); } catch {}
  applyLang();
  listeners.forEach((fn) => fn(next));
}
