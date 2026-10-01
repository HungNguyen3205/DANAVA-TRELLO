-- Run once in the Supabase SQL editor. No sample users or tasks are inserted.
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  title text not null check (char_length(title) between 1 and 100),
  data jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) <= 254),
  role text not null check (role in ('admin','editor','viewer')),
  primary key (workspace_id,email)
);
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create function public.workspace_role(workspace uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when w.owner_id = auth.uid() then 'admin' else
    (select m.role from public.workspace_members m where m.workspace_id=w.id and m.email=lower(auth.jwt()->>'email')) end
  from public.workspaces w where w.id=workspace and auth.uid() is not null;
$$;
create policy workspace_read on public.workspaces for select to authenticated
using (public.workspace_role(id) is not null);
create policy member_read on public.workspace_members for select to authenticated
using (public.workspace_role(workspace_id) is not null);
-- Client writes go through checked, transactional functions only.
revoke all on public.workspaces, public.workspace_members from anon, authenticated;
grant select on public.workspaces, public.workspace_members to authenticated;

create function public.validate_board(board_data jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  if octet_length(board_data::text)>1000000
    or jsonb_typeof(board_data->'columns') is distinct from 'array'
    or jsonb_typeof(board_data->'tasks') is distinct from 'array'
    or jsonb_typeof(board_data->'users') is distinct from 'array'
    or jsonb_typeof(board_data->'activity') is distinct from 'array'
    or jsonb_typeof(board_data->'title') is distinct from 'string'
  then raise exception 'INVALID_BOARD'; end if;
  if jsonb_array_length(board_data->'columns')<1 then raise exception 'BOARD_NEEDS_COLUMN'; end if;
  if exists (select 1 from jsonb_array_elements(board_data->'tasks') t where not exists
    (select 1 from jsonb_array_elements(board_data->'columns') c where c->>'id'=t->>'columnId'))
  then raise exception 'INVALID_COLUMN'; end if;
end;
$$;
create function public.create_workspace(workspace_title text, board_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid; owner_email text;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  owner_email=lower(auth.jwt()->>'email');
  if owner_email is null then raise exception 'EMAIL_REQUIRED'; end if;
  perform public.validate_board(board_data);
  insert into public.workspaces(owner_id,title,data) values(auth.uid(),trim(workspace_title),
    jsonb_set(jsonb_set(board_data,'{title}',to_jsonb(trim(workspace_title))),'{activity}','[]'::jsonb)) returning id into new_id;
  insert into public.workspace_members(workspace_id,email,role) values(new_id,owner_email,'admin');
  return new_id;
end;
$$;
create function public.save_board(workspace uuid, expected_version integer, board_data jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare old_row public.workspaces%rowtype; new_version integer; audit jsonb; new_activity jsonb;
begin
  if coalesce(public.workspace_role(workspace),'') not in ('admin','editor') then raise exception 'FORBIDDEN'; end if;
  perform public.validate_board(board_data);
  select * into old_row from public.workspaces where id=workspace for update;
  if old_row.version is distinct from expected_version then raise exception 'CONFLICT'; end if;
  audit=jsonb_build_object('id',gen_random_uuid(),'author',auth.jwt()->>'email','createdAt',now(),
    'text',left(coalesce(board_data#>>'{activity,0,text}','Cập nhật bảng'),300));
  select coalesce(jsonb_agg(e.value order by e.ordinality),'[]'::jsonb) into new_activity
    from jsonb_array_elements(jsonb_build_array(audit) || coalesce(old_row.data->'activity','[]'::jsonb)) with ordinality e
    where e.ordinality <= 150;
  update public.workspaces set data=jsonb_set(board_data,'{activity}',new_activity),version=version+1,updated_at=now()
    where id=workspace returning version into new_version;
  return new_version;
end;
$$;
create function public.set_workspace_member(workspace uuid, member_email text, member_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare owner_email text;
begin
  if public.workspace_role(workspace) is distinct from 'admin' then raise exception 'FORBIDDEN'; end if;
  member_email=lower(trim(member_email));
  if member_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'INVALID_EMAIL'; end if;
  select lower(u.email) into owner_email from public.workspaces w join auth.users u on u.id=w.owner_id where w.id=workspace;
  if member_email=owner_email then raise exception 'CANNOT_CHANGE_OWNER'; end if;
  if member_role='remove' then
    delete from public.workspace_members where workspace_id=workspace and email=member_email;
  elsif member_role in ('editor','viewer') then
    insert into public.workspace_members(workspace_id,email,role) values(workspace,member_email,member_role)
      on conflict(workspace_id,email) do update set role=excluded.role;
  else raise exception 'INVALID_ROLE'; end if;
end;
$$;
revoke all on function public.workspace_role(uuid), public.validate_board(jsonb), public.create_workspace(text,jsonb), public.save_board(uuid,integer,jsonb), public.set_workspace_member(uuid,text,text) from public, anon, authenticated;
grant execute on function public.workspace_role(uuid), public.create_workspace(text,jsonb), public.save_board(uuid,integer,jsonb), public.set_workspace_member(uuid,text,text) to authenticated;
-- Optional: enable Realtime on public.workspaces in Database > Publications.
-- The app also refreshes every 30 seconds while visible as a fallback.
