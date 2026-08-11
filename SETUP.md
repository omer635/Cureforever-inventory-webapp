# CureForever Inventory System — Setup & Architecture Guide

Core platform files:
- `schema.sql` — relational database tables, triggers, history & audit tracking, Row-Level Security (RLS), and Supabase Realtime broadcast configuration.
- `app/`, `components/`, `lib/` — Next.js (App Router, TypeScript) enterprise web app: admin dashboard, vendor tabs, barcode scanner, batch compliance, valuation, audit logs, offline sync queue.
- `legacy/` — the previous single-file static app (`index.html`, `sw.js`, `manifest.json`) kept for reference; the app is now served by Next.js.

---

## Quick Start (Supabase + Next.js)

1. Create a Supabase project. Go to **Dashboard → Authentication → Providers → Email** and **turn OFF "Confirm email"** so vendor logins created in-app work instantly.
2. Run `schema.sql` in **Dashboard → SQL Editor → New query → Run** (idempotent; safe to re-run).
3. Credentials live in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://uchozkkzgqeismqvamye.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
4. Run locally:
   ```
   npm install
   npm run dev        # http://localhost:3000
   npm run build      # production build
   npm start
   ```
5. Create your first **admin** login manually in Supabase (**Authentication → Users → Add user** with a password), then insert a matching row into the `vendors` table with `is_admin = true` and `user_id` set to that auth user's UUID. Sign in as admin.
6. From the admin header, use **+ Add Vendor** to provision vendor accounts.

### Re-running schema.sql after upgrades
`schema.sql` is re-runnable: `create table if not exists`, `add column if not exists`, and `drop policy if exists` keep your data intact while applying fixes (e.g. the `reason_code` audit fix, `reorder_threshold`, `supplier`, `email`, `is_blocking` columns).

---

## Architecture

- **Next.js 16 App Router, client-side SPA session** — `app/page.tsx` gates on a Supabase session and mounts the app shell.
- **State**: `components/AppProvider.tsx` — single provider holding session, all tables (products, batches, vendors, stock entries/history/adjustments, reorders, visibility, announcements), online/offline state, offline op queue, modals, and toasts.
- **Data layer**: `lib/db.ts` — parameterized Supabase queries via `supabase-js` (bundled, no CDNs); `lib/supabase.ts` — browser client singleton.
- **Offline**: `localStorage` cache (`cf_cache_v2`) + op queue (`cf_offline_ops_v2`) with types `stock_upsert` / `reorder` / `announcement_read`; auto-flush on reconnect and after login.
- **Charts**: `chart.js` (canvas refs); **Excel export**: `exceljs`; **CSV export**: own UTF-8 BOM writer; **Scanner**: `html5-qrcode` dynamically imported only when the scan modal opens.
- **Visibility model**: `product_visibility` rows = whitelist; no rows = visible to all. `isProductVisible(productId, vendorId)`.
- **Stock status**: out (`qty <= 0`), low (`qty <= low_stock_threshold`), else in.
- **Batch status**: `recalled` from `status = 'recalled'`; `expired` from expiry date; `expiring soon` ≤ 30 days.

## Verification

```
npm run lint      # eslint — 0 errors
npm run build     # production build + TypeScript check
```

## Troubleshooting

- **Blank page at build/runtime**: the app renders client-side; open DevTools console for errors. `npm run dev` surfaces errors with hot reload.
- **Login fails**: confirm "Confirm email" is OFF, and the user's email matches a `vendors.email` / `vendors.user_id` row.
- **Missing columns after schema change**: re-run `schema.sql`.