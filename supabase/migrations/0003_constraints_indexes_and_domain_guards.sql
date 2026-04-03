create index authorized_users_email_idx
  on public.authorized_users (lower(email))
  where email is not null;

create index cats_active_idx
  on public.cats (name)
  where archived_at is null;

create index clinical_processes_cat_opened_idx
  on public.clinical_processes (cat_id, opened_at desc);

create index events_event_at_idx
  on public.events (event_at desc);

create index events_process_id_idx
  on public.events (process_id)
  where process_id is not null;

create index event_cats_cat_id_idx
  on public.event_cats (cat_id);

create unique index event_costs_id_event_id_key
  on public.event_costs (id, event_id);

alter table public.event_cat_costs
  add constraint event_cat_costs_event_cost_matches_event
  foreign key (event_cost_id, event_id)
  references public.event_costs (id, event_id)
  on delete restrict;

create index event_cost_items_event_cost_id_idx
  on public.event_cost_items (event_cost_id, sort_order);

create index event_cat_costs_cat_id_idx
  on public.event_cat_costs (cat_id);

create index attachments_cat_idx
  on public.attachments (cat_id, created_at desc)
  where cat_id is not null and removed_at is null;

create index attachments_event_idx
  on public.attachments (event_id, created_at desc)
  where event_id is not null and removed_at is null;

create index attachments_process_idx
  on public.attachments (process_id, created_at desc)
  where process_id is not null and removed_at is null;

create index audit_log_entity_idx
  on public.audit_log (entity_table, entity_id, created_at desc);

alter table public.attachments
  add constraint attachments_exactly_one_parent
  check (
    ((cat_id is not null)::integer +
     (event_id is not null)::integer +
     (process_id is not null)::integer) = 1
  );

alter table public.attachments
  add constraint attachments_primary_requires_cat
  check (not is_primary_for_cat or cat_id is not null);

alter table public.attachments
  add constraint attachments_primary_requires_image
  check (not is_primary_for_cat or file_kind = 'image');

create unique index attachments_one_primary_active_photo_per_cat_idx
  on public.attachments (cat_id)
  where cat_id is not null
    and is_primary_for_cat = true
    and removed_at is null;

create or replace function app.is_allowlisted()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.authorized_users
    where user_id = auth.uid()
      and is_active = true
      and revoked_at is null
  );
$$;

create or replace function app.current_actor_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles as p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do update
  set display_name = excluded.display_name;

  return new;
end;
$$;

create or replace function app.cat_is_archived(cat_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cats
    where id = cat_uuid
      and archived_at is not null
  );
$$;

create or replace function app.event_has_archived_cat(event_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_cats as ec
    join public.cats as c on c.id = ec.cat_id
    where ec.event_id = event_uuid
      and c.archived_at is not null
  );
$$;

create or replace function app.process_has_archived_cat(process_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinical_processes as cp
    join public.cats as c on c.id = cp.cat_id
    where cp.id = process_uuid
      and c.archived_at is not null
  );
$$;

create or replace function app.guard_archived_cat_mutations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'cats' then
    if tg_op = 'UPDATE' and old.archived_at is not null then
      if new.archived_at is null then
        return new;
      end if;

      if (
        to_jsonb(new) - 'updated_at' - 'updated_by' - 'archived_at' - 'archived_by'
      ) is distinct from (
        to_jsonb(old) - 'updated_at' - 'updated_by' - 'archived_at' - 'archived_by'
      ) then
        raise exception 'Archived cats are read-only until reactivated.';
      end if;
    end if;

    return new;
  end if;

  if tg_table_name = 'clinical_processes' then
    if app.cat_is_archived(new.cat_id) then
      raise exception 'Archived cats do not accept process changes.';
    end if;

    return new;
  end if;

  if tg_table_name = 'event_cats' then
    if app.cat_is_archived(new.cat_id) then
      raise exception 'Archived cats cannot receive new event links.';
    end if;

    return new;
  end if;

  if tg_table_name = 'events' then
    if tg_op in ('INSERT', 'UPDATE') and new.process_id is not null and app.process_has_archived_cat(new.process_id) then
      raise exception 'Archived cats do not accept process event changes.';
    end if;

    if tg_op = 'UPDATE' and app.event_has_archived_cat(new.id) then
      raise exception 'Events linked to archived cats are read-only.';
    end if;

    return new;
  end if;

  if tg_table_name = 'attachments' then
    if new.cat_id is not null and app.cat_is_archived(new.cat_id) then
      raise exception 'Archived cats do not accept media changes.';
    end if;

    if new.event_id is not null and app.event_has_archived_cat(new.event_id) then
      raise exception 'Events linked to archived cats are read-only.';
    end if;

    if new.process_id is not null and app.process_has_archived_cat(new.process_id) then
      raise exception 'Processes linked to archived cats are read-only.';
    end if;

    return new;
  end if;

  if tg_table_name = 'event_costs' then
    if app.event_has_archived_cat(new.event_id) then
      raise exception 'Archived cats do not accept cost changes.';
    end if;

    return new;
  end if;

  if tg_table_name = 'event_cost_items' then
    if exists (
      select 1
      from public.event_costs as ec
      where ec.id = new.event_cost_id
        and app.event_has_archived_cat(ec.event_id)
    ) then
      raise exception 'Archived cats do not accept cost item changes.';
    end if;

    return new;
  end if;

  if tg_table_name = 'event_cat_costs' then
    if app.cat_is_archived(new.cat_id) or app.event_has_archived_cat(new.event_id) then
      raise exception 'Archived cats do not accept cost allocation changes.';
    end if;

    return new;
  end if;

  return new;
end;
$$;

create or replace function app.audit_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  entity_uuid uuid;
begin
  actor_id := app.current_actor_profile_id();
  entity_uuid := case
    when tg_table_name = 'event_cats' then coalesce(new.event_id, old.event_id)
    else coalesce(new.id, old.id)
  end;

  insert into public.audit_log (
    actor_profile_id,
    entity_table,
    entity_id,
    action,
    summary,
    before_data,
    after_data
  )
  values (
    actor_id,
    tg_table_name,
    entity_uuid,
    lower(tg_op),
    case
      when tg_table_name = 'event_cats' then 'cat_id=' || coalesce(new.cat_id, old.cat_id)::text
      else null
    end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function app.touch_updated_at();

create trigger cats_set_updated_at
before update on public.cats
for each row execute function app.touch_updated_at();

create trigger event_categories_set_updated_at
before update on public.event_categories
for each row execute function app.touch_updated_at();

create trigger event_subcategories_set_updated_at
before update on public.event_subcategories
for each row execute function app.touch_updated_at();

create trigger clinical_processes_set_updated_at
before update on public.clinical_processes
for each row execute function app.touch_updated_at();

create trigger events_set_updated_at
before update on public.events
for each row execute function app.touch_updated_at();

create trigger event_costs_set_updated_at
before update on public.event_costs
for each row execute function app.touch_updated_at();

create trigger event_cat_costs_set_updated_at
before update on public.event_cat_costs
for each row execute function app.touch_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function app.handle_new_auth_user();

create trigger cats_guard_archived_updates
before update on public.cats
for each row execute function app.guard_archived_cat_mutations();

create trigger clinical_processes_guard_archived_changes
before insert or update on public.clinical_processes
for each row execute function app.guard_archived_cat_mutations();

create trigger event_cats_guard_archived_changes
before insert or update on public.event_cats
for each row execute function app.guard_archived_cat_mutations();

create trigger events_guard_archived_changes
before insert or update on public.events
for each row execute function app.guard_archived_cat_mutations();

create trigger attachments_guard_archived_changes
before insert or update on public.attachments
for each row execute function app.guard_archived_cat_mutations();

create trigger event_costs_guard_archived_changes
before insert or update on public.event_costs
for each row execute function app.guard_archived_cat_mutations();

create trigger event_cost_items_guard_archived_changes
before insert or update on public.event_cost_items
for each row execute function app.guard_archived_cat_mutations();

create trigger event_cat_costs_guard_archived_changes
before insert or update on public.event_cat_costs
for each row execute function app.guard_archived_cat_mutations();

create trigger cats_audit_changes
after insert or update on public.cats
for each row execute function app.audit_changes();

create trigger event_categories_audit_changes
after insert or update on public.event_categories
for each row execute function app.audit_changes();

create trigger event_subcategories_audit_changes
after insert or update on public.event_subcategories
for each row execute function app.audit_changes();

create trigger clinical_processes_audit_changes
after insert or update on public.clinical_processes
for each row execute function app.audit_changes();

create trigger events_audit_changes
after insert or update on public.events
for each row execute function app.audit_changes();

create trigger event_cats_audit_changes
after insert on public.event_cats
for each row execute function app.audit_changes();

create trigger event_costs_audit_changes
after insert or update on public.event_costs
for each row execute function app.audit_changes();

create trigger event_cost_items_audit_changes
after insert or update on public.event_cost_items
for each row execute function app.audit_changes();

create trigger event_cat_costs_audit_changes
after insert or update on public.event_cat_costs
for each row execute function app.audit_changes();

create trigger attachments_audit_changes
after insert or update on public.attachments
for each row execute function app.audit_changes();
