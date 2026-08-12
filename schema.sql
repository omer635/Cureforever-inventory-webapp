-- ============================================================
-- CureForever Inventory Management System — Complete Database Schema
-- Run this in Supabase: Dashboard → SQL Editor → New query → Run
-- (Idempotent: safe to re-run after upgrades)
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

-- Ensure new columns exist if vendors already existed from an earlier setup
alter table vendors add column if not exists email text;
alter table vendors add column if not exists address text;
alter table vendors add column if not exists phone text;

create table if not exists product_visibility (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references vendors(id) on delete cascade,
  product_id uuid references products(id) on delete cascade
);

-- vendor_product_visibility was a duplicate shadow table from an earlier migration that
-- never got cleaned up; product_visibility is the one and only source of truth now.
drop table if exists vendor_product_visibility;

-- 2. PRODUCTS TABLE
-- Master product list with financial pricing and barcode metadata. Shared across all vendors.
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique not null,
  category text,
  low_stock_threshold integer not null default 10,
  cost_price numeric(10,2) not null default 0.00,
  selling_price numeric(10,2) not null default 0.00,
  barcode text,
  created_at timestamptz not null default now()
);

-- Ensure new columns are safely added if the products table already existed from an earlier setup
alter table products add column if not exists cost_price numeric(10,2) not null default 0.00;
alter table products add column if not exists selling_price numeric(10,2) not null default 0.00;
alter table products add column if not exists barcode text;
alter table products add column if not exists reorder_threshold integer not null default 25;
alter table products add column if not exists description text;

-- 3. PRODUCT BATCHES TABLE (Pharmaceutical & Compliance)
-- Multi-batch management with manufacturing/expiry dates and recall flags.
create table if not exists product_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  vendor_id uuid references vendors(id) on delete cascade,
  batch_number text not null,
  mfg_date date,
  received_date date,
  expiry_date date not null,
  quantity integer not null default 0,
  rate numeric(10,2) not null default 0.00,
  cost_price numeric(10,2) not null default 0.00,
  selling_price numeric(10,2) not null default 0.00,
  initial_quantity integer not null default 0,
  status text not null default 'active', -- 'active', 'recalled', 'quarantined', 'expired'
  notes text,
  created_at timestamptz not null default now(),
  unique (product_id, batch_number)
);

-- Ensure new columns exist if product_batches already existed from an earlier setup
alter table product_batches add column if not exists supplier text;
alter table product_batches add column if not exists vendor_id uuid references vendors(id) on delete cascade;
alter table product_batches add column if not exists received_date date;
alter table product_batches add column if not exists quantity integer not null default 0;
alter table product_batches add column if not exists rate numeric(10,2) not null default 0.00;

-- 4. STOCK ENTRIES TABLE
-- Real-time quantity, batch reference, expiry dates, reason code, and notes per (vendor, product).
create table if not exists stock_entries (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  batch_id uuid references product_batches(id) on delete set null,
  quantity integer not null default 0,
  expiry_date date,
  reason_code text not null default 'manual_adjustment',
  notes text,
  updated_at timestamptz not null default now(),
  last_updated timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (vendor_id, product_id)
);

-- Ensure new columns exist if stock_entries already existed from an earlier setup
alter table stock_entries add column if not exists batch_id uuid references product_batches(id) on delete set null;
alter table stock_entries add column if not exists reason_code text not null default 'manual_adjustment';
alter table stock_entries add column if not exists updated_at timestamptz not null default now();

-- 5. STOCK HISTORY TABLE
-- Tracks historical quantity updates over time for line chart visualization.
create table if not exists stock_history (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity integer not null,
  recorded_at timestamptz not null default now()
);

-- 6. STOCK ADJUSTMENTS AUDIT TABLE (Financial Control & Audit Integrity)
-- Immutable log of stock level modifications with reason codes and user attribution.
create table if not exists stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  stock_entry_id uuid references stock_entries(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  batch_id uuid references product_batches(id) on delete set null,
  previous_qty integer not null default 0,
  new_qty integer not null default 0,
  change_qty integer not null default 0,
  reason_code text not null default 'manual_adjustment', -- 'physical_reconciliation', 'damaged_goods', 'expired_disposal', 'qc_sample', 'return_to_vendor', 'manual_adjustment', 'initial_stock'
  notes text,
  performed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 7. REORDER REQUESTS TABLE
-- Stock reorder requests submitted by vendors and managed by admin.
create table if not exists reorder_requests (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  batch_id uuid references product_batches(id) on delete set null,
  requested_qty integer not null default 1,
  note text,
  status text not null default 'pending', -- pending, fulfilled, cancelled
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table reorder_requests add column if not exists batch_id uuid references product_batches(id) on delete set null;

-- 8. PRODUCT VISIBILITY TABLE
-- Maps products to specific vendors (when empty/absent, product is visible to all vendors).
create table if not exists product_visibility (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  unique (product_id, vendor_id)
);

-- The table may already exist from the earlier (pre-products-table) create block above
-- without this unique constraint, in which case the "unique" clause here is a no-op —
-- add it as an index instead so it's actually enforced either way.
create unique index if not exists product_visibility_product_vendor_uq on product_visibility (product_id, vendor_id);

-- 9. ANNOUNCEMENTS TABLE
-- Broadcast announcements sent by admin to all vendors.
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  is_active boolean not null default true,
  is_blocking boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table announcements add column if not exists is_blocking boolean not null default false;

-- 10. ANNOUNCEMENT READS TABLE
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

-- Record history point automatically whenever stock QUANTITY is inserted or updated
-- (notes/expiry-only edits do not pollute the history chart)
create or replace function record_stock_history()
returns trigger as $$
begin
  if (TG_OP = 'UPDATE' and old.quantity = new.quantity) then
    return new;
  end if;
  insert into stock_history (vendor_id, product_id, quantity)
  values (new.vendor_id, new.product_id, new.quantity);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_stock_history on stock_entries;
create trigger trg_stock_history
after insert or update on stock_entries
for each row execute function record_stock_history();

-- Record audit adjustment entry whenever stock quantity, expiry, or reason code changes.
-- FIX: reason_code is taken from the stock_entries.reason_code column (selected in the UI),
-- and notes are stored in the notes column — no longer mixed together.
create or replace function record_stock_adjustment()
returns trigger as $$
declare
  old_q integer := 0;
  new_q integer := 0;
  diff integer := 0;
  adv text;
begin
  if (TG_OP = 'UPDATE') then
    old_q := old.quantity;
    new_q := new.quantity;
    diff := new_q - old_q;
    if (diff <> 0 or old.expiry_date is distinct from new.expiry_date
        or old.reason_code is distinct from new.reason_code) then
      adv := coalesce(nullif(new.reason_code, ''), 'manual_adjustment');
      insert into stock_adjustments (
        stock_entry_id, vendor_id, product_id, batch_id,
        previous_qty, new_qty, change_qty, reason_code, notes, performed_by
      ) values (
        new.id, new.vendor_id, new.product_id, new.batch_id,
        old_q, new_q, diff, adv, new.notes, auth.uid()
      );
    end if;
  elsif (TG_OP = 'INSERT') then
    new_q := new.quantity;
    adv := coalesce(nullif(new.reason_code, ''), 'initial_stock');
    if (new_q > 0) then
      insert into stock_adjustments (
        stock_entry_id, vendor_id, product_id, batch_id,
        previous_qty, new_qty, change_qty, reason_code, notes, performed_by
      ) values (
        new.id, new.vendor_id, new.product_id, new.batch_id,
        0, new_q, new_q, adv, new.notes, auth.uid()
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_stock_adjustment on stock_entries;
create trigger trg_stock_adjustment
after insert or update on stock_entries
for each row execute function record_stock_adjustment();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table vendors enable row level security;
alter table products enable row level security;
alter table product_batches enable row level security;
alter table stock_entries enable row level security;
alter table stock_history enable row level security;
alter table stock_adjustments enable row level security;
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

-- Vendors may update their own profile row (name, state, phone) — never delete or change is_admin
drop policy if exists "vendors_self_update" on vendors;
create policy "vendors_self_update" on vendors for update using (id = my_vendor_id()) with check (id = my_vendor_id() and is_admin = false);

-- --- products table policies ---
drop policy if exists "products_select_all" on products;
create policy "products_select_all" on products for select using (true);

drop policy if exists "products_admin_write" on products;
create policy "products_admin_write" on products for all using (is_admin()) with check (is_admin());

-- --- product_batches table policies ---
drop policy if exists "batches_select_all" on product_batches;
create policy "batches_select_all" on product_batches for select using (true);

drop policy if exists "batches_admin_write" on product_batches;
create policy "batches_admin_write" on product_batches for all using (is_admin()) with check (is_admin());

-- Vendors may receive stock themselves (create a batch for their own vendor_id) — editing,
-- recalling, or quarantining an existing batch remains admin-only via batches_admin_write above.
drop policy if exists "batches_vendor_insert" on product_batches;
create policy "batches_vendor_insert" on product_batches for insert with check (is_admin() or vendor_id = my_vendor_id());

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

-- --- stock_adjustments table policies ---
drop policy if exists "adjustments_select" on stock_adjustments;
create policy "adjustments_select" on stock_adjustments for select using (is_admin() or vendor_id = my_vendor_id());

drop policy if exists "adjustments_insert" on stock_adjustments;
create policy "adjustments_insert" on stock_adjustments for insert with check (is_admin() or vendor_id = my_vendor_id());

-- --- reorder_requests table policies ---
drop policy if exists "reorder_select" on reorder_requests;
create policy "reorder_select" on reorder_requests for select using (is_admin() or vendor_id = my_vendor_id());

drop policy if exists "reorder_insert" on reorder_requests;
create policy "reorder_insert" on reorder_requests for insert with check (is_admin() or vendor_id = my_vendor_id());

-- Admins can update/fulfil/cancel anything; vendors may only cancel their own pending requests
drop policy if exists "reorder_update" on reorder_requests;
create policy "reorder_update" on reorder_requests for update using (is_admin() or vendor_id = my_vendor_id())
  with check (is_admin() or (vendor_id = my_vendor_id() and status = 'cancelled'));

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
    alter publication supabase_realtime add table stock_entries, reorder_requests, vendors, products, product_batches, stock_adjustments, product_visibility, announcements, announcement_reads;
  end if;
exception
  when others then null; -- ignore if already added or publication missing
end $$;

-- purchase_orders / purchase_order_items / stock_transfers: the app already subscribes to
-- postgres_changes on these (AppProvider.tsx) but they were never added to the publication,
-- so those subscriptions silently received nothing.
-- Checks membership per-table via pg_publication_tables instead of a blanket try/catch —
-- "when others then null" would silently hide a real failure (wrong privileges, typo, etc.)
-- exactly the way that happened before: this block looked like it succeeded but admin never
-- received live purchase_orders updates because the swallowed exception hid the real error.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'purchase_orders') then
      alter publication supabase_realtime add table purchase_orders;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'purchase_order_items') then
      alter publication supabase_realtime add table purchase_order_items;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stock_transfers') then
      alter publication supabase_realtime add table stock_transfers;
    end if;
  end if;
end $$;

-- ============================================================
-- SAMPLE DATA CATALOG & BATCHES
-- Seed sample products and batches
-- ============================================================
insert into products (name, sku, category, low_stock_threshold, cost_price, selling_price, barcode) values
  ('Omega-3 Krill Oil 60caps', 'CF-OMG-060', 'Supplements', 15, 12.50, 24.99, '8901234567890'),
  ('Multivitamin Daily 30tabs', 'CF-MVD-030', 'Supplements', 20, 5.00, 12.00, '8901234567891'),
  ('Ashwagandha 500mg 60caps', 'CF-ASH-060', 'Supplements', 15, 8.00, 18.50, '8901234567892')
on conflict (sku) do update set
  cost_price = excluded.cost_price,
  selling_price = excluded.selling_price,
  barcode = excluded.barcode;

insert into product_batches (product_id, batch_number, mfg_date, expiry_date, cost_price, selling_price, initial_quantity, status)
select id, 'BATCH-2026-A1', '2025-01-15', '2027-01-15', cost_price, selling_price, 500, 'active'
from products where sku = 'CF-OMG-060'
on conflict (product_id, batch_number) do nothing;

insert into product_batches (product_id, batch_number, mfg_date, expiry_date, cost_price, selling_price, initial_quantity, status)
select id, 'BATCH-2026-B2', '2025-03-01', '2026-09-01', cost_price, selling_price, 300, 'active'
from products where sku = 'CF-MVD-030'
on conflict (product_id, batch_number) do nothing;

-- Already-expired sample batch (auto-flagged by the app's expiry engine)
insert into product_batches (product_id, batch_number, mfg_date, expiry_date, cost_price, selling_price, initial_quantity, status)
select id, 'BATCH-2025-C3', '2024-06-01', '2026-01-01', cost_price, selling_price, 120, 'active'
from products where sku = 'CF-ASH-060'
on conflict (product_id, batch_number) do nothing;

-- ============================================================
-- 10. PURCHASE ORDERS TABLE & ITEMS
-- ============================================================
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text unique not null,
  supplier text not null,
  destination_vendor_id uuid references vendors(id) on delete set null,
  status text not null default 'draft', -- draft, sent, partially_received, fulfilled, cancelled
  notes text,
  expected_delivery date,
  created_at timestamptz not null default now()
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity_ordered integer not null default 1,
  quantity_received integer not null default 0,
  unit_cost numeric(10,2) not null default 0.00
);

-- ============================================================
-- 11. STOCK TRANSFERS TABLE (Multi-Warehouse / Vendor Stock Movement)
-- ============================================================
create table if not exists stock_transfers (
  id uuid primary key default gen_random_uuid(),
  source_vendor_id uuid not null references vendors(id) on delete cascade,
  target_vendor_id uuid not null references vendors(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  batch_id uuid references product_batches(id) on delete set null,
  quantity integer not null default 1,
  status text not null default 'pending', -- pending, approved, in_transit, completed, rejected
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table stock_transfers enable row level security;

-- Previously "using (true) with check (true)" — any authenticated vendor could read/write
-- every other vendor's purchase orders and transfers. Scoped to match the stock_entries
-- pattern: admin sees/writes everything, a vendor only their own.

drop policy if exists "po_all" on purchase_orders;
drop policy if exists "po_select" on purchase_orders;
create policy "po_select" on purchase_orders for select using (is_admin() or destination_vendor_id = my_vendor_id());

drop policy if exists "po_insert" on purchase_orders;
create policy "po_insert" on purchase_orders for insert with check (is_admin() or destination_vendor_id = my_vendor_id());

-- Was admin-only — every vendor Accept/Reject/Request-Revision action silently updated
-- zero rows (RLS filters the row out; Supabase's .update() doesn't error on that, it just
-- no-ops), so those buttons never actually changed anything. Vendors may update only their
-- own destination PO, and only into the three statuses their UI actually exposes — every
-- other transition (sent, partially_received, fulfilled, cancelled, etc.) stays admin-only.
drop policy if exists "po_update" on purchase_orders;
create policy "po_update" on purchase_orders for update
  using (is_admin() or destination_vendor_id = my_vendor_id())
  with check (is_admin() or (destination_vendor_id = my_vendor_id() and status in ('accepted', 'rejected', 'revision_requested')));

drop policy if exists "po_delete" on purchase_orders;
create policy "po_delete" on purchase_orders for delete using (is_admin());

drop policy if exists "po_items_all" on purchase_order_items;
drop policy if exists "po_items_select" on purchase_order_items;
create policy "po_items_select" on purchase_order_items for select using (
  is_admin() or exists (select 1 from purchase_orders po where po.id = purchase_order_items.po_id and po.destination_vendor_id = my_vendor_id())
);

drop policy if exists "po_items_insert" on purchase_order_items;
create policy "po_items_insert" on purchase_order_items for insert with check (
  is_admin() or exists (select 1 from purchase_orders po where po.id = purchase_order_items.po_id and po.destination_vendor_id = my_vendor_id())
);

drop policy if exists "po_items_write" on purchase_order_items;
create policy "po_items_write" on purchase_order_items for update using (is_admin()) with check (is_admin());

drop policy if exists "po_items_delete" on purchase_order_items;
create policy "po_items_delete" on purchase_order_items for delete using (is_admin());

drop policy if exists "transfers_all" on stock_transfers;
drop policy if exists "transfers_select" on stock_transfers;
create policy "transfers_select" on stock_transfers for select using (
  is_admin() or source_vendor_id = my_vendor_id() or target_vendor_id = my_vendor_id()
);

drop policy if exists "transfers_insert" on stock_transfers;
create policy "transfers_insert" on stock_transfers for insert with check (
  is_admin() or source_vendor_id = my_vendor_id() or target_vendor_id = my_vendor_id()
);

drop policy if exists "transfers_update" on stock_transfers;
create policy "transfers_update" on stock_transfers for update using (is_admin()) with check (is_admin());

drop policy if exists "transfers_delete" on stock_transfers;
create policy "transfers_delete" on stock_transfers for delete using (is_admin());

-- ─── NOTIFICATIONS ──────────────────────────────────────────────────────────
create table if not exists notifications (
  id            uuid default gen_random_uuid() primary key,
  vendor_id     uuid references vendors(id) on delete cascade,  -- NULL = admin-targeted
  title         text not null,
  message       text not null,
  module        text not null,        -- 'purchase_orders','transfers','announcements','stock','batches'
  module_ref_id text,                 -- optional reference to the specific record (PO id, transfer id, etc.)
  is_read       boolean default false,
  created_at    timestamptz default now()
);

alter table notifications enable row level security;

drop policy if exists "notifications_select" on notifications;
create policy "notifications_select" on notifications for select using (
  is_admin() and vendor_id is null      -- admins see admin notifications
  or vendor_id = my_vendor_id()         -- vendors see their own
);

drop policy if exists "notifications_insert" on notifications;
create policy "notifications_insert" on notifications for insert with check (true);

drop policy if exists "notifications_update" on notifications;
create policy "notifications_update" on notifications for update using (
  is_admin() and vendor_id is null
  or vendor_id = my_vendor_id()
);

drop policy if exists "notifications_delete" on notifications;
create policy "notifications_delete" on notifications for delete using (is_admin());