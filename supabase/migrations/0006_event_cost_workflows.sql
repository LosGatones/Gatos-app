create or replace function app.allocate_shared_total(
  p_cat_ids uuid[],
  p_total_amount numeric
)
returns table (
  cat_id uuid,
  amount numeric(12, 2)
)
language plpgsql
security definer
set search_path = public
as $$
declare
  cat_count integer;
  idx integer;
  total_cents integer;
  base_cents integer;
  adjustment_cents integer;
  amount_cents integer;
begin
  cat_count := coalesce(array_length(p_cat_ids, 1), 0);

  if cat_count = 0 then
    raise exception 'At least one cat is required to allocate shared costs.';
  end if;

  if p_total_amount is null or p_total_amount < 0 then
    raise exception 'Shared total must be a non-negative amount.';
  end if;

  total_cents := round((round(p_total_amount, 2) * 100)::numeric)::integer;
  base_cents := round(((round(p_total_amount, 2) / cat_count) * 100)::numeric)::integer;
  adjustment_cents := total_cents - (base_cents * cat_count);

  for idx in 1..cat_count loop
    amount_cents := base_cents;

    if adjustment_cents > 0 and idx > cat_count - adjustment_cents then
      amount_cents := amount_cents + 1;
    elsif adjustment_cents < 0 and idx > cat_count - abs(adjustment_cents) then
      amount_cents := amount_cents - 1;
    end if;

    cat_id := p_cat_ids[idx];
    amount := (amount_cents::numeric / 100)::numeric(12, 2);
    return next;
  end loop;
end;
$$;

create or replace function app.apply_event_costs(
  p_event_id uuid,
  p_cat_ids uuid[],
  p_cost_mode public.event_cost_mode,
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
  event_cost_id uuid;
  cat_count integer;
  normalized_currency text;
  normalized_total_amount numeric(12, 2);
  provided_count integer;
  provided_unique_count integer;
  missing_count integer;
  extra_count integer;
  negative_count integer;
begin
  if not app.is_allowlisted() then
    raise exception 'Not authorized to manage event costs.';
  end if;

  actor_id := app.current_actor_profile_id();

  if actor_id is null then
    raise exception 'Active profile required to manage event costs.';
  end if;

  if app.event_has_archived_cat(p_event_id) then
    raise exception 'Archived cats do not accept cost changes.';
  end if;

  cat_count := coalesce(array_length(p_cat_ids, 1), 0);

  if cat_count = 0 then
    raise exception 'At least one cat is required to manage costs.';
  end if;

  select count(*), count(distinct cat_id)
  into provided_count, provided_unique_count
  from unnest(p_cat_ids) as cat_id;

  if provided_count <> provided_unique_count then
    raise exception 'Duplicate cats are not allowed in event costs.';
  end if;

  normalized_currency := upper(coalesce(nullif(btrim(p_currency_code), ''), 'MXN'));

  if char_length(normalized_currency) <> 3 then
    raise exception 'Currency code must have exactly 3 characters.';
  end if;

  insert into public.event_costs (
    event_id,
    mode,
    currency_code,
    total_amount
  )
  values (
    p_event_id,
    p_cost_mode,
    normalized_currency,
    case when p_cost_mode = 'none' then null else round(p_total_amount, 2) end
  )
  on conflict (event_id) do update
  set mode = excluded.mode,
      currency_code = excluded.currency_code,
      total_amount = excluded.total_amount
  returning id into event_cost_id;

  delete from public.event_cat_costs
  where event_id = p_event_id;

  if p_cost_mode = 'none' then
    update public.events
    set updated_by = actor_id
    where id = p_event_id;

    return event_cost_id;
  end if;

  if p_cost_mode = 'shared_total' then
    if p_total_amount is null or p_total_amount < 0 then
      raise exception 'Shared total requires a non-negative total amount.';
    end if;

    normalized_total_amount := round(p_total_amount, 2);

    update public.event_costs
    set currency_code = normalized_currency,
        total_amount = normalized_total_amount
    where id = event_cost_id;

    insert into public.event_cat_costs (
      event_id,
      event_cost_id,
      cat_id,
      amount
    )
    select
      p_event_id,
      event_cost_id,
      allocation.cat_id,
      allocation.amount
    from app.allocate_shared_total(p_cat_ids, normalized_total_amount) as allocation;

    update public.events
    set updated_by = actor_id
    where id = p_event_id;

    return event_cost_id;
  end if;

  if jsonb_typeof(coalesce(p_per_cat_amounts, '[]'::jsonb)) <> 'array' then
    raise exception 'Per-cat amounts must be sent as an array.';
  end if;

  with provided as (
    select
      (item ->> 'cat_id')::uuid as cat_id,
      round(((item ->> 'amount')::numeric), 2)::numeric(12, 2) as amount
    from jsonb_array_elements(coalesce(p_per_cat_amounts, '[]'::jsonb)) as item
  )
  select count(*), count(distinct cat_id)
  into provided_count, provided_unique_count
  from provided;

  if provided_count <> cat_count or provided_unique_count <> cat_count then
    raise exception 'Per-cat costs must include each involved cat exactly once.';
  end if;

  with provided as (
    select
      (item ->> 'cat_id')::uuid as cat_id,
      round(((item ->> 'amount')::numeric), 2)::numeric(12, 2) as amount
    from jsonb_array_elements(coalesce(p_per_cat_amounts, '[]'::jsonb)) as item
  )
  select count(*)
  into missing_count
  from unnest(p_cat_ids) as cat_id
  left join provided using (cat_id)
  where provided.cat_id is null;

  with provided as (
    select
      (item ->> 'cat_id')::uuid as cat_id,
      round(((item ->> 'amount')::numeric), 2)::numeric(12, 2) as amount
    from jsonb_array_elements(coalesce(p_per_cat_amounts, '[]'::jsonb)) as item
  )
  select count(*)
  into extra_count
  from provided
  where not (cat_id = any (p_cat_ids));

  with provided as (
    select
      (item ->> 'cat_id')::uuid as cat_id,
      round(((item ->> 'amount')::numeric), 2)::numeric(12, 2) as amount
    from jsonb_array_elements(coalesce(p_per_cat_amounts, '[]'::jsonb)) as item
  )
  select count(*)
  into negative_count
  from provided
  where amount < 0;

  if missing_count > 0 or extra_count > 0 then
    raise exception 'Per-cat costs must match the event cats exactly.';
  end if;

  if negative_count > 0 then
    raise exception 'Per-cat costs cannot be negative.';
  end if;

  with provided as (
    select
      (item ->> 'cat_id')::uuid as cat_id,
      round(((item ->> 'amount')::numeric), 2)::numeric(12, 2) as amount
    from jsonb_array_elements(coalesce(p_per_cat_amounts, '[]'::jsonb)) as item
  )
  select coalesce(sum(amount), 0)::numeric(12, 2)
  into normalized_total_amount
  from provided;

  update public.event_costs
  set currency_code = normalized_currency,
      total_amount = normalized_total_amount
  where id = event_cost_id;

  insert into public.event_cat_costs (
    event_id,
    event_cost_id,
    cat_id,
    amount
  )
  select
    p_event_id,
    event_cost_id,
    provided.cat_id,
    provided.amount
  from (
    select
      (item ->> 'cat_id')::uuid as cat_id,
      round(((item ->> 'amount')::numeric), 2)::numeric(12, 2) as amount
    from jsonb_array_elements(coalesce(p_per_cat_amounts, '[]'::jsonb)) as item
  ) as provided;

  update public.events
  set updated_by = actor_id
  where id = p_event_id;

  return event_cost_id;
end;
$$;

create or replace function app.create_event_with_costs(
  p_title text,
  p_notes text,
  p_event_at timestamptz,
  p_category_id uuid default null,
  p_subcategory_id uuid default null,
  p_cat_ids uuid[] default '{}'::uuid[],
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
begin
  if not app.is_allowlisted() then
    raise exception 'Not authorized to create events.';
  end if;

  actor_id := app.current_actor_profile_id();

  if actor_id is null then
    raise exception 'Active profile required to create events.';
  end if;

  insert into public.events (
    title,
    notes,
    time_kind,
    event_at,
    category_id,
    subcategory_id,
    created_by,
    updated_by
  )
  values (
    btrim(p_title),
    nullif(btrim(coalesce(p_notes, '')), ''),
    'occurred',
    p_event_at,
    p_category_id,
    p_subcategory_id,
    actor_id,
    actor_id
  )
  returning id into event_id;

  insert into public.event_cats (
    event_id,
    cat_id,
    created_by
  )
  select
    event_id,
    cat_id,
    actor_id
  from unnest(p_cat_ids) as cat_id;

  perform app.apply_event_costs(
    event_id,
    p_cat_ids,
    p_cost_mode,
    p_currency_code,
    p_total_amount,
    p_per_cat_amounts
  );

  return event_id;
end;
$$;

create or replace function app.update_event_costs(
  p_event_id uuid,
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
  cat_ids uuid[];
begin
  if not exists (
    select 1
    from public.events
    where id = p_event_id
      and voided_at is null
  ) then
    raise exception 'Event not found or unavailable.';
  end if;

  select array_agg(cat_id order by cat_id)
  into cat_ids
  from public.event_cats
  where event_id = p_event_id;

  return app.apply_event_costs(
    p_event_id,
    coalesce(cat_ids, '{}'::uuid[]),
    p_cost_mode,
    p_currency_code,
    p_total_amount,
    p_per_cat_amounts
  );
end;
$$;

create trigger event_cat_costs_audit_deletes
after delete on public.event_cat_costs
for each row execute function app.audit_changes();

grant execute on function app.create_event_with_costs(
  text,
  text,
  timestamptz,
  uuid,
  uuid,
  uuid[],
  public.event_cost_mode,
  text,
  numeric,
  jsonb
) to authenticated;

grant execute on function app.update_event_costs(
  uuid,
  public.event_cost_mode,
  text,
  numeric,
  jsonb
) to authenticated;
