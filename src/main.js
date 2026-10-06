import './style.css';

// Роли: anime.js — hero (буквы, подчёркивание) и прорисовка SVG-иконок;
// Motion — появление блоков при скролле, карточки, модалки.
import { animate as anime, createTimeline, splitText, stagger as aStagger, svg, utils } from 'animejs';
import { animate, inView, stagger } from 'motion';
import { applyLang, setLang, lang, onLangChange } from './i18n.js';
import { loadProjects } from './projects.js';

const root = document.documentElement;
const motionOn = root.classList.contains('motion');
const EASE = [0.22, 1, 0.36, 1];

applyLang();
loadProjects();

// ---------- Hero ----------
const nameChars = () => {
  const { chars } = splitText('.hero-name', { chars: { wrap: 'clip' } });
  utils.set('.hero-name', { opacity: 1 });
  return chars;
};
const nameIn = () => ({ y: ['110%', '0%'], duration: 1100, delay: aStagger(70), ease: 'outExpo' });

if (motionOn) {
  const underline = svg.createDrawable('.underline path');
  utils.set('.underline path', { opacity: 1 });
  createTimeline()
    .add(nameChars(), nameIn(), 0)
    .add('.hero-fade', { opacity: [0, 1], y: [18, 0], duration: 800, delay: aStagger(90), ease: 'outExpo' }, 300)
    .add(underline, { draw: ['0 0', '0 1'], duration: 900, ease: 'inOutQuart' }, 800);
}

// Время в бейдже статуса: Москва всегда, Европа (Берлин) видна только в EN-версии.
const clocks = [['clock', 'Europe/Moscow'], ['clock-eu', 'Europe/Berlin']].map(([id, timeZone]) =>
  [document.getElementById(id), new Intl.DateTimeFormat('ru-RU', { timeZone, hour: '2-digit', minute: '2-digit' })]);
const tick = () => clocks.forEach(([el, fmt]) => (el.textContent = fmt.format(new Date())));
tick();
setInterval(tick, 15_000);

// ---------- Скролл ----------
if (motionOn) {
  inView('.reveal', (el) => {
    animate(el, { opacity: [0, 1], y: [28, 0] }, { duration: 0.7, ease: EASE });
  }, { margin: '0px 0px -8% 0px' });

  inView('.steps', (list) => {
    animate([...list.children], { opacity: [0, 1], y: [28, 0] }, { duration: 0.7, ease: EASE, delay: stagger(0.1) });
  }, { amount: 0.2 });

  inView('.draw', (icon) => {
    const parts = [...icon.children];
    utils.set(parts, { opacity: 1 });
    anime(svg.createDrawable(parts), { draw: ['0 0', '0 1'], duration: 1200, delay: aStagger(140, { start: 250 }), ease: 'inOutQuart' });
  }, { amount: 0.8 });
}

// ---------- Тема и язык ----------
document.getElementById('theme-toggle').addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  document.querySelector('meta[name="theme-color"]').content = next === 'dark' ? '#0c0b12' : '#f3f1ec';
  try { localStorage.setItem('theme', next); } catch {}
});

document.getElementById('lang-toggle').addEventListener('click', () => setLang(lang() === 'en' ? 'ru' : 'en'));
onLangChange(() => motionOn && anime(nameChars(), nameIn()));

// ---------- Админка: грузим только тем, кому она нужна ----------
const loadAdmin = () => import('./admin.js');
const hasSession = () => {
  try { return Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k)); } catch { return false; }
};
if (hasSession() || new URLSearchParams(location.search).has('code') || location.hash === '#admin') {
  loadAdmin().then((m) => m.init());
}
document.getElementById('admin-btn').addEventListener('click', () => loadAdmin().then((m) => m.footerAction()));

window.__ready = true;
