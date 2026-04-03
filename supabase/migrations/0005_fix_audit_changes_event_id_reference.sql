create or replace function app.audit_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  entity_uuid uuid;
  summary_text text;
begin
  actor_id := app.current_actor_profile_id();

  if tg_table_name = 'event_cats' then
    entity_uuid := coalesce(new.event_id, old.event_id);
    summary_text := 'cat_id=' || coalesce(new.cat_id, old.cat_id)::text;
  else
    entity_uuid := coalesce(new.id, old.id);
    summary_text := null;
  end if;

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
    summary_text,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;
