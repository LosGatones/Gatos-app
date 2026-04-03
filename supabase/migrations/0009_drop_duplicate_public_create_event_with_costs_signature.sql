drop function if exists public.create_event_with_costs(
  uuid[],
  uuid,
  public.event_cost_mode,
  text,
  timestamptz,
  text,
  jsonb,
  uuid,
  text,
  numeric
);

select pg_notify('pgrst', 'reload schema');
