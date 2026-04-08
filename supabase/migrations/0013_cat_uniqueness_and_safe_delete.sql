create or replace function app.normalize_cat_name(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(regexp_replace(btrim(coalesce(value, '')), '\s+', ' ', 'g'));
$$;

create or replace function app.guard_unique_cat_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text;
begin
  normalized_name := app.normalize_cat_name(new.name);

  if normalized_name = '' then
    return new;
  end if;

  if exists (
    select 1
    from public.cats as c
    where c.id <> coalesce(new.id, gen_random_uuid())
      and app.normalize_cat_name(c.name) = normalized_name
  ) then
    raise exception 'Ese gato ya esta registrado.';
  end if;

  return new;
end;
$$;

create or replace function app.cat_has_related_records(cat_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinical_processes
    where cat_id = cat_uuid

    union all

    select 1
    from public.event_cats
    where cat_id = cat_uuid

    union all

    select 1
    from public.event_cat_costs
    where cat_id = cat_uuid

    union all

    select 1
    from public.attachments
    where cat_id = cat_uuid
  );
$$;

create or replace function app.delete_archived_cat(p_cat_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  deleted_cat_id uuid;
begin
  if not app.is_allowlisted() then
    raise exception 'Not authorized to delete cats.';
  end if;

  actor_id := app.current_actor_profile_id();

  if actor_id is null then
    raise exception 'Active profile required to delete cats.';
  end if;

  if not exists (
    select 1
    from public.cats
    where id = p_cat_id
  ) then
    raise exception 'No fue posible encontrar este gato.';
  end if;

  if not exists (
    select 1
    from public.cats
    where id = p_cat_id
      and archived_at is not null
  ) then
    raise exception 'Solo puedes eliminar gatos archivados.';
  end if;

  if app.cat_has_related_records(p_cat_id) then
    raise exception 'No se puede eliminar este gato porque tiene registros relacionados.';
  end if;

  delete from public.cats
  where id = p_cat_id
  returning id into deleted_cat_id;

  return deleted_cat_id;
end;
$$;

create or replace function public.delete_archived_cat(p_cat_id uuid)
returns uuid
language sql
security definer
set search_path = public, app, pg_temp
as $$
  select app.delete_archived_cat(p_cat_id);
$$;

revoke all on function public.delete_archived_cat(uuid) from public;

grant execute on function public.delete_archived_cat(uuid) to authenticated;

drop trigger if exists cats_guard_unique_name on public.cats;

create trigger cats_guard_unique_name
before insert or update of name on public.cats
for each row execute function app.guard_unique_cat_name();

drop trigger if exists cats_audit_delete on public.cats;

create trigger cats_audit_delete
after delete on public.cats
for each row execute function app.audit_changes();

select pg_notify('pgrst', 'reload schema');
