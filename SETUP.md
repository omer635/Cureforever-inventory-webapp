# CureForever Inventory System — Complete Setup & Enterprise Architecture Guide

Core platform files:
- `schema.sql` — relational database tables, triggers, history & audit tracking, Row-Level Security (RLS), and Supabase Realtime broadcast configuration.
- `index.html` — enterprise single-page web app with Admin Vendor Creation, Dedicated Vendor Tabs, Barcode Scanner, Batch Recalls, Valuation Engine, Audit Logs, and Realtime Sync.
- `sw.js` — Progressive Web App (PWA) Service Worker enabling offline caching & background sync.
- `manifest.json` — PWA Web App Manifest for mobile/desktop standalone app installation.

---

## Enterprise Features & Dashboard Architecture

### 1. 🏢 Admin Dashboard Vendor Creation & Dedicated Vendor Tabs
- **Zero-Manual Supabase Setup**: Admins can create new vendor accounts directly from the web app interface by clicking **+ Add Vendor Account**.
- **Secure Auth Provisioning**: Uses an un-persisted auth client to create the vendor's login email & temporary password without interrupting the Admin's active session.
- **Dedicated Vendor Sub-Tabs**:
  - In **🏢 Vendors Management**, every vendor gets their own dedicated tab pill.
  - Clicking a vendor tab opens their isolated portal: dedicated KPI cards, editable inventory table, vendor reorder requests, and vendor audit history logs.
  - A **📊 Master Dashboard** remains available to view global metrics across all vendors combined.

### 2. 📷 Hardware Barcode & QR Code Scanner
- Click **📷 Scan Barcode** in the top bar to launch the camera viewfinder.
- Automatically matches SKU, Barcode, or Batch QR codes to filter inventory or trigger stock edits.

### 3. 💊 Pharmaceutical & Batch Compliance
- Track manufacturing date, batch numbers, and batch expiry.
- **1-Click Batch Recall**: Admins can recall any lot number, triggering instant warning banners across all vendor dashboards.

### 4. 💰 Financial Control & Audit Integrity
- Real-time **Inventory COGS Valuation**, Potential Retail Revenue, and Projected Margin %.
- **Immutable Audit Trail**: Every stock change records timestamp, user UID, before/after delta, and reason code (`Physical Reconciliation`, `Damaged Goods`, `Expired Disposal`, `QC Sample`).

### 5. 📱 Offline PWA Capabilities
- Progressive Web App with Service Worker (`sw.js`).
- Network status pill (`🟢 Online` / `🔴 Offline`) indicates live connection and local cache mode.
