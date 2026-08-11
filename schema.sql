-- ============================================================
-- CureForever Inventory Management System — Database Schema
-- Run this in Supabase: Dashboard → SQL Editor → New query → Run
-- ============================================================

-- 1. VENDORS TABLE
-- One row per vendor. Linked 1:1 to a Supabase Auth user via user_id.
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) unique, -- set after the vendor's login is created
  name text not null,
  state text not null,
  contact_phone text,
  is_admin boolean not null default false,       -- true only for admin
  created_at timestamptz not null default now()
);

-- 2. PRODUCTS TABLE
-- Master product list. Shared across all vendors (SKUs are the same everywhere).
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique not null,
  category text,
  low_stock_threshold integer not null default 10,
  created_at timestamptz not null default now()
);

-- 3. STOCK ENTRIES TABLE
-- One row per (vendor, product). Updated regularly by vendors or admin.
create table if not exists stock_entries (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity integer not null default 0,
  expiry_date date,
  notes text,
  last_updated timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (vendor_id, product_id)
);

-- 4. STOCK HISTORY TABLE
-- Tracks historical quantity updates over time for line chart visualization.
create table if not exists stock_history (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity integer not null,
  recorded_at timestamptz not null default now()
);

-- 5. REORDER REQUESTS TABLE
-- Stock reorder requests submitted by vendors and managed by admin.
create table if not exists reorder_requests (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  requested_qty integer not null default 1,
  note text,
  status text not null default 'pending', -- pending, fulfilled, cancelled
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- 6. PRODUCT VISIBILITY TABLE
-- Maps products to specific vendors (when empty/absent, product is visible to all vendors).
create table if not exists product_visibility (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  unique (product_id, vendor_id)
);

-- 7. ANNOUNCEMENTS TABLE
-- Broadcast announcements sent by admin to all vendors.
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 8. ANNOUNCEMENT READS TABLE
-- Tracks which announcements have been dismissed/read by which vendors.
create table if not exists announcement_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (announcement_id, vendor_id)
);

-- ============================================================
-- TRIGGERS & AUTOMATION
-- ============================================================

-- Keep last_updated fresh automatically on every stock edit
create or replace function set_last_updated()
returns trigger as $$
begin
  new.last_updated = now();
  new.updated_by = auth.uid();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_stock_updated on stock_entries;
create trigger trg_stock_updated
before update on stock_entries
for each row execute function set_last_updated();

-- Record history point automatically whenever stock quantity is inserted or updated
create or replace function record_stock_history()
returns trigger as $$
begin
  insert into stock_history (vendor_id, product_id, quantity)
  values (new.vendor_id, new.product_id, new.quantity);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_stock_history on stock_entries;
create trigger trg_stock_history
after insert or update on stock_entries
for each row execute function record_stock_history();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table vendors enable row level security;
alter table products enable row level security;
alter table stock_entries enable row level security;
alter table stock_history enable row level security;
alter table reorder_requests enable row level security;
alter table product_visibility enable row level security;
alter table announcements enable row level security;
alter table announcement_reads enable row level security;

-- Helper: is the logged-in user an admin?
create or replace function is_admin()
returns boolean as $$
  select coalesce((select is_admin from vendors where user_id = auth.uid()), false);
$$ language sql stable security definer;

-- Helper: the vendor_id belonging to the logged-in user
create or replace function my_vendor_id()
returns uuid as $$
  select id from vendors where user_id = auth.uid();
$$ language sql stable security definer;

-- --- vendors table policies ---
drop policy if exists "vendors_select_all" on vendors;
create policy "vendors_select_all" on vendors for select using (true);

drop policy if exists "vendors_admin_write" on vendors;
create policy "vendors_admin_write" on vendors for all using (is_admin()) with check (is_admin());

-- --- products table policies ---
drop policy if exists "products_select_all" on products;
create policy "products_select_all" on products for select using (true);

drop policy if exists "products_admin_write" on products;
create policy "products_admin_write" on products for all using (is_admin()) with check (is_admin());

-- --- stock_entries table policies ---
drop policy if exists "stock_select" on stock_entries;
create policy "stock_select" on stock_entries for select using (is_admin() or vendor_id = my_vendor_id());

drop policy if exists "stock_insert" on stock_entries;
create policy "stock_insert" on stock_entries for insert with check (is_admin() or vendor_id = my_vendor_id());

drop policy if exists "stock_update" on stock_entries;
create policy "stock_update" on stock_entries for update using (is_admin() or vendor_id = my_vendor_id()) with check (is_admin() or vendor_id = my_vendor_id());

drop policy if exists "stock_delete" on stock_entries;
create policy "stock_delete" on stock_entries for delete using (is_admin());

-- --- stock_history table policies ---
drop policy if exists "history_select" on stock_history;
create policy "history_select" on stock_history for select using (is_admin() or vendor_id = my_vendor_id());

drop policy if exists "history_insert" on stock_history;
create policy "history_insert" on stock_history for insert with check (is_admin() or vendor_id = my_vendor_id());

-- --- reorder_requests table policies ---
drop policy if exists "reorder_select" on reorder_requests;
create policy "reorder_select" on reorder_requests for select using (is_admin() or vendor_id = my_vendor_id());

drop policy if exists "reorder_insert" on reorder_requests;
create policy "reorder_insert" on reorder_requests for insert with check (is_admin() or vendor_id = my_vendor_id());

drop policy if exists "reorder_update" on reorder_requests;
create policy "reorder_update" on reorder_requests for update using (is_admin()) with check (is_admin());

drop policy if exists "reorder_delete" on reorder_requests;
create policy "reorder_delete" on reorder_requests for delete using (is_admin());

-- --- product_visibility table policies ---
drop policy if exists "visibility_select" on product_visibility;
create policy "visibility_select" on product_visibility for select using (true);

drop policy if exists "visibility_admin_write" on product_visibility;
create policy "visibility_admin_write" on product_visibility for all using (is_admin()) with check (is_admin());

-- --- announcements table policies ---
drop policy if exists "announcements_select" on announcements;
create policy "announcements_select" on announcements for select using (true);

drop policy if exists "announcements_admin_write" on announcements;
create policy "announcements_admin_write" on announcements for all using (is_admin()) with check (is_admin());

-- --- announcement_reads table policies ---
drop policy if exists "reads_select" on announcement_reads;
create policy "reads_select" on announcement_reads for select using (is_admin() or vendor_id = my_vendor_id());

drop policy if exists "reads_insert_update" on announcement_reads;
create policy "reads_insert_update" on announcement_reads for all using (is_admin() or vendor_id = my_vendor_id()) with check (is_admin() or vendor_id = my_vendor_id());

-- ============================================================
-- SUPABASE REALTIME PUBLICATION
-- Enable live broadcast sync across all inventory tables
-- ============================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table stock_entries, reorder_requests, vendors, products, product_visibility, announcements, announcement_reads;
  end if;
exception
  when others then null; -- ignore if already added or publication missing
end $$;

-- ============================================================
-- SAMPLE DATA CATALOG
-- Seed sample products to populate the catalog
-- ============================================================
insert into products (name, sku, category, low_stock_threshold) values
  ('Omega-3 Krill Oil 60caps', 'CF-OMG-060', 'Supplements', 15),
  ('Multivitamin Daily 30tabs', 'CF-MVD-030', 'Supplements', 20),
  ('Ashwagandha 500mg 60caps', 'CF-ASH-060', 'Supplements', 15)
on conflict (sku) do nothing;
