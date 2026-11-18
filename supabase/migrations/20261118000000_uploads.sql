-- Community uploads: listeners' own stories (audio) and films (video).
-- Run once in Supabase → SQL Editor (safe to run again).

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('story', 'film')),
  title text not null check (char_length(title) between 1 and 120),
  category text check (char_length(category) <= 40),
  description text check (char_length(description) <= 600),
  media_path text not null,
  duration int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists uploads_feed_idx on public.uploads (kind, hidden, created_at desc);

create table if not exists public.upload_reports (
  upload_id uuid not null references public.uploads on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (upload_id, user_id)
);

-- Three reports hide an upload until a moderator un-hides it (Table Editor → uploads → hidden).
create or replace function public.on_upload_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.upload_reports where upload_id = new.upload_id) >= 3 then
    update public.uploads set hidden = true where id = new.upload_id;
  end if;
  return new;
end $$;
drop trigger if exists upload_reported on public.upload_reports;
create trigger upload_reported after insert on public.upload_reports
  for each row execute function public.on_upload_report();

alter table public.uploads enable row level security;
alter table public.upload_reports enable row level security;

drop policy if exists "uploads readable" on public.uploads;
create policy "uploads readable" on public.uploads for select using (not hidden or user_id = auth.uid());
drop policy if exists "uploads own insert" on public.uploads;
create policy "uploads own insert" on public.uploads for insert with check (user_id = auth.uid() and hidden = false);
drop policy if exists "uploads own update" on public.uploads;
create policy "uploads own update" on public.uploads for update using (user_id = auth.uid()) with check (user_id = auth.uid() and hidden = false);
drop policy if exists "uploads own delete" on public.uploads;
create policy "uploads own delete" on public.uploads for delete using (user_id = auth.uid());

drop policy if exists "upload reports own insert" on public.upload_reports;
create policy "upload reports own insert" on public.upload_reports for insert with check (user_id = auth.uid());

-- Public "media" bucket: audio + video up to 50 MB, users write only to their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array[
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'
])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media upload own folder" on storage.objects;
create policy "media upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media delete own folder" on storage.objects;
create policy "media delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
