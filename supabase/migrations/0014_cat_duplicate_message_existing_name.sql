create or replace function app.guard_unique_cat_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text;
  conflicting_name text;
begin
  normalized_name := app.normalize_cat_name(new.name);

  if normalized_name = '' then
    return new;
  end if;

  select c.name
  into conflicting_name
  from public.cats as c
  where c.id <> coalesce(new.id, gen_random_uuid())
    and app.normalize_cat_name(c.name) = normalized_name
  order by c.created_at asc
  limit 1;

  if conflicting_name is not null then
    raise exception 'Ese gato ya esta registrado y se encuentra guardado como "%".', conflicting_name;
  end if;

  return new;
end;
$$;

select pg_notify('pgrst', 'reload schema');
