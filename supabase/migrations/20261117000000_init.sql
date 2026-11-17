-- Do.T backend schema (Supabase / Postgres)
-- Run once: Supabase Dashboard → SQL Editor → paste & Run, or `supabase db push`.

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text unique not null,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, handle)
  values (new.id, 'user' || substr(md5(new.id::text), 1, 10))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- clips ----------
create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  caption text check (char_length(caption) <= 220),
  video_path text not null,
  likes_count int not null default 0,
  comments_count int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists clips_feed_idx on public.clips (hidden, created_at desc);

create table if not exists public.clip_likes (
  clip_id uuid not null references public.clips on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (clip_id, user_id)
);

create table if not exists public.clip_comments (
  id bigint generated always as identity primary key,
  clip_id uuid not null references public.clips on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists clip_comments_clip_idx on public.clip_comments (clip_id, created_at desc);

create table if not exists public.clip_reports (
  id bigint generated always as identity primary key,
  clip_id uuid not null references public.clips on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (clip_id, user_id)
);

-- ---------- favourites sync ----------
create table if not exists public.favorites (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  item_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- ---------- push (Firebase Cloud Messaging tokens) ----------
create table if not exists public.device_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);

create or replace function public.register_device(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.device_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

-- ---------- notifications inbox ----------
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('like', 'comment', 'system')),
  clip_id uuid references public.clips on delete cascade,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------- counters, notifications, auto-moderation ----------
create or replace function public.on_like_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if tg_op = 'INSERT' then
    update public.clips set likes_count = likes_count + 1 where id = new.clip_id returning user_id into owner;
    if owner is not null and owner <> new.user_id then
      insert into public.notifications (user_id, actor_id, kind, clip_id) values (owner, new.user_id, 'like', new.clip_id);
    end if;
    return new;
  else
    update public.clips set likes_count = greatest(likes_count - 1, 0) where id = old.clip_id;
    return old;
  end if;
end $$;

drop trigger if exists clip_likes_count on public.clip_likes;
create trigger clip_likes_count after insert or delete on public.clip_likes
  for each row execute function public.on_like_change();

create or replace function public.on_comment_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if tg_op = 'INSERT' then
    update public.clips set comments_count = comments_count + 1 where id = new.clip_id returning user_id into owner;
    if owner is not null and owner <> new.user_id then
      insert into public.notifications (user_id, actor_id, kind, clip_id, body)
      values (owner, new.user_id, 'comment', new.clip_id, left(new.body, 80));
    end if;
    return new;
  else
    update public.clips set comments_count = greatest(comments_count - 1, 0) where id = old.clip_id;
    return old;
  end if;
end $$;

drop trigger if exists clip_comments_count on public.clip_comments;
create trigger clip_comments_count after insert or delete on public.clip_comments
  for each row execute function public.on_comment_change();

-- Three reports hide a clip until a moderator un-hides it (Table Editor → clips → hidden).
create or replace function public.on_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.clip_reports where clip_id = new.clip_id) >= 3 then
    update public.clips set hidden = true where id = new.clip_id;
  end if;
  return new;
end $$;

drop trigger if exists clip_reports_hide on public.clip_reports;
create trigger clip_reports_hide after insert on public.clip_reports
  for each row execute function public.on_report();

-- ---------- row-level security ----------
alter table public.profiles enable row level security;
alter table public.clips enable row level security;
alter table public.clip_likes enable row level security;
alter table public.clip_comments enable row level security;
alter table public.clip_reports enable row level security;
alter table public.favorites enable row level security;
alter table public.device_tokens enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "clips readable" on public.clips;
create policy "clips readable" on public.clips for select using (not hidden or user_id = auth.uid());
drop policy if exists "clips own insert" on public.clips;
create policy "clips own insert" on public.clips for insert with check (user_id = auth.uid());
drop policy if exists "clips own update" on public.clips;
create policy "clips own update" on public.clips for update using (user_id = auth.uid()) with check (user_id = auth.uid() and hidden = false);
drop policy if exists "clips own delete" on public.clips;
create policy "clips own delete" on public.clips for delete using (user_id = auth.uid());

drop policy if exists "likes readable" on public.clip_likes;
create policy "likes readable" on public.clip_likes for select using (true);
drop policy if exists "likes own insert" on public.clip_likes;
create policy "likes own insert" on public.clip_likes for insert with check (user_id = auth.uid());
drop policy if exists "likes own delete" on public.clip_likes;
create policy "likes own delete" on public.clip_likes for delete using (user_id = auth.uid());

drop policy if exists "comments readable" on public.clip_comments;
create policy "comments readable" on public.clip_comments for select using (true);
drop policy if exists "comments own insert" on public.clip_comments;
create policy "comments own insert" on public.clip_comments for insert with check (user_id = auth.uid());
drop policy if exists "comments own delete" on public.clip_comments;
create policy "comments own delete" on public.clip_comments for delete using (user_id = auth.uid());

drop policy if exists "reports own insert" on public.clip_reports;
create policy "reports own insert" on public.clip_reports for insert with check (user_id = auth.uid());

drop policy if exists "favorites own" on public.favorites;
create policy "favorites own" on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "tokens own" on public.device_tokens;
create policy "tokens own" on public.device_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- storage: public "clips" bucket, users write only to their own folder ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clips', 'clips', true, 52428800, array['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "clips upload own folder" on storage.objects;
create policy "clips upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'clips' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "clips delete own folder" on storage.objects;
create policy "clips delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'clips' and (storage.foldername(name))[1] = auth.uid()::text);
