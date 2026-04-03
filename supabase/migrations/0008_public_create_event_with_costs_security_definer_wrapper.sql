create or replace function public.create_event_with_costs(
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
language sql
security definer
set search_path = public, app, pg_temp
as $$
  select app.create_event_with_costs(
    p_title,
    p_notes,
    p_event_at,
    p_category_id,
    p_subcategory_id,
    p_cat_ids,
    p_cost_mode,
    p_currency_code,
    p_total_amount,
    p_per_cat_amounts
  );
$$;

revoke all on function public.create_event_with_costs(
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
) from public;

grant execute on function public.create_event_with_costs(
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

select pg_notify('pgrst', 'reload schema');
