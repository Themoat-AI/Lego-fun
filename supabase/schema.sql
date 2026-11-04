-- Run this entire script in the Supabase SQL editor for a new project.
-- This schema requires authenticated caregiver-managed accounts. Review privacy,
-- consent, moderation, retention and child-safety requirements before launch.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Builder',
  created_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  theme text not null check (theme in ('Space','City','Castle','Animals','Vehicles')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  signup_limit integer not null default 15 check (signup_limit = 15),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_signups (
  org_id uuid not null references public.organizations(id) on delete cascade,
  signup_date date not null default current_date,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (org_id, signup_date, user_id)
);

create table if not exists public.media_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 255),
  object_path text not null unique,
  size_bytes bigint not null check (size_bytes between 1 and 104857600),
  content_type text not null check (content_type like 'video/%'),
  created_at timestamptz not null default now()
);

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.organization_members where org_id = target_org and user_id = auth.uid()) $$;
revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;

create or replace function public.create_organization(p_name text, p_theme text)
returns uuid language plpgsql security invoker set search_path = public
as $$
declare new_org_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if char_length(trim(p_name)) not between 2 and 80 then raise exception 'Name must be 2–80 characters'; end if;
  if p_theme not in ('Space','City','Castle','Animals','Vehicles') then raise exception 'Invalid theme'; end if;
  insert into public.organizations(name, theme, owner_id) values (trim(p_name), p_theme, auth.uid()) returning id into new_org_id;
  insert into public.organization_members(org_id, user_id) values (new_org_id, auth.uid());
  return new_org_id;
end;
$$;
grant execute on function public.create_organization(text,text) to authenticated;

create or replace function public.join_organization(p_org_id uuid)
returns void language plpgsql security invoker set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then raise exception 'Organization not found'; end if;
  insert into public.organization_members(org_id, user_id) values (p_org_id, auth.uid()) on conflict do nothing;
end;
$$;
grant execute on function public.join_organization(uuid) to authenticated;

create or replace function public.signup_for_day(p_org_id uuid)
returns void language plpgsql security invoker set search_path = public
as $$
declare current_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not public.is_org_member(p_org_id) then raise exception 'Join the organization first'; end if;
  perform pg_advisory_xact_lock(hashtext(p_org_id::text), hashtext(current_date::text));
  select count(*) into current_count from public.daily_signups where org_id = p_org_id and signup_date = current_date;
  if current_count >= 15 then raise exception 'Daily signup is full (15 maximum)'; end if;
  insert into public.daily_signups(org_id, signup_date, user_id) values (p_org_id, current_date, auth.uid()) on conflict do nothing;
end;
$$;
grant execute on function public.signup_for_day(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.posts enable row level security;
alter table public.chat_messages enable row level security;
alter table public.daily_signups enable row level security;
alter table public.media_files enable row level security;

drop policy if exists "profiles_read_signed_in" on public.profiles;
create policy "profiles_read_signed_in" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "orgs_read_members" on public.organizations;
create policy "orgs_read_members" on public.organizations for select to authenticated using (public.is_org_member(id));
drop policy if exists "orgs_create_owner" on public.organizations;
create policy "orgs_create_owner" on public.organizations for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "orgs_update_owner" on public.organizations;
create policy "orgs_update_owner" on public.organizations for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "orgs_delete_owner" on public.organizations;
create policy "orgs_delete_owner" on public.organizations for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "members_read_org" on public.organization_members;
create policy "members_read_org" on public.organization_members for select to authenticated using (public.is_org_member(org_id));
drop policy if exists "members_join_self" on public.organization_members;
create policy "members_join_self" on public.organization_members for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.organizations o where o.id = org_id));
drop policy if exists "members_leave_self" on public.organization_members;
create policy "members_leave_self" on public.organization_members for delete to authenticated using (user_id = auth.uid());

 drop policy if exists "posts_read_members" on public.posts;
create policy "posts_read_members" on public.posts for select to authenticated using (public.is_org_member(org_id));
drop policy if exists "posts_create_members" on public.posts;
create policy "posts_create_members" on public.posts for insert to authenticated with check (author_id = auth.uid() and public.is_org_member(org_id));
drop policy if exists "posts_delete_author" on public.posts;
create policy "posts_delete_author" on public.posts for delete to authenticated using (author_id = auth.uid());

drop policy if exists "chat_read_members" on public.chat_messages;
create policy "chat_read_members" on public.chat_messages for select to authenticated using (public.is_org_member(org_id));
drop policy if exists "chat_create_members" on public.chat_messages;
create policy "chat_create_members" on public.chat_messages for insert to authenticated with check (author_id = auth.uid() and public.is_org_member(org_id));
drop policy if exists "chat_delete_author" on public.chat_messages;
create policy "chat_delete_author" on public.chat_messages for delete to authenticated using (author_id = auth.uid());

drop policy if exists "signups_read_members" on public.daily_signups;
create policy "signups_read_members" on public.daily_signups for select to authenticated using (public.is_org_member(org_id));

 drop policy if exists "media_read_members" on public.media_files;
create policy "media_read_members" on public.media_files for select to authenticated using (public.is_org_member(org_id));
drop policy if exists "media_insert_owner" on public.media_files;
create policy "media_insert_owner" on public.media_files for insert to authenticated with check (uploaded_by = auth.uid() and public.is_org_member(org_id));
drop policy if exists "media_delete_uploader" on public.media_files;
create policy "media_delete_uploader" on public.media_files for delete to authenticated using (uploaded_by = auth.uid());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('shared-media', 'shared-media', false, 104857600, array['video/mp4','video/quicktime','video/webm','video/ogg'])
on conflict (id) do update set public = false, file_size_limit = 104857600, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shared_media_member_read" on storage.objects;
create policy "shared_media_member_read" on storage.objects for select to authenticated using (bucket_id = 'shared-media' and public.is_org_member((storage.foldername(name))[1]::uuid));
drop policy if exists "shared_media_member_upload" on storage.objects;
create policy "shared_media_member_upload" on storage.objects for insert to authenticated with check (bucket_id = 'shared-media' and (storage.foldername(name))[2] = auth.uid()::text and public.is_org_member((storage.foldername(name))[1]::uuid));
drop policy if exists "shared_media_owner_delete" on storage.objects;
create policy "shared_media_owner_delete" on storage.objects for delete to authenticated using (bucket_id = 'shared-media' and (storage.foldername(name))[2] = auth.uid()::text and public.is_org_member((storage.foldername(name))[1]::uuid));

-- Enable Realtime for tables used by the app. Safe to run repeatedly.
do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.media_files;
exception when duplicate_object then null;
end $$;
