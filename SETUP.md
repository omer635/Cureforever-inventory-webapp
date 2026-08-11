# CureForever Inventory System — Complete Setup & Enterprise Architecture Guide

Core platform files:
- `schema.sql` — relational database tables, triggers, history & audit tracking, Row-Level Security (RLS), and Supabase Realtime broadcast configuration.
- `index.html` — enterprise single-page web app with Admin Vendor Creation, Dedicated Vendor Tabs, Barcode Scanner, Batch Compliance, Valuation Engine, Audit Logs, Offline Sync Queue, and Realtime Sync.
- `sw.js` — Progressive Web App (PWA) Service Worker enabling offline caching & background sync.
- `manifest.json` — PWA Web App Manifest for mobile/desktop standalone app installation.

---

## Quick Start (Supabase)

1. Create a Supabase project. Go to **Dashboard → Authentication → Providers → Email** and **turn OFF "Confirm email"** so vendor logins created in-app work instantly.
2. Authenticate (table editor access) and run `schema.sql` in **Dashboard → SQL Editor → New query → Run** (idempotent; safe to re-run).
3. The schema creates an RLS policy set, so counter-intuitively you must **turn RLS ON via the file itself** (it runs `alter table ... enable row level security`); no manual toggling needed.
4. Edit the `SUPABASE_URL` and `SUPABASE_ANON_KEY` constants at the top of the `<script>` in `index.html` with your project values.
5. Serve the folder with any static host (e.g. `npx serve .`).
6. Create your first **admin** login manually in Supabase (**Authentication → Users → Add user** with a password), then insert a matching row into the `vendors` table with `is_admin = true` and `user_id` set to that auth user's UUID. Sign in as admin.
7. From the admin header, use **+ Add Vendor Account** to provision vendor logins (email + temporary password) — the vendor profile row and login are created automatically.

### Re-running schema.sql after upgrades
`schema.sql` is written to be re-runnable: `create table if not exists`, `add column if not exists`, and `drop policy if exists` keep your data intact while applying fixes (e.g. the `reason_code` audit fix, `reorder_threshold`, `supplier`, `email`, `is_blocking` columns).

---

## Enterprise Features & Dashboard Architecture

### 1. 🏢 Admin Dashboard, Vendor Creation & Dedicated Vendor Tabs
- **Zero-Manual Supabase Setup**: Admins can create new vendor accounts directly from the web app interface by clicking **+ Add Vendor Account**.
- **Secure Auth Provisioning**: Uses an un-persisted auth client to create the vendor's login email & temporary password without interrupting the Admin's active session.
- **Dedicated Vendor Sub-Tabs**:
  - In **🏢 Vendors Management**, every vendor gets their own dedicated tab pill.
  - Clicking a vendor tab opens their isolated portal: dedicated KPI cards, editable inventory table, vendor reorder requests, vendor audit history logs, and CSV export.
  - Admins can **edit** vendor business details or **delete** access (stock lines and audit history remain in the immutable log; the Supabase Auth user itself is removed from Dashboard → Authentication → Users).
- A **📊 Master Dashboard** remains available to view global metrics across all vendors combined.

### 2. 📊 Master Dashboard (Admin)
- Global KPI cards: vendors, stock lines, total units, estimated stock value.
- **Pending Reorder Requests** queue with one-click Fulfill / Cancel.
- **Low Stock Across States** grid (CSV export).
- **Expiring / Expired Batches** watchlist (auto-flagged by the expiry engine).
- Live charts (Chart.js): Low Stock by Vendor (bar), Batch Expiry Distribution (doughnut), Stock Trend — last 14 days (line, from `stock_history`), and Top Products by Value (bar).
- **Recent Stock Adjustments** feed from the immutable audit log.

### 3. 📷 Hardware Barcode & QR Code Scanner
- Click **📷 Scan Barcode** in the top bar (available to both admin and vendors) to launch the camera viewfinder.
- Automatically matches SKU, Barcode, or Batch QR codes to filter inventory or jump to the matching product/batch.

### 4. 💊 Pharmaceutical & Batch Compliance
- Track manufacturing date, supplier, batch numbers, and batch expiry per product.
- **Batch Management** tab (admin): create batches, edit details, link an unused batch to a specific vendor's unlinked stock line, and permanently delete unlinked batches.
- **1-Click Batch Recall / Restore**: recalls flag the lot as `recalled`; recalled batches are surfaced as risk items and cannot be newly linked.
- **Auto-Expiry Engine**: batches whose expiry date has passed are automatically flagged `expired`; expiry is also shown inline with days-left and color-coded status on every table.

### 5. 💰 Financial Control & Audit Integrity
- Real-time **Estimated Stock Value** per line, vendor, and global (selling-price based).
- **Financials tab**: full Audit Trail with vendor + reason filters, printable report, and CSV/Excel exports.
- **Immutable Audit Trail**: every stock change records timestamp, user UID, before/after delta, and a reason code chosen in-app (`Physical Reconciliation`, `Damaged Goods`, `Expired Disposal`, `QC Sample`, `Restock Return`, `Manual Adjustment`) — fixes the earlier bug where the reason was stored in `notes`.

### 6. 📦 Stock Editing & Reorders
- Every stock row has an editable **Quantity**, **Adjustment Reason** dropdown, **Batch** link, **Expiry Date**, and **Audit Notes**. Pressing **Save** (or Enter) triggers a triggered audit entry + history point.
- **Request Reorder** opens a smart modal with a suggested quantity (2× reorder threshold − current stock) and latest batch on file; pending-request dedup prevents duplicates.
- Vendors can **cancel own pending reorder requests**; admins can fulfill/cancel any request (RLS-enforced).

### 7. 📁 Products & Visibility
- **Products tab** (admin): add / edit / delete products with SKU, category, selling price, low-stock & reorder thresholds, description.
- **Visibility whitelist**: restrict a product to specific vendor accounts, or allow all. Restricted products disappear from the other vendors' stock tables without losing history.

### 8. 📢 Announcements & Alerts Center
- Admin broadcasts announcements as **Urgent/Blocking** (red banner for all vendors) or **Informational**; per-vendor read receipts are tracked and counted.
- Admin can archive (toggle), reactivate, or delete announcements.
- **🔔 Alerts** bell (both roles) shows pending reorders, low-stock lines, and unread announcements in one notification center.

### 9. 📱 Offline PWA Capabilities & Offline Sync Queue
- Progressive Web App with Service Worker (`sw.js`, cache v2).
- Network status pill (`🟢 Online` / `🔴 Offline`) indicates live connection and local cache mode.
- **True offline support**: on first load, all master data is cached in `localStorage`; when offline, stock edits, reorder requests, and announcement reads are queued and **auto-flushed** (with a sync toast) when the connection returns. The UI shows last-synced data with an offline banner.
- Realtime subscription keeps every open dashboard live-synced across devices; network drop/flakiness is handled gracefully.

### 10. 📤 Exports & Reports
- **CSV** export of All Stock (with valuation column), per-vendor audit logs, low-stock report, and the full audit trail.
- **Excel (XLSX)** export of the entire stock table (client-side SheetJS).
- **🖨 Print** produces a systems-generated inventory report with signature blocks.

### 11. 👤 Profiles
- Vendors and admin can edit their own business profile (name, state, phone) and change their login password from **👤 Profile** — self-update permitted by a dedicated RLS policy without ever touching `is_admin`.

---

## Security Model
- **Row Level Security** on every table; helper functions `is_admin()` and `my_vendor_id()` gate all access.
- Vendors can only read/write their own stock, history, and adjustments; they can only cancel their own pending reorders; they can never modify products, batches, visibility, or announcements.
- Admin-only write policies on products, batches, visibility, and announcements.
- Email/password auth via Supabase Auth; session tokens held in Supabase's in-memory client.

## Troubleshooting
- **Vendor login says "Email not confirmed"** → Disable "Confirm email" under Authentication → Providers → Email (already done? re-check when creating new users).
- **Audit entries show wrong reasons** → Re-run `schema.sql`; the trigger `record_stock_adjustment()` now reads `reason_code` from the column (not `notes`).
- **Realtime not updating** → Confirm `schema.sql` publication block ran; re-run the file; check browser console for channel errors.
- **Charts blank on offline cache** → Trend chart needs `stock_history` rows; they appear after the first stock edit.