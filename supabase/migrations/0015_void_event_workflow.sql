create or replace view public.cat_cost_totals as
select
  ecc.cat_id,
  coalesce(sum(ecc.amount), 0)::numeric(12, 2) as total_amount
from public.event_cat_costs as ecc
join public.events as e on e.id = ecc.event_id
where e.voided_at is null
group by ecc.cat_id;

create or replace function app.is_process_header_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events as e
    join public.clinical_processes as cp on cp.id = e.process_id
    where e.id = p_event_id
      and cp.opened_at = e.event_at
      and cp.created_at = e.created_at
  );
$$;

create or replace function app.is_process_closed_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinical_processes
    where closed_event_id = p_event_id
  );
$$;

create or replace function app.void_event(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  voided_event_id uuid;
begin
  if not app.is_allowlisted() then
    raise exception 'Not authorized to remove events.';
  end if;

  actor_id := app.current_actor_profile_id();

  if actor_id is null then
    raise exception 'Active profile required to remove events.';
  end if;

  if not exists (
    select 1
    from public.events
    where id = p_event_id
      and voided_at is null
  ) then
    raise exception 'Event not found or unavailable.';
  end if;

  if app.event_has_archived_cat(p_event_id) then
    raise exception 'Archived cats do not accept event changes.';
  end if;

  if app.is_process_header_event(p_event_id) then
    raise exception 'The start event of a clinical process cannot be removed.';
  end if;

  if app.is_process_closed_event(p_event_id) then
    raise exception 'The closing event of a clinical process cannot be removed.';
  end if;

  update public.events
  set
    voided_at = now(),
    voided_by = actor_id,
    updated_by = actor_id
  where id = p_event_id
    and voided_at is null
  returning id into voided_event_id;

  if voided_event_id is null then
    raise exception 'Event not found or unavailable.';
  end if;

  return voided_event_id;
end;
$$;

create or replace function public.void_event(p_event_id uuid)
returns uuid
language sql
security definer
set search_path = public, app, pg_temp
as $$
  select app.void_event(p_event_id);
$$;

revoke all on function public.void_event(uuid) from public;

grant execute on function public.void_event(uuid) to authenticated;

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

    if tg_op = 'UPDATE'
       and (
         new.voided_at is distinct from old.voided_at
         or new.voided_by is distinct from old.voided_by
       ) then
      if app.is_process_header_event(new.id) then
        raise exception 'Clinical process start events cannot be removed.';
      end if;

      if app.is_process_closed_event(new.id) then
        raise exception 'Clinical process closing events cannot be removed.';
      end if;
    end if;

    if tg_op in ('INSERT', 'UPDATE') and new.process_id is not null and app.clinical_process_is_closed(new.process_id) then
      if tg_op = 'INSERT' then
        raise exception 'Closed clinical processes do not accept new records.';
      end if;

      if old.process_id is distinct from new.process_id
         or old.title is distinct from new.title
         or old.notes is distinct from new.notes
         or old.time_kind is distinct from new.time_kind
         or old.event_at is distinct from new.event_at
         or old.category_id is distinct from new.category_id
         or old.subcategory_id is distinct from new.subcategory_id then
        raise exception 'Closed clinical processes do not accept new records.';
      end if;
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

select pg_notify('pgrst', 'reload schema');
