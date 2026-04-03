create type public.event_time_kind as enum ('occurred', 'scheduled');
create type public.event_cost_mode as enum ('none', 'per_cat', 'shared_total');
create type public.attachment_file_kind as enum ('image', 'document', 'other');

create table public.authorized_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id),
  notes text
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cats (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  notes text,
  archived_at timestamptz,
  archived_by uuid references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (btrim(code) <> ''),
  label text not null check (btrim(label) <> ''),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.event_categories (id) on delete restrict,
  code text not null check (btrim(code) <> ''),
  label text not null check (btrim(label) <> ''),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_subcategories_category_code_key unique (category_id, code)
);

create table public.clinical_processes (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats (id) on delete restrict,
  title text not null check (btrim(title) <> ''),
  notes text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_processes_closed_after_opened
    check (closed_at is null or closed_at >= opened_at)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  notes text,
  time_kind public.event_time_kind not null,
  event_at timestamptz not null,
  category_id uuid references public.event_categories (id) on delete restrict,
  subcategory_id uuid references public.event_subcategories (id) on delete restrict,
  process_id uuid references public.clinical_processes (id) on delete restrict,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_cats (
  event_id uuid not null references public.events (id) on delete restrict,
  cat_id uuid not null references public.cats (id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  primary key (event_id, cat_id)
);

create table public.event_costs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete restrict,
  mode public.event_cost_mode not null default 'none',
  currency_code text not null default 'MXN' check (char_length(currency_code) = 3),
  total_amount numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_costs_total_required
    check (
      (mode = 'none' and total_amount is null)
      or (mode in ('per_cat', 'shared_total') and total_amount is not null and total_amount >= 0)
    )
);

create table public.event_cost_items (
  id uuid primary key default gen_random_uuid(),
  event_cost_id uuid not null references public.event_costs (id) on delete restrict,
  label text not null check (btrim(label) <> ''),
  amount numeric(12, 2) not null check (amount >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.event_cat_costs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  event_cost_id uuid not null references public.event_costs (id) on delete restrict,
  cat_id uuid not null references public.cats (id) on delete restrict,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_cat_costs_event_cat_key unique (event_id, cat_id)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid references public.cats (id) on delete restrict,
  event_id uuid references public.events (id) on delete restrict,
  process_id uuid references public.clinical_processes (id) on delete restrict,
  bucket text not null default 'attachments',
  storage_path text not null unique,
  original_filename text not null check (btrim(original_filename) <> ''),
  mime_type text,
  byte_size bigint not null check (byte_size > 0),
  file_kind public.attachment_file_kind not null default 'other',
  caption text,
  sort_order integer not null default 0,
  is_primary_for_cat boolean not null default false,
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references public.profiles (id)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_profile_id uuid references public.profiles (id),
  entity_table text not null check (btrim(entity_table) <> ''),
  entity_id uuid not null,
  action text not null check (btrim(action) <> ''),
  summary text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create view public.cat_cost_totals as
select
  ecc.cat_id,
  coalesce(sum(ecc.amount), 0)::numeric(12, 2) as total_amount
from public.event_cat_costs as ecc
group by ecc.cat_id;
