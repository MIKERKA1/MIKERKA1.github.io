-- Проекты портфолио: читать могут все, менять только владелец (по почте из JWT magic link).

create or replace function public.is_owner() returns boolean
language sql stable set search_path = ''
as $$ select coalesce((auth.jwt() ->> 'email') = 'jkak527@gmail.com', false) $$;

create table public.projects (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (char_length(title) between 1 and 120),
  title_en       text check (char_length(title_en) <= 120),
  description    text not null default '' check (char_length(description) <= 1000),
  description_en text check (char_length(description_en) <= 1000),
  type           text not null check (type in ('site', 'bot')),
  stack          text[] not null default '{}',
  url            text check (url ~ '^https?://'),
  github_url     text check (github_url ~ '^https?://'),
  image_url      text check (image_url ~ '^(https?://|/)'),
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

create index projects_order_idx on public.projects (sort_order, created_at desc);

alter table public.projects enable row level security;

grant select on public.projects to anon, authenticated;
grant insert, update, delete on public.projects to authenticated;

create policy "projects: read for everyone" on public.projects
  for select to anon, authenticated using (true);
create policy "projects: owner inserts" on public.projects
  for insert to authenticated with check ((select public.is_owner()));
create policy "projects: owner updates" on public.projects
  for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "projects: owner deletes" on public.projects
  for delete to authenticated using ((select public.is_owner()));

-- Картинки: публичный бакет, до 5 МБ, только изображения.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('projects', 'projects', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/avif']);

create policy "project images: owner reads" on storage.objects
  for select to authenticated using (bucket_id = 'projects' and (select public.is_owner()));
create policy "project images: owner uploads" on storage.objects
  for insert to authenticated with check (bucket_id = 'projects' and (select public.is_owner()));
create policy "project images: owner deletes" on storage.objects
  for delete to authenticated using (bucket_id = 'projects' and (select public.is_owner()));
