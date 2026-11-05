-- Run this migration in the Supabase SQL editor (or with the Supabase CLI).
-- All user content is private to authenticated club members; no sample records are inserted.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 3 and 32),
  created_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  theme text not null default 'Space',
  signup_limit integer not null default 15 check (signup_limit = 15),
  active_day text not null default 'Saturday',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.org_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_signups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  signup_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, signup_date)
);

create table if not exists public.media_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 255),
  content_type text not null check (content_type in ('video/mp4', 'video/quicktime', 'video/webm')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  created_at timestamptz not null default now()
);

create index if not exists org_members_user_idx on public.org_members(user_id);
create index if not exists posts_org_created_idx on public.posts(org_id, created_at desc);
create index if not exists messages_org_created_idx on public.messages(org_id, created_at);
create index if not exists daily_signups_org_day_idx on public.daily_signups(organization_id, signup_date);
create index if not exists media_files_org_created_idx on public.media_files(org_id, created_at desc);

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members m
    where m.organization_id = target_org and m.user_id = auth.uid()
  );
$$;
revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;

create or replace function public.add_org_creator_as_member()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.org_members (organization_id, user_id)
  values (new.id, new.created_by)
  on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists organizations_add_creator on public.organizations;
create trigger organizations_add_creator after insert on public.organizations
for each row execute function public.add_org_creator_as_member();

create or replace function public.join_organization(target_organization uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  current_count integer;
  member_limit integer;
begin
  if auth.uid() is null then raise exception 'Sign in to join a club.'; end if;
  select signup_limit into member_limit from public.organizations
    where id = target_organization for update;
  if not found then raise exception 'Club not found.'; end if;
  if exists (select 1 from public.org_members where organization_id = target_organization and user_id = auth.uid()) then
    return;
  end if;
  select count(*) into current_count from public.org_members where organization_id = target_organization;
  if current_count >= member_limit then raise exception 'This club has reached its 15 member limit.'; end if;
  insert into public.org_members (organization_id, user_id) values (target_organization, auth.uid());
end;
$$;
revoke all on function public.join_organization(uuid) from public;
grant execute on function public.join_organization(uuid) to authenticated;

create or replace function public.signup_for_day(target_organization uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in to sign up.'; end if;
  if not public.is_org_member(target_organization) then raise exception 'Join this club before signing up.'; end if;
  -- Serialize signups per club and date so concurrent requests cannot exceed 15.
  perform pg_advisory_xact_lock(hashtext(target_organization::text), hashtext(current_date::text));
  select count(*) into current_count from public.daily_signups
    where organization_id = target_organization and signup_date = current_date;
  if current_count >= 15 then raise exception 'Today’s build-day signup is full (15 people).'; end if;
  insert into public.daily_signups (organization_id, user_id, signup_date)
  values (target_organization, auth.uid(), current_date)
  on conflict (organization_id, user_id, signup_date) do nothing;
end;
$$;
revoke all on function public.signup_for_day(uuid) from public;
grant execute on function public.signup_for_day(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.posts enable row level security;
alter table public.messages enable row level security;
alter table public.daily_signups enable row level security;
alter table public.media_files enable row level security;

drop policy if exists "Authenticated users can view club display names" on public.profiles;
create policy "Authenticated users can view club display names" on public.profiles for select to authenticated using (true);
drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Members can view clubs" on public.organizations;
create policy "Members can view clubs" on public.organizations for select to authenticated using (public.is_org_member(id));
drop policy if exists "Authenticated users can create clubs" on public.organizations;
create policy "Authenticated users can create clubs" on public.organizations for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "Club creators can update clubs" on public.organizations;
create policy "Club creators can update clubs" on public.organizations for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists "Members can view club membership" on public.org_members;
create policy "Members can view club membership" on public.org_members for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists "Members can read club posts" on public.posts;
create policy "Members can read club posts" on public.posts for select to authenticated using (public.is_org_member(org_id));
drop policy if exists "Members can create club posts" on public.posts;
create policy "Members can create club posts" on public.posts for insert to authenticated with check (author_id = auth.uid() and public.is_org_member(org_id));
drop policy if exists "Authors can delete their posts" on public.posts;
create policy "Authors can delete their posts" on public.posts for delete to authenticated using (author_id = auth.uid());

drop policy if exists "Members can read club messages" on public.messages;
create policy "Members can read club messages" on public.messages for select to authenticated using (public.is_org_member(org_id));
drop policy if exists "Members can send club messages" on public.messages;
create policy "Members can send club messages" on public.messages for insert to authenticated with check (author_id = auth.uid() and public.is_org_member(org_id));
drop policy if exists "Authors can delete their messages" on public.messages;
create policy "Authors can delete their messages" on public.messages for delete to authenticated using (author_id = auth.uid());

drop policy if exists "Members can view daily signups" on public.daily_signups;
create policy "Members can view daily signups" on public.daily_signups for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists "Members can view club media metadata" on public.media_files;
create policy "Members can view club media metadata" on public.media_files for select to authenticated using (public.is_org_member(org_id));
drop policy if exists "Members can add their own media metadata" on public.media_files;
create policy "Members can add their own media metadata" on public.media_files for insert to authenticated with check (owner_id = auth.uid() and public.is_org_member(org_id));
drop policy if exists "Owners can delete media metadata" on public.media_files;
create policy "Owners can delete media metadata" on public.media_files for delete to authenticated using (owner_id = auth.uid());

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.organizations to authenticated;
grant select on public.org_members to authenticated;
grant select, insert, delete on public.posts to authenticated;
grant select, insert, delete on public.messages to authenticated;
grant select on public.daily_signups to authenticated;
grant select, insert, delete on public.media_files to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-media', 'org-media', false, 52428800, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set public = false, file_size_limit = 52428800,
  allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm'];

drop policy if exists "Club members can upload private videos" on storage.objects;
create policy "Club members can upload private videos" on storage.objects for insert to authenticated
with check (bucket_id = 'org-media' and public.is_org_member((storage.foldername(name))[1]::uuid) and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists "Club members can view private videos" on storage.objects;
create policy "Club members can view private videos" on storage.objects for select to authenticated
using (bucket_id = 'org-media' and public.is_org_member((storage.foldername(name))[1]::uuid));
drop policy if exists "Owners can delete private videos" on storage.objects;
create policy "Owners can delete private videos" on storage.objects for delete to authenticated
using (bucket_id = 'org-media' and (storage.foldername(name))[2] = auth.uid()::text);

-- Enable realtime for the tables used by the live feed, chat, membership counts, and media list.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts') then
    alter publication supabase_realtime add table public.posts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'org_members') then
    alter publication supabase_realtime add table public.org_members;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'media_files') then
    alter publication supabase_realtime add table public.media_files;
  end if;
end $$;
