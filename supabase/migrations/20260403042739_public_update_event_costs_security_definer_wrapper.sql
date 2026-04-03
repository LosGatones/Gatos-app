create or replace function public.update_event_costs(
  p_event_id uuid,
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
  select app.update_event_costs(
    p_event_id,
    p_cost_mode,
    p_currency_code,
    p_total_amount,
    p_per_cat_amounts
  );
$$;

revoke all on function public.update_event_costs(
  uuid,
  public.event_cost_mode,
  text,
  numeric,
  jsonb
) from public;

grant execute on function public.update_event_costs(
  uuid,
  public.event_cost_mode,
  text,
  numeric,
  jsonb
) to authenticated;

select pg_notify('pgrst', 'reload schema');