# CureForever Inventory System — Complete Setup & Architecture Guide

Two core files drive the entire application:
- `schema.sql` — database tables, triggers, history tracking, Row-Level Security (RLS), and Supabase Realtime broadcast configuration
- `index.html` — single-page application (authentication, vendor state portal, admin dashboard with analytics & live charts)

Takes about 10–15 minutes to set up.

---

## Architecture Overview & Database Tables

`schema.sql` sets up 8 relational tables protected by Row-Level Security:

1. `vendors` — 1:1 map to Supabase Auth users, tracks state assignments and admin privileges.
2. `products` — master SKU catalog with default low-stock thresholds.
3. `stock_entries` — real-time quantity, expiry dates, and notes per (vendor, product) pair.
4. `stock_history` — automated audit trail recording quantity over time for trend line charts.
5. `reorder_requests` — reorder workflow allowing vendors to request stock top-ups and admins to fulfill them.
6. `product_visibility` — per-product state/vendor visibility permissions (defaults to open for all vendors when unset).
7. `announcements` — broadcast notification system from admin to vendors.
8. `announcement_reads` — per-vendor read/dismiss tracking for announcements.

---

## Step 1 — Create your Supabase project

1. Go to [https://supabase.com](https://supabase.com) and sign in or create a free account.
2. Click **New project**.
3. Name it `cureforever-inventory`, select the region closest to your operations (e.g. Singapore / South Asia), and set a secure database password.
4. Wait ~2 minutes for project provisioning.

## Step 2 — Run the schema

1. In your Supabase project dashboard, open **SQL Editor** from the left sidebar.
2. Click **New query**.
3. Copy and paste the entire content of `schema.sql` and click **Run**.
4. You should see "Success. No rows returned". This creates all 8 tables, database triggers, RLS security policies, Realtime publications, and 3 sample products.

## Step 3 — Retrieve API keys

1. Navigate to **Project Settings → API** in Supabase.
2. Copy the **Project URL** and the **anon public** key.
3. Open `index.html` and locate the config section near line 150:
   ```javascript
   const SUPABASE_URL = "YOUR_SUPABASE_URL";
   const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
   ```
4. Replace the placeholder values with your actual project credentials.

## Step 4 — Create user authentication accounts

1. Go to **Authentication → Users → Add user** (create manually).
2. Create one login for yourself (admin) and one for each vendor (email + password).
3. Copy the **User UID** for each user from the users table list.

## Step 5 — Link authentication logins to Vendor profiles

In **SQL Editor**, run insert statements to link each Auth UID to a vendor profile:

```sql
-- Admin profile (sees all states and admin tabs)
insert into vendors (user_id, name, state, is_admin)
values ('PASTE-YOUR-ADMIN-USER-UID', 'Omer (Admin)', 'All States', true);

-- Vendor profiles (restricted by state)
insert into vendors (user_id, name, state, contact_phone)
values ('PASTE-VENDOR-1-USER-UID', 'Telangana Pharma', 'Telangana', '9876543210');

insert into vendors (user_id, name, state, contact_phone)
values ('PASTE-VENDOR-2-USER-UID', 'Karnataka Meds', 'Karnataka', '9876543211');
```

## Step 6 — Catalog Management & Excel Bulk Import

You can manage your catalog in two ways:

1. **Excel Bulk Import**: Log in as Admin, navigate to **Products → ⬆ Bulk import (Excel)**, and upload your `.xlsx` catalog file.
2. **SQL Seed**: Clear samples and insert directly via SQL Editor:
   ```sql
   delete from products; -- optional: clear samples

   insert into products (name, sku, category, low_stock_threshold) values
     ('Omega-3 Krill Oil 60caps', 'CF-OMG-060', 'Supplements', 15),
     ('Ashwagandha 500mg 60caps', 'CF-ASH-060', 'Supplements', 15);
   ```

## Step 7 — Deploy `index.html`

1. Upload `index.html` to GitHub Pages or any static web host (Netlify, Vercel, Cloudflare Pages).
2. For GitHub Pages: Go to repository **Settings → Pages**, set branch to `main`, and save.
3. Share the live site URL with your vendors alongside their login credentials.

---

## Application Capabilities & Day-to-Day Operations

- **Vendor View**:
  - Automatically restricted to assigned state products via Row-Level Security.
  - Quick quantity & expiry updates with notes.
  - Reorder request button on low-stock items.
  - Expiry status flags (`Low stock`, `Expired`, `≤30d to expiry`).
  - History modal displaying past quantity trends.
  - Announcement banner with instant dismissal.

- **Admin View**:
  - **Dashboard**: High-level KPIs, pending reorder requests approval workflow, low-stock charts, expiry distribution doughnut chart, category unit bar chart, recent activity feed.
  - **By Vendor**: State-by-state tabbed inventory view with inline stock editing.
  - **All Stock**: Global search, state filtering, sorting, low-stock/expiring chips, and single-click CSV export.
  - **Products**: Catalog management, manual product addition, Excel bulk import, and granular product-level vendor visibility controls.
  - **Announcements**: Broadcast message composition with live read-receipt counts per vendor.

- **Realtime Sync & Security**:
  - Multi-tab and multi-device live sync via Supabase WebSockets.
  - Complete database-enforced Row-Level Security (RLS). Vendors cannot inspect or edit other state data.
