create or replace function app.create_clinical_process(
  p_cat_id uuid,
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

  created_timestamp := now();

  insert into public.clinical_processes (
    cat_id,
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
    p_title,
    p_notes,
    p_opened_at
  );
$$;

revoke all on function public.create_clinical_process(
  uuid,
  text,
  text,
  timestamptz
) from public;

grant execute on function public.create_clinical_process(
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

select pg_notify('pgrst', 'reload schema');
