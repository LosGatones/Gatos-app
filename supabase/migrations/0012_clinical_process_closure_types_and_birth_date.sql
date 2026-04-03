create table public.clinical_process_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (btrim(code) <> ''),
  label text not null check (btrim(label) <> ''),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clinical_process_types enable row level security;

create policy "clinical_process_types_select_allowlisted"
on public.clinical_process_types
for select
to authenticated
using (app.is_allowlisted());

create policy "clinical_process_types_insert_allowlisted"
on public.clinical_process_types
for insert
to authenticated
with check (app.is_allowlisted());

create policy "clinical_process_types_update_allowlisted"
on public.clinical_process_types
for update
to authenticated
using (app.is_allowlisted())
with check (app.is_allowlisted());

create trigger clinical_process_types_set_updated_at
before update on public.clinical_process_types
for each row execute function app.touch_updated_at();

create trigger clinical_process_types_audit_changes
after insert or update on public.clinical_process_types
for each row execute function app.audit_changes();

alter table public.cats
  add column birth_date date;

alter table public.clinical_processes
  add column process_type_id uuid references public.clinical_process_types (id) on delete restrict,
  add column closed_event_id uuid references public.events (id) on delete restrict;

insert into public.clinical_process_types (code, label, sort_order, is_active)
values ('general', 'General', 0, true)
on conflict (code) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_active = true;

update public.clinical_processes as cp
set process_type_id = cpt.id
from public.clinical_process_types as cpt
where cpt.code = 'general'
  and cp.process_type_id is null;

do $$
begin
  if exists (
    select 1
    from public.clinical_processes
    where process_type_id is null
  ) then
    raise exception 'Could not backfill clinical_processes.process_type_id.';
  end if;
end;
$$;

alter table public.clinical_processes
  alter column process_type_id set not null;

create index clinical_process_types_sort_idx
  on public.clinical_process_types (sort_order, label);

create index clinical_processes_process_type_id_idx
  on public.clinical_processes (process_type_id);

create or replace function app.clinical_process_is_closed(p_process_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinical_processes
    where id = p_process_id
      and closed_at is not null
  );
$$;

create or replace function app.validate_clinical_process_closed_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_process_id uuid;
begin
  if new.closed_event_id is null then
    return new;
  end if;

  select process_id
  into event_process_id
  from public.events
  where id = new.closed_event_id;

  if event_process_id is null then
    raise exception 'Closed event must belong to the same clinical process.';
  end if;

  if event_process_id is distinct from new.id then
    raise exception 'Closed event must belong to the same clinical process.';
  end if;

  return new;
end;
$$;

create trigger clinical_processes_validate_closed_event
before insert or update on public.clinical_processes
for each row execute function app.validate_clinical_process_closed_event();

create or replace function app.close_clinical_process(
  p_process_id uuid,
  p_title text,
  p_notes text default null,
  p_event_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  process_cat_id uuid;
  event_id uuid;
  created_timestamp timestamptz;
begin
  if not app.is_allowlisted() then
    raise exception 'Not authorized to close clinical processes.';
  end if;

  actor_id := app.current_actor_profile_id();

  if actor_id is null then
    raise exception 'Active profile required to close clinical processes.';
  end if;

  select cat_id
  into process_cat_id
  from public.clinical_processes
  where id = p_process_id;

  if process_cat_id is null then
    raise exception 'Clinical process not found.';
  end if;

  if app.process_has_archived_cat(p_process_id) then
    raise exception 'Archived cats do not accept process changes.';
  end if;

  if app.clinical_process_is_closed(p_process_id) then
    raise exception 'This clinical process is already closed.';
  end if;

  created_timestamp := now();

  insert into public.events (
    title,
    notes,
    time_kind,
    event_at,
    process_id,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  values (
    btrim(p_title),
    nullif(btrim(coalesce(p_notes, '')), ''),
    'occurred',
    p_event_at,
    p_process_id,
    actor_id,
    actor_id,
    created_timestamp,
    created_timestamp
  )
  returning id into event_id;

  insert into public.event_cats (
    event_id,
    cat_id,
    created_at,
    created_by
  )
  values (
    event_id,
    process_cat_id,
    created_timestamp,
    actor_id
  );

  update public.clinical_processes
  set
    closed_at = p_event_at,
    closed_event_id = event_id,
    updated_by = actor_id,
    updated_at = created_timestamp
  where id = p_process_id;

  return event_id;
end;
$$;

create or replace function public.close_clinical_process(
  p_process_id uuid,
  p_title text,
  p_notes text default null,
  p_event_at timestamptz default now()
)
returns uuid
language sql
security definer
set search_path = public, app, pg_temp
as $$
  select app.close_clinical_process(
    p_process_id,
    p_title,
    p_notes,
    p_event_at
  );
$$;

revoke all on function public.close_clinical_process(
  uuid,
  text,
  text,
  timestamptz
) from public;

grant execute on function public.close_clinical_process(
  uuid,
  text,
  text,
  timestamptz
) to authenticated;

create or replace function app.create_clinical_process(
  p_cat_id uuid,
  p_process_type_id uuid,
  p_title text,
  p_notes text default null,
  p_opened_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  process_id uuid;
  header_event_id uuid;
  created_timestamp timestamptz;
begin
  if not app.is_allowlisted() then
    raise exception 'Not authorized to create clinical processes.';
  end if;

  actor_id := app.current_actor_profile_id();

  if actor_id is null then
    raise exception 'Active profile required to create clinical processes.';
  end if;

  if not exists (
    select 1
    from public.clinical_process_types
    where id = p_process_type_id
      and is_active = true
  ) then
    raise exception 'Clinical process type not available.';
  end if;

  created_timestamp := now();

  insert into public.clinical_processes (
    cat_id,
    process_type_id,
    title,
    notes,
    opened_at,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  values (
    p_cat_id,
    p_process_type_id,
    btrim(p_title),
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_opened_at,
    actor_id,
    actor_id,
    created_timestamp,
    created_timestamp
  )
  returning id into process_id;

  insert into public.events (
    title,
    notes,
    time_kind,
    event_at,
    process_id,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  values (
    btrim(p_title),
    nullif(btrim(coalesce(p_notes, '')), ''),
    'occurred',
    p_opened_at,
    process_id,
    actor_id,
    actor_id,
    created_timestamp,
    created_timestamp
  )
  returning id into header_event_id;

  insert into public.event_cats (
    event_id,
    cat_id,
    created_at,
    created_by
  )
  values (
    header_event_id,
    p_cat_id,
    created_timestamp,
    actor_id
  );

  return process_id;
end;
$$;

create or replace function app.create_process_event(
  p_process_id uuid,
  p_title text,
  p_notes text,
  p_event_at timestamptz,
  p_cost_mode public.event_cost_mode default 'none',
  p_currency_code text default 'MXN',
  p_total_amount numeric default null,
  p_per_cat_amounts jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  event_id uuid;
  process_cat_id uuid;
  created_timestamp timestamptz;
begin
  if not app.is_allowlisted() then
    raise exception 'Not authorized to create process events.';
  end if;

  actor_id := app.current_actor_profile_id();

  if actor_id is null then
    raise exception 'Active profile required to create process events.';
  end if;

  select cat_id
  into process_cat_id
  from public.clinical_processes
  where id = p_process_id;

  if process_cat_id is null then
    raise exception 'Clinical process not found.';
  end if;

  if app.clinical_process_is_closed(p_process_id) then
    raise exception 'Closed clinical processes do not accept new records.';
  end if;

  created_timestamp := now();

  insert into public.events (
    title,
    notes,
    time_kind,
    event_at,
    process_id,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  values (
    btrim(p_title),
    nullif(btrim(coalesce(p_notes, '')), ''),
    'occurred',
    p_event_at,
    p_process_id,
    actor_id,
    actor_id,
    created_timestamp,
    created_timestamp
  )
  returning id into event_id;

  insert into public.event_cats (
    event_id,
    cat_id,
    created_at,
    created_by
  )
  values (
    event_id,
    process_cat_id,
    created_timestamp,
    actor_id
  );

  perform app.apply_event_costs(
    event_id,
    array[process_cat_id],
    p_cost_mode,
    p_currency_code,
    p_total_amount,
    p_per_cat_amounts
  );

  return event_id;
end;
$$;

create or replace function public.create_clinical_process(
  p_cat_id uuid,
  p_process_type_id uuid,
  p_title text,
  p_notes text default null,
  p_opened_at timestamptz default now()
)
returns uuid
language sql
security definer
set search_path = public, app, pg_temp
as $$
  select app.create_clinical_process(
    p_cat_id,
    p_process_type_id,
    p_title,
    p_notes,
    p_opened_at
  );
$$;

revoke all on function public.create_clinical_process(
  uuid,
  uuid,
  text,
  text,
  timestamptz
) from public;

grant execute on function public.create_clinical_process(
  uuid,
  uuid,
  text,
  text,
  timestamptz
) to authenticated;

create or replace function public.create_process_event(
  p_process_id uuid,
  p_title text,
  p_notes text,
  p_event_at timestamptz,
  p_cost_mode public.event_cost_mode default 'none',
  p_currency_code text default 'MXN',
  p_total_amount numeric default null,
  p_per_cat_amounts jsonb default '[]'::jsonb
)
returns uuid
language sql
security definer
set search_path = public, app, pg_temp
as $$
  select app.create_process_event(
    p_process_id,
    p_title,
    p_notes,
    p_event_at,
    p_cost_mode,
    p_currency_code,
    p_total_amount,
    p_per_cat_amounts
  );
$$;

revoke all on function public.create_process_event(
  uuid,
  text,
  text,
  timestamptz,
  public.event_cost_mode,
  text,
  numeric,
  jsonb
) from public;

grant execute on function public.create_process_event(
  uuid,
  text,
  text,
  timestamptz,
  public.event_cost_mode,
  text,
  numeric,
  jsonb
) to authenticated;

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
         or old.subcategory_id is distinct from new.subcategory_id
         or old.voided_at is distinct from new.voided_at
         or old.voided_by is distinct from new.voided_by then
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
