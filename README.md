# Портфолио Дениса

Сайт: https://mikerka1.github.io/ · репозиторий: https://github.com/MIKERKA1/MIKERKA1.github.io

Одностраничный сайт: Vite + ванильный JS, anime.js (hero и SVG), Motion (скролл, карточки, модалки), Supabase (проекты, вход, картинки).

## Запуск

```bash
npm install
cp .env.example .env   # вписать URL проекта и publishable key из Supabase
npm run dev            # http://localhost:5173
npm run build          # сборка в dist/
```

В `.env` только публичные значения: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SITE_URL`.
Service key в проект не кладётся никогда: права проверяет RLS в базе.

## Админка

1. Один раз: Supabase → Authentication → URL Configuration. Site URL `https://mikerka1.github.io`, в Redirect URLs добавить `https://mikerka1.github.io/**` и `http://localhost:5173/**`.
2. Внизу страницы нажать «Войти» (или открыть сайт с `#admin`), ввести `jkak527@gmail.com`.
3. Открыть письмо в том же браузере, где запросил ссылку.
4. У блока «Проекты» появится «+ Добавить проект», у карточек «Изменить» и «Удалить».

Править проекты может только этот адрес: так настроены политики RLS в `supabase/migrations/001_projects.sql`.
Чтобы сменить владельца, замени почту в функции `public.is_owner()` и в `OWNER` в `src/admin.js`.

## Добавить проект

«+ Добавить проект» → заполнить название, тип, описание (EN-поля по желанию), стек через запятую,
ссылки и картинку. Картинка сама сжимается до 1600px в WebP и уходит в Supabase Storage.
Карточка появляется сразу, другие посетители увидят её при следующем открытии страницы.
«Порядок»: чем меньше число, тем выше карточка.

## Как обновлять сайт

Тексты и стили правятся в `index.html`, `src/style.css`, переводы в `src/i18n.js`.
После `git push` в ветку `main` хостинг пересобирает сайт сам.
Сборка заодно вшивает в HTML снимок проектов, чтобы сетка не была пустой, если Supabase у посетителя тормозит.

## Структура

```
index.html               разметка всех секций, SEO и OG-теги
src/main.js              hero-анимация, появление блоков, тема, язык
src/projects.js          загрузка, фильтр и FLIP-анимации карточек
src/admin.js             вход, форма проекта, удаление (грузится только при входе)
src/i18n.js              английские строки
vite.config.js           снимок проектов при сборке
supabase/migrations/     таблица, RLS, бакет для картинок
public/seed/             картинки демо-проектов
```
