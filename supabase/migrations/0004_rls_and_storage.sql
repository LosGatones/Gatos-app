alter table public.authorized_users enable row level security;
alter table public.profiles enable row level security;
alter table public.cats enable row level security;
alter table public.event_categories enable row level security;
alter table public.event_subcategories enable row level security;
alter table public.clinical_processes enable row level security;
alter table public.events enable row level security;
alter table public.event_cats enable row level security;
alter table public.event_costs enable row level security;
alter table public.event_cost_items enable row level security;
alter table public.event_cat_costs enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_log enable row level security;

create policy "authorized_users_select_own"
on public.authorized_users
for select
to authenticated
using (user_id = auth.uid());

create policy "profiles_select_allowlisted"
on public.profiles
for select
to authenticated
using (app.is_allowlisted());

create policy "profiles_update_own_allowlisted"
on public.profiles
for update
to authenticated
using (app.is_allowlisted() and id = auth.uid())
with check (app.is_allowlisted() and id = auth.uid());

create policy "cats_select_allowlisted"
on public.cats
for select
to authenticated
using (app.is_allowlisted());

create policy "cats_insert_allowlisted"
on public.cats
for insert
to authenticated
with check (app.is_allowlisted());

create policy "cats_update_allowlisted"
on public.cats
for update
to authenticated
using (app.is_allowlisted())
with check (app.is_allowlisted());

create policy "event_categories_select_allowlisted"
on public.event_categories
for select
to authenticated
using (app.is_allowlisted());

create policy "event_categories_insert_allowlisted"
on public.event_categories
for insert
to authenticated
with check (app.is_allowlisted());

create policy "event_categories_update_allowlisted"
on public.event_categories
for update
to authenticated
using (app.is_allowlisted())
with check (app.is_allowlisted());

create policy "event_subcategories_select_allowlisted"
on public.event_subcategories
for select
to authenticated
using (app.is_allowlisted());

create policy "event_subcategories_insert_allowlisted"
on public.event_subcategories
for insert
to authenticated
with check (app.is_allowlisted());

create policy "event_subcategories_update_allowlisted"
on public.event_subcategories
for update
to authenticated
using (app.is_allowlisted())
with check (app.is_allowlisted());

create policy "clinical_processes_select_allowlisted"
on public.clinical_processes
for select
to authenticated
using (app.is_allowlisted());

create policy "clinical_processes_insert_allowlisted"
on public.clinical_processes
for insert
to authenticated
with check (app.is_allowlisted());

create policy "clinical_processes_update_allowlisted"
on public.clinical_processes
for update
to authenticated
using (app.is_allowlisted())
with check (app.is_allowlisted());

create policy "events_select_allowlisted"
on public.events
for select
to authenticated
using (app.is_allowlisted());

create policy "events_insert_allowlisted"
on public.events
for insert
to authenticated
with check (app.is_allowlisted());

create policy "events_update_allowlisted"
on public.events
for update
to authenticated
using (app.is_allowlisted())
with check (app.is_allowlisted());

create policy "event_cats_select_allowlisted"
on public.event_cats
for select
to authenticated
using (app.is_allowlisted());

create policy "event_cats_insert_allowlisted"
on public.event_cats
for insert
to authenticated
with check (app.is_allowlisted());

create policy "event_costs_select_allowlisted"
on public.event_costs
for select
to authenticated
using (app.is_allowlisted());

create policy "event_costs_insert_allowlisted"
on public.event_costs
for insert
to authenticated
with check (app.is_allowlisted());

create policy "event_costs_update_allowlisted"
on public.event_costs
for update
to authenticated
using (app.is_allowlisted())
with check (app.is_allowlisted());

create policy "event_cost_items_select_allowlisted"
on public.event_cost_items
for select
to authenticated
using (app.is_allowlisted());

create policy "event_cost_items_insert_allowlisted"
on public.event_cost_items
for insert
to authenticated
with check (app.is_allowlisted());

create policy "event_cost_items_update_allowlisted"
on public.event_cost_items
for update
to authenticated
using (app.is_allowlisted())
with check (app.is_allowlisted());

create policy "event_cat_costs_select_allowlisted"
on public.event_cat_costs
for select
to authenticated
using (app.is_allowlisted());

create policy "event_cat_costs_insert_allowlisted"
on public.event_cat_costs
for insert
to authenticated
with check (app.is_allowlisted());

create policy "event_cat_costs_update_allowlisted"
on public.event_cat_costs
for update
to authenticated
using (app.is_allowlisted())
with check (app.is_allowlisted());

create policy "attachments_select_allowlisted"
on public.attachments
for select
to authenticated
using (app.is_allowlisted());

create policy "attachments_insert_allowlisted"
on public.attachments
for insert
to authenticated
with check (app.is_allowlisted());

create policy "attachments_update_allowlisted"
on public.attachments
for update
to authenticated
using (app.is_allowlisted())
with check (app.is_allowlisted());

create policy "audit_log_select_allowlisted"
on public.audit_log
for select
to authenticated
using (app.is_allowlisted());

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do update
set public = excluded.public;

create policy "storage_select_allowlisted_attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'attachments'
  and app.is_allowlisted()
);

create policy "storage_insert_allowlisted_attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'attachments'
  and app.is_allowlisted()
);

create policy "storage_update_allowlisted_attachments"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'attachments'
  and app.is_allowlisted()
)
with check (
  bucket_id = 'attachments'
  and app.is_allowlisted()
);
