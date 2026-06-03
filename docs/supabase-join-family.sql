-- Supabase SQL Editorで実行してください。
-- 家族作成時に「家族・自分のメンバー登録・最初の猫」をまとめて作る関数と、
-- 2人目以降がファミリーID（紹介コード）で参加する関数を追加します。
-- ファミリーID参加、猫プロフィール追加・編集がうまくいかない場合も、このSQLを再実行してください。

create unique index if not exists family_members_family_user_unique
on public.family_members (family_id, user_id);

create or replace function public.create_family_with_default_cat(
  family_name text default 'RAGDOLL-HOME',
  member_display_name text default 'オーナー'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'login_required';
  end if;

  insert into public.families (name, created_by)
  values (coalesce(nullif(trim(family_name), ''), 'RAGDOLL-HOME'), auth.uid())
  returning id into created_family_id;

  insert into public.family_members (family_id, user_id, display_name, role)
  values (
    created_family_id,
    auth.uid(),
    coalesce(nullif(trim(member_display_name), ''), 'オーナー'),
    'owner'
  )
  on conflict (family_id, user_id)
  do update set display_name = excluded.display_name, role = 'owner';

  insert into public.cats (family_id, name, breed, coat, avatar_key)
  values (created_family_id, '猫1', 'ラグドール', '', 'cat-relax');

  return created_family_id;
end;
$$;

grant execute on function public.create_family_with_default_cat(text, text) to authenticated;

create or replace function public.verify_family_invite_code(
  target_invite_code text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.families
    where upper(invite_code) = upper(trim(target_invite_code))
  );
$$;

grant execute on function public.verify_family_invite_code(text) to anon;
grant execute on function public.verify_family_invite_code(text) to authenticated;

create or replace function public.join_family_by_invite_code(
  target_invite_code text,
  member_display_name text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'login_required';
  end if;

  select id
    into target_family_id
  from public.families
  where upper(invite_code) = upper(trim(target_invite_code))
  limit 1;

  if target_family_id is null then
    raise exception 'invite_code_not_found';
  end if;

  insert into public.family_members (family_id, user_id, display_name, role)
  values (
    target_family_id,
    auth.uid(),
    coalesce(nullif(trim(member_display_name), ''), '家族'),
    'member'
  )
  on conflict (family_id, user_id)
  do update set display_name = excluded.display_name;

  return target_family_id;
end;
$$;

grant execute on function public.join_family_by_invite_code(text, text) to authenticated;

create or replace function public.add_family_cat(
  target_family_id uuid,
  cat_name text default '猫',
  cat_breed text default 'ラグドール',
  cat_coat text default '',
  cat_birthday date default null,
  cat_avatar_key text default 'cat-relax'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_cat_id uuid;
begin
  if auth.uid() is null then
    raise exception 'login_required';
  end if;

  if not exists (
    select 1
    from public.family_members
    where family_id = target_family_id
      and user_id = auth.uid()
  ) then
    raise exception 'not_family_member';
  end if;

  insert into public.cats (family_id, name, breed, coat, birthday, avatar_key)
  values (
    target_family_id,
    coalesce(nullif(trim(cat_name), ''), '名前未設定'),
    coalesce(nullif(trim(cat_breed), ''), 'ラグドール'),
    coalesce(trim(cat_coat), ''),
    cat_birthday,
    coalesce(nullif(trim(cat_avatar_key), ''), 'cat-relax')
  )
  returning id into created_cat_id;

  return created_cat_id;
end;
$$;

grant execute on function public.add_family_cat(uuid, text, text, text, date, text) to authenticated;

create or replace function public.update_family_cat(
  target_cat_id uuid,
  cat_name text default '名前未設定',
  cat_breed text default 'ラグドール',
  cat_coat text default '',
  cat_birthday date default null,
  cat_avatar_key text default 'cat-relax'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'login_required';
  end if;

  select family_id
    into target_family_id
  from public.cats
  where id = target_cat_id
  limit 1;

  if target_family_id is null then
    raise exception 'cat_not_found';
  end if;

  if not exists (
    select 1
    from public.family_members
    where family_id = target_family_id
      and user_id = auth.uid()
  ) then
    raise exception 'not_family_member';
  end if;

  update public.cats
     set name = coalesce(nullif(trim(cat_name), ''), '名前未設定'),
         breed = coalesce(nullif(trim(cat_breed), ''), 'ラグドール'),
         coat = coalesce(trim(cat_coat), ''),
         birthday = cat_birthday,
         avatar_key = coalesce(nullif(trim(cat_avatar_key), ''), 'cat-relax'),
         updated_at = now()
   where id = target_cat_id;
end;
$$;

grant execute on function public.update_family_cat(uuid, text, text, text, date, text) to authenticated;

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.cats enable row level security;
alter table public.logs enable row level security;

drop policy if exists "families_select_for_members" on public.families;
create policy "families_select_for_members"
on public.families
for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.family_members
    where family_members.family_id = families.id
      and family_members.user_id = auth.uid()
  )
);

drop policy if exists "families_insert_own" on public.families;
create policy "families_insert_own"
on public.families
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "families_update_for_members" on public.families;
create policy "families_update_for_members"
on public.families
for update
to authenticated
using (
  exists (
    select 1
    from public.family_members
    where family_members.family_id = families.id
      and family_members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.family_members
    where family_members.family_id = families.id
      and family_members.user_id = auth.uid()
  )
);

drop policy if exists "family_members_select_own" on public.family_members;
create policy "family_members_select_own"
on public.family_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "family_members_update_own" on public.family_members;
create policy "family_members_update_own"
on public.family_members
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "cats_select_for_members" on public.cats;
create policy "cats_select_for_members"
on public.cats
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members
    where family_members.family_id = cats.family_id
      and family_members.user_id = auth.uid()
  )
);

drop policy if exists "cats_insert_for_members" on public.cats;
create policy "cats_insert_for_members"
on public.cats
for insert
to authenticated
with check (
  exists (
    select 1
    from public.family_members
    where family_members.family_id = cats.family_id
      and family_members.user_id = auth.uid()
  )
);

drop policy if exists "cats_update_for_members" on public.cats;
create policy "cats_update_for_members"
on public.cats
for update
to authenticated
using (
  exists (
    select 1
    from public.family_members
    where family_members.family_id = cats.family_id
      and family_members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.family_members
    where family_members.family_id = cats.family_id
      and family_members.user_id = auth.uid()
  )
);

drop policy if exists "logs_select_for_members" on public.logs;
create policy "logs_select_for_members"
on public.logs
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members
    where family_members.family_id = logs.family_id
      and family_members.user_id = auth.uid()
  )
);

drop policy if exists "logs_insert_for_members" on public.logs;
create policy "logs_insert_for_members"
on public.logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.family_members
    where family_members.family_id = logs.family_id
      and family_members.user_id = auth.uid()
  )
);

drop policy if exists "logs_update_for_members" on public.logs;
create policy "logs_update_for_members"
on public.logs
for update
to authenticated
using (
  exists (
    select 1
    from public.family_members
    where family_members.family_id = logs.family_id
      and family_members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.family_members
    where family_members.family_id = logs.family_id
      and family_members.user_id = auth.uid()
  )
);

drop policy if exists "logs_delete_for_members" on public.logs;
create policy "logs_delete_for_members"
on public.logs
for delete
to authenticated
using (
  exists (
    select 1
    from public.family_members
    where family_members.family_id = logs.family_id
      and family_members.user_id = auth.uid()
  )
);
