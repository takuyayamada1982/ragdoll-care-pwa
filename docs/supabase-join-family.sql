-- Supabase SQL Editorで1回実行してください。
-- 家族作成時に「家族・自分のメンバー登録・最初の猫」をまとめて作る関数と、
-- 2人目以降が招待コードで参加する関数を追加します。

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
  where invite_code = upper(trim(target_invite_code))
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
