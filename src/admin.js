// Админка: вход по magic link, добавление/правка/удаление проектов.
// Грузится отдельным чанком только при входе. Реальную защиту даёт RLS в Supabase,
// здесь проверка почты нужна лишь для того, чтобы не показывать кнопки чужим аккаунтам.
import { createClient } from '@supabase/supabase-js';
import { animate } from 'motion';
import { t, onLangChange } from './i18n.js';
import { actions, upsertProject, removeProject } from './projects.js';

const OWNER = 'jkak527@gmail.com';
const BUCKET = 'projects';
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;
const EASE = [0.22, 1, 0.36, 1];
const motionOn = () => document.documentElement.classList.contains('motion');

const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { flowType: 'pkce' },
});

const footerBtn = document.getElementById('admin-btn');
let session = null;
let editing = null;
let deleting = null;
let pickedFile = null;
let started = false;

// ---------- Разметка модалок ----------
document.body.insertAdjacentHTML('beforeend', `
<dialog id="dlg-login" aria-labelledby="login-h">
  <form class="dlg" novalidate>
    <div class="dlg-head"><h2 class="h3" id="login-h">Вход в админку</h2><button class="dlg-x" type="button" data-close aria-label="Закрыть">×</button></div>
    <label class="field"><span>Почта</span><input class="input" name="email" type="email" autocomplete="email" required /></label>
    <p class="form-error" role="status"></p>
    <div class="dlg-actions"><button class="btn btn-primary" type="submit">Прислать ссылку для входа</button></div>
  </form>
</dialog>

<dialog id="dlg-project" aria-labelledby="project-h">
  <form class="dlg" novalidate>
    <div class="dlg-head"><h2 class="h3" id="project-h">Новый проект</h2><button class="dlg-x" type="button" data-close aria-label="Закрыть">×</button></div>
    <div class="row">
      <label class="field"><span>Название *</span><input class="input" name="title" required maxlength="120" /></label>
      <label class="field"><span>Название (EN)</span><input class="input" name="title_en" maxlength="120" /></label>
    </div>
    <fieldset class="field" style="border:0;padding:0;margin:0">
      <legend style="font-size:14px;font-weight:500;margin-bottom:6px">Тип *</legend>
      <div class="seg">
        <label><input type="radio" name="type" value="site" required checked /><span>Сайт</span></label>
        <label><input type="radio" name="type" value="bot" /><span>Telegram-бот</span></label>
      </div>
    </fieldset>
    <label class="field"><span>Описание *</span><textarea class="input" name="description" required maxlength="1000"></textarea></label>
    <label class="field"><span>Описание (EN)</span><textarea class="input" name="description_en" maxlength="1000"></textarea></label>
    <label class="field"><span>Стек</span><input class="input" name="stack" placeholder="Vite, Supabase, aiogram" /><small>Через запятую</small></label>
    <div class="row">
      <label class="field"><span>Ссылка на сайт или бота</span><input class="input" name="url" type="url" pattern="https?://.+" placeholder="https://t.me/имя_бота" /></label>
      <label class="field"><span>GitHub</span><input class="input" name="github_url" type="url" pattern="https?://.+" placeholder="https://github.com/…" /></label>
    </div>
    <div class="row">
      <label class="field"><span>Картинка</span><input class="input" name="image" type="file" accept="image/png,image/jpeg,image/webp,image/avif" /><small>PNG, JPG, WebP до 10 МБ, сожму сам</small></label>
      <label class="field"><span>Порядок</span><input class="input" name="sort_order" type="number" step="1" value="0" /><small>Чем меньше число, тем выше в сетке</small></label>
    </div>
    <div class="preview" aria-live="polite">Превью появится здесь</div>
    <p class="form-error" role="alert"></p>
    <div class="dlg-actions">
      <button class="btn btn-ghost" type="button" data-close>Отмена</button>
      <button class="btn btn-primary" type="submit">Сохранить</button>
    </div>
  </form>
</dialog>

<dialog id="dlg-delete" aria-labelledby="delete-h">
  <form class="dlg">
    <div class="dlg-head"><h2 class="h3" id="delete-h">Удалить проект?</h2><button class="dlg-x" type="button" data-close aria-label="Закрыть">×</button></div>
    <p class="muted delete-text"></p>
    <p class="form-error" role="alert"></p>
    <div class="dlg-actions">
      <button class="btn btn-ghost" type="button" data-close>Отмена</button>
      <button class="btn btn-danger" type="submit">Удалить</button>
    </div>
  </form>
</dialog>`);

const dlgLogin = document.getElementById('dlg-login');
const dlgProject = document.getElementById('dlg-project');
const dlgDelete = document.getElementById('dlg-delete');
const form = dlgProject.querySelector('form');
const preview = form.querySelector('.preview');

// ---------- Открытие/закрытие модалок (Motion) ----------
function openDialog(d) {
  const out = d.querySelector('.form-error');
  out.textContent = '';
  out.style.color = '';
  d.showModal();
  if (motionOn()) animate(d, { opacity: [0, 1], y: [24, 0], scale: [0.98, 1] }, { duration: 0.35, ease: EASE });
}

async function closeDialog(d) {
  if (!d.open) return;
  if (motionOn()) await animate(d, { opacity: 0, y: 16 }, { duration: 0.2, ease: 'easeIn' });
  d.close();
}

for (const d of [dlgLogin, dlgProject, dlgDelete]) {
  d.addEventListener('cancel', (e) => { e.preventDefault(); closeDialog(d); });
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-close]')) closeDialog(d);
  });
}

const busy = (f, on) => f.querySelectorAll('button, input, textarea').forEach((el) => (el.disabled = on));
const markInvalid = (el, bad) => (bad ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid'));
const humanError = (err) => {
  const m = err?.message || String(err);
  if (/rate limit|security purposes/i.test(m)) return 'Слишком много писем подряд. Подождите минуту и попробуйте снова.';
  if (/row-level security|violates|no\) rows|0 rows/i.test(m)) return 'Нет прав. Войдите с почтой владельца.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Нет связи с сервером. Проверьте интернет.';
  return m;
};

// ---------- Вход ----------
dlgLogin.querySelector('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const email = f.email.value.trim();
  const out = f.querySelector('.form-error');
  out.style.color = '';
  markInvalid(f.email, !f.email.checkValidity());
  if (!f.email.checkValidity()) {
    out.textContent = 'Введите почту целиком, например name@gmail.com';
    return;
  }
  busy(f, true);
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  busy(f, false);
  if (!error) out.style.color = 'var(--lime)';
  out.textContent = error ? humanError(error) : `Ссылка отправлена на ${email}. Откройте её в этом же браузере.`;
});

function applySession(s) {
  session = s;
  const isOwner = s?.user?.email?.toLowerCase() === OWNER;
  document.documentElement.classList.toggle('is-admin', isOwner);
  footerBtn.textContent = s ? t('logout') : t('login');
  if (s && !isOwner) {
    sb.auth.signOut();
    openDialog(dlgLogin);
    dlgLogin.querySelector('.form-error').textContent = 'Этот аккаунт не может редактировать проекты.';
  }
}

export function init() {
  if (started) return;
  started = true;
  sb.auth.onAuthStateChange((_event, s) => {
    applySession(s);
    // Убираем ?code= из адреса после входа по ссылке.
    if (s && new URLSearchParams(location.search).has('code')) history.replaceState(null, '', location.pathname + location.hash);
  });
}

export async function footerAction() {
  init();
  if (session) await sb.auth.signOut();
  else openDialog(dlgLogin);
}

onLangChange(() => (footerBtn.textContent = session ? t('logout') : t('login')));

// ---------- Форма проекта ----------
function setPreview(src) {
  preview.replaceChildren(src ? Object.assign(document.createElement('img'), { src, alt: 'Превью картинки проекта' }) : 'Превью появится здесь');
}

function openForm(p = null) {
  editing = p;
  pickedFile = null;
  form.reset();
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  dlgProject.querySelector('#project-h').textContent = p ? 'Изменить проект' : 'Новый проект';
  if (p) {
    for (const k of ['title', 'title_en', 'description', 'description_en', 'url', 'github_url', 'sort_order']) form[k].value = p[k] ?? '';
    form.stack.value = p.stack.join(', ');
    form.type.value = p.type;
  }
  setPreview(p?.image_url);
  openDialog(dlgProject);
}

form.image.addEventListener('change', () => {
  const file = form.image.files[0];
  const out = form.querySelector('.form-error');
  out.textContent = '';
  if (!file) return;
  const bad = !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024;
  markInvalid(form.image, bad);
  if (bad) {
    form.image.value = '';
    out.textContent = 'Нужна картинка PNG, JPG или WebP размером до 10 МБ.';
    return;
  }
  pickedFile = file;
  setPreview(URL.createObjectURL(file));
});

// Сжимаем до 1600px по ширине и WebP, чтобы карточки грузились быстро.
async function compress(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1600 / bmp.width);
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Не удалось обработать картинку'))), 'image/webp', 0.85));
}

async function uploadImage(file) {
  const blob = await compress(file);
  const path = `${crypto.randomUUID()}.${blob.type === 'image/webp' ? 'webp' : 'png'}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
  if (error) throw error;
  return { path, url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

async function removeImage(url) {
  const i = url ? url.indexOf(PUBLIC_PREFIX) : -1;
  if (i < 0) return; // демо-картинки лежат в /public сайта, их не трогаем
  await sb.storage.from(BUCKET).remove([url.slice(i + PUBLIC_PREFIX.length)]);
}

function validate() {
  let first = null;
  for (const el of form.querySelectorAll('input:not([type=radio]):not([type=file]), textarea')) {
    if (el.name !== 'sort_order') el.value = el.value.trim();
    const ok = el.checkValidity();
    markInvalid(el, !ok);
    if (!ok && !first) first = el;
  }
  if (!first) return true;
  const label = first.closest('.field').querySelector('span').textContent.replace(' *', '');
  form.querySelector('.form-error').textContent = first.validity.valueMissing
    ? `Заполните поле «${label}».`
    : `Проверьте поле «${label}»: ${first.type === 'url' ? 'ссылка должна начинаться с https://' : first.validationMessage}`;
  first.focus();
  return false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validate()) return;
  const out = form.querySelector('.form-error');
  const row = {
    title: form.title.value,
    title_en: form.title_en.value || null,
    type: form.type.value,
    description: form.description.value,
    description_en: form.description_en.value || null,
    stack: form.stack.value.split(',').map((s) => s.trim()).filter(Boolean),
    url: form.url.value || null,
    github_url: form.github_url.value || null,
    sort_order: Number(form.sort_order.value) || 0,
    image_url: editing?.image_url ?? null,
  };

  busy(form, true);
  let uploaded = null;
  try {
    if (pickedFile) {
      uploaded = await uploadImage(pickedFile);
      row.image_url = uploaded.url;
    }
    const query = editing ? sb.from('projects').update(row).eq('id', editing.id) : sb.from('projects').insert(row);
    const { data, error } = await query.select().single();
    if (error) throw error;
    if (uploaded && editing?.image_url) removeImage(editing.image_url);
    await closeDialog(dlgProject);
    upsertProject(data);
  } catch (err) {
    if (uploaded) sb.storage.from(BUCKET).remove([uploaded.path]);
    out.textContent = humanError(err);
  } finally {
    busy(form, false);
  }
});

// ---------- Удаление ----------
dlgDelete.querySelector('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  busy(f, true);
  const { data, error } = await sb.from('projects').delete().eq('id', deleting.id).select('id');
  busy(f, false);
  if (error || !data.length) {
    f.querySelector('.form-error').textContent = humanError(error || '0 rows');
    return;
  }
  removeImage(deleting.image_url);
  await closeDialog(dlgDelete);
  removeProject(deleting.id);
});

actions.edit = (p) => openForm(p);
actions.delete = (p) => {
  deleting = p;
  dlgDelete.querySelector('.delete-text').textContent = `«${p.title}» пропадёт с сайта вместе с картинкой. Отменить это нельзя.`;
  openDialog(dlgDelete);
};
document.getElementById('add-project').addEventListener('click', () => openForm());
