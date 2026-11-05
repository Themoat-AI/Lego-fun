-- Apply this AFTER 20261105000000_live_workspace.sql.
-- Enables club sharing via invite codes without exposing club content to non-members.
-- Anonymous Supabase Auth users use the authenticated database role, so existing RLS remains active.

alter table public.organizations
  add column if not exists invite_code text;

update public.organizations
set invite_code = upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10))
where invite_code is null;

alter table public.organizations
  alter column invite_code set default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10)),
  alter column invite_code set not null;

create unique index if not exists organizations_invite_code_unique
  on public.organizations (invite_code);

create or replace function public.join_organization_by_code(code text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  target_org uuid;
begin
  if auth.uid() is null then raise exception 'Start a guest session first.'; end if;
  select id into target_org from public.organizations
    where invite_code = upper(trim(code)) for update;
  if not found then raise exception 'Invite code not found.'; end if;
  perform public.join_organization(target_org);
  return target_org;
end;
$$;
revoke all on function public.join_organization_by_code(text) from public;
grant execute on function public.join_organization_by_code(text) to authenticated;
