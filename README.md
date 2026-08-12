# CureForever — Enterprise Inventory & Supply Chain Management Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.3-000000?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployment-000000?style=for-the-badge&logo=vercel)](https://cureforever-inventory-webapp.vercel.app)

**CureForever** is a high-performance, real-time enterprise inventory management, multi-warehouse logistics, and AI-driven forecasting platform engineered for pharmaceutical and wellness supply chains.

---

## 🌟 Key Platform Capabilities

- **📊 Executive Master Dashboard**: Real-time KPI summary cards, Category Valuation Doughnut Chart, Top 5 SKUs Leaderboard, 14-Day Velocity Trend, and live Depletion Alerts.
- **⚡ Real-Time Multi-Location Synchronization**: Powered by Supabase Postgres Realtime channels (`live-vendor-stock-sync`). Stock adjustments made anywhere in the world instantly sync across all connected vendor and admin screens.
- **📈 AI Demand Forecasting & Velocity**: Predicts exact stock runout days per SKU using historical movement rates, and calculates Economic Order Quantities (EOQ).
- **📑 Full Procurement Lifecycle**: Create, track, and receive Purchase Orders (POs) directly into active product batches.
- **🚚 Inter-Warehouse Stock Transfers**: Coordinate stock transfers between store locations with chain-of-custody tracking.
- **💰 Financial Valuation Models**: Evaluate inventory under **Weighted Average**, **FIFO**, and **LIFO** models with instant multi-currency conversion (`USD`, `EUR`, `GBP`, `INR`, `CAD`).
- **🧪 FEFO Expiry & Quarantine Compliance**: First-Expired, First-Out (FEFO) recommendation badges, 4-tier expiry timeline filters (0–30d, 31–60d, 61–90d, >90d), and one-click batch quarantine toggles.
- **🏷️ Printable Barcode & QR Label Studio**: Generate Code128 and 2D QR Code labels in single sticker, 30-up sheet, or shelf-edge price tag formats with single-page print isolation.
- **🔍 Spotlight Command Palette (`Ctrl+K`)**: Instant search across products, SKUs, batches, and vendors with one-key quick actions.
- **📥 Bulk Data Import Wizard**: Schema-validated bulk import for CSV and JSON datasets with live error checking.
- **📲 Barcode & QR Camera Scanner**: Integrated web camera scanner for instant SKU lookup and stock auditing.
- **🌐 Offline-First Resilience**: Local caching and background queue automatically re-sync changes when network connection is restored.

---

## 🚀 Tech Stack

- **Framework**: Next.js 16.3 (App Router with Turbopack)
- **Database & Auth**: Supabase PostgreSQL + Realtime Channels + Row Level Security (RLS)
- **Styling**: Vanilla CSS Design Tokens (Custom dark navy `#0F1F3D` and gold `#B8935A` palette)
- **Data Visualization**: Chart.js 4.5
- **Languages**: TypeScript 5.0

---

## 📂 Project Structure

```
inventory_app/
├── app/
│   ├── favicon.ico / icon.png / logo.png   # Brand emblem icons
│   ├── globals.css                          # Core CSS design system & print styles
│   ├── layout.tsx                           # Root layout & font configurations
│   └── page.tsx                             # Authentication & AppShell gate
├── components/
│   ├── AppProvider.tsx                      # Global state & real-time sync channel
│   ├── AppShell.tsx                         # Side navbar navigation shell
│   ├── LoginScreen.tsx                      # User authentication interface
│   ├── ModalHost.tsx                        # Global modal overlay container
│   ├── VendorDashboard.tsx                  # Dedicated Vendor store interface
│   ├── modals/                              # 10 Enterprise modal dialogs
│   │   ├── CommandPaletteModal.tsx          # Ctrl+K spotlight search
│   │   ├── DataImportModal.tsx              # CSV / JSON import wizard
│   │   ├── LabelStudioModal.tsx             # Code128 & QR label printing
│   │   ├── ProductModal.tsx                 # Product record creation/edit/delete
│   │   ├── PurchaseOrderModal.tsx           # PO creation & item receiving
│   │   ├── TransferModal.tsx                # Stock transfer management
│   │   └── VendorFormModal.tsx              # Vendor account management
│   └── tabs/                                # 11 Admin Module Views
│       ├── AdminDashboard.tsx               # Master executive dashboard
│       ├── AdminAnalytics.tsx               # AI forecasting & EOQ
│       ├── AdminAllStock.tsx                # Live inventory table
│       ├── AdminProducts.tsx                # Product master catalog
│       ├── AdminBatches.tsx                 # FEFO expiry & quarantine
│       ├── AdminPurchaseOrders.tsx          # Purchase Order management
│       ├── AdminTransfers.tsx               # Multi-location transfers
│       ├── AdminFinancials.tsx              # Financial valuation & currencies
│       ├── AdminAuditLogs.tsx               # Immutable audit log trail
│       ├── AdminVendors.tsx                 # Vendor locations & store stock
│       └── AdminAnnouncements.tsx           # System broadcasts
├── lib/
│   ├── db.ts                                # Supabase database queries & fallbacks
│   ├── supabase.ts                          # Supabase client singleton
│   ├── types.ts                             # TypeScript interface definitions
│   └── utils.ts                             # Math, formatting, and text sanitizers
└── schema.sql                               # PostgreSQL DDL script
```

---

## 🛠️ Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/omer635/Cureforever-inventory-webapp.git
   cd inventory_app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://uchozkkzgqeismqvamye.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Initialize Database Schema**:
   Run the contents of [`schema.sql`](file:///c:/Users/new/Documents/Omer_DLS_Files/inventory_app/schema.sql) in your **Supabase SQL Editor**.

5. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

## 📄 Documentation & User Guide

For a detailed walkthrough of all 11 modules, functions, and real-world examples, read the [User Guide (`USER_GUIDE.md`)](file:///c:/Users/new/Documents/Omer_DLS_Files/inventory_app/USER_GUIDE.md).
