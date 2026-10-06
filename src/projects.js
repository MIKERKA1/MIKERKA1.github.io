// Сетка проектов: загрузка из Supabase REST (без supabase-js, чтобы не грузить его посетителям),
// фильтр и FLIP-анимации через Motion.
import { animate, hover, press, inView, stagger } from 'motion';
import { t, lang, applyLang, onLangChange } from './i18n.js';

const API = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/projects?select=*&order=sort_order.asc,created_at.desc`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EASE = [0.22, 1, 0.36, 1];
const motionOn = () => document.documentElement.classList.contains('motion');

const grid = document.getElementById('project-grid');
const note = document.getElementById('grid-note');
const tpl = document.getElementById('card-tpl');
const cards = new Map();

let projects = [];
let filter = 'all';
let noteKey = '';

// Админка подставляет сюда обработчики «Изменить» и «Удалить».
export const actions = { edit: null, delete: null };

const byOrder = (a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at);
const shown = (p) => filter === 'all' || p.type === filter;

// Сначала показываем снимок из HTML (его вшивает сборка), затем подтягиваем свежий список.
export async function loadProjects() {
  const snapshot = document.getElementById('projects-data')?.textContent;
  if (snapshot) {
    projects = JSON.parse(snapshot);
    firstRender();
  }
  let fresh;
  try {
    const res = await fetch(API, { headers: { apikey: KEY }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fresh = await res.json();
  } catch (err) {
    console.error('projects:', err);
    if (!snapshot) showNote('loadError');
    return;
  }
  if (!snapshot) {
    projects = fresh;
    firstRender();
  } else if (JSON.stringify(fresh) !== snapshot) {
    projects = fresh;
    commit();
  }
}

function firstRender() {
  layout();
  if (motionOn()) {
    const visible = [...grid.children].filter((el) => !el.hidden);
    visible.forEach((el) => (el.style.opacity = '0'));
    inView(grid, () => {
      animate(visible, { opacity: [0, 1], y: [32, 0] }, { duration: 0.7, ease: EASE, delay: stagger(0.08) });
    }, { amount: 0.1 });
  }
}

export function upsertProject(row) {
  const i = projects.findIndex((p) => p.id === row.id);
  if (i >= 0) projects[i] = row;
  else projects.push(row);
  if (!shown(row)) setFilter('all', false);
  return commit().then(() => cards.get(row.id)?.scrollIntoView({ block: 'nearest', behavior: motionOn() ? 'smooth' : 'auto' }));
}

export function removeProject(id) {
  projects = projects.filter((p) => p.id !== id);
  return commit();
}

function fill(el, p) {
  const en = lang() === 'en';
  const title = (en && p.title_en) || p.title;
  el.dataset.type = p.type;

  const media = el.querySelector('.card-media');
  const img = media.querySelector('img');
  img.hidden = !p.image_url;
  if (p.image_url) {
    if (img.getAttribute('src') !== p.image_url) img.src = p.image_url;
    img.alt = `${t('imgAlt')}: ${title}`;
  }
  media.dataset.letter = p.image_url ? '' : title.slice(0, 1).toUpperCase();

  el.querySelector('.card-type').textContent = t(p.type);
  el.querySelector('.card-title').textContent = title;
  el.querySelector('.card-desc').textContent = (en && p.description_en) || p.description;
  el.querySelector('.card-stack').replaceChildren(...p.stack.map((s) => Object.assign(document.createElement('li'), { textContent: s })));

  const links = [];
  if (p.url) links.push([p.url, t(p.type === 'bot' ? 'openBot' : 'open')]);
  if (p.github_url) links.push([p.github_url, t('github')]);
  el.querySelector('.card-links').replaceChildren(...links.map(([href, text]) =>
    Object.assign(document.createElement('a'), { href, textContent: text, target: '_blank', rel: 'noopener' })));
  applyLang(el);
}

function cardFor(p) {
  let el = cards.get(p.id);
  if (!el) {
    el = tpl.content.firstElementChild.cloneNode(true);
    el.dataset.id = p.id;
    cards.set(p.id, el);
    if (motionOn()) bindGestures(el);
  }
  fill(el, p);
  return el;
}

function bindGestures(el) {
  const img = el.querySelector('img');
  hover(el, () => {
    animate(el, { y: -6 }, { duration: 0.35, ease: EASE });
    animate(img, { scale: 1.04 }, { duration: 0.6, ease: EASE });
    return () => {
      animate(el, { y: 0 }, { duration: 0.35, ease: EASE });
      animate(img, { scale: 1 }, { duration: 0.6, ease: EASE });
    };
  });
  press(el, () => {
    animate(el, { scale: 0.985 }, { duration: 0.12 });
    return () => animate(el, { scale: 1 }, { type: 'spring', stiffness: 500, damping: 30 });
  });
}

// Расставляет карточки по порядку и фильтру без анимации.
function layout() {
  projects.sort(byOrder);
  const els = projects.map((p, i) => {
    const el = cardFor(p);
    el.querySelector('.card-num').textContent = `№ ${String(i + 1).padStart(2, '0')}`;
    el.hidden = !shown(p);
    return el;
  });
  grid.replaceChildren(...els);
  for (const id of cards.keys()) if (!projects.some((p) => p.id === id)) cards.delete(id);
  showNote(projects.some(shown) ? '' : 'empty');
}

// То же самое, но с анимацией: уходящие карточки гаснут, остальные едут на новые места (FLIP).
async function commit() {
  if (!motionOn()) return layout();
  const ids = new Set(projects.filter(shown).map((p) => p.id));
  const leaving = [...grid.children].filter((el) => !el.hidden && !ids.has(el.dataset.id));
  if (leaving.length) await Promise.all(leaving.map((el) => animate(el, { opacity: 0, scale: 0.94 }, { duration: 0.22 })));

  const before = new Map([...grid.children].filter((el) => !el.hidden).map((el) => [el, el.getBoundingClientRect()]));
  layout();
  for (const el of grid.children) {
    if (el.hidden) continue;
    const a = before.get(el);
    if (!a) {
      animate(el, { opacity: [0, 1], scale: [0.94, 1], x: 0, y: 0 }, { duration: 0.5, ease: EASE });
      continue;
    }
    const b = el.getBoundingClientRect();
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    if (dx || dy) animate(el, { x: [dx, 0], y: [dy, 0] }, { duration: 0.5, ease: EASE });
  }
}

function showNote(key) {
  noteKey = key;
  note.textContent = key ? t(key) : '';
  note.hidden = !key;
}

function setFilter(next, animated = true) {
  filter = next;
  for (const b of document.querySelectorAll('[data-filter]')) b.setAttribute('aria-pressed', String(b.dataset.filter === next));
  if (animated) commit();
}

document.querySelector('.filter').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]');
  if (b && b.dataset.filter !== filter) setFilter(b.dataset.filter);
});

grid.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const p = projects.find((x) => x.id === b.closest('.card').dataset.id);
  actions[b.dataset.act]?.(p);
});

onLangChange(() => {
  projects.forEach(cardFor);
  showNote(noteKey);
});
