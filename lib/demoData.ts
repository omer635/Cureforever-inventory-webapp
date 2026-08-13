import type {
  Announcement,
  AnnouncementRead,
  AppNotification,
  Product,
  ProductBatch,
  ProductVisibility,
  PurchaseOrder,
  ReorderRequest,
  StockAdjustment,
  StockEntry,
  StockHistory,
  StockTransfer,
  Vendor,
} from "./types";

export const DEMO_USER_EMAIL = "demo2026@cureforever.com";
export const DEMO_USER_PASS = "Cureforever@2026";
export const DEMO_ALT_EMAILS = ["demo@cureforever.com", "demo2026@cureforever.com", "demo@cureforever.in"];
export const DEMO_ALT_PASSES = ["demo123", "demo", "Cureforever@2026", "password"];
export const DEMO_STORAGE_KEY = "cureforever_demo_sandbox_v2";

export const DEMO_ADMIN_VENDOR: Vendor = {
  id: "demo-admin-hq",
  user_id: "demo-user-id",
  name: "CureForever Demo HQ Admin",
  is_admin: true,
  phone: "+91 9876543210",
  address: "Showcase HQ Tower, Tech City, Hyderabad, PIN: 500081, India",
  email: DEMO_USER_EMAIL,
  state: "HQ",
  contact_phone: "+91 9876543210",
  created_at: "2026-01-01T00:00:00Z",
};

export const DEMO_VENDORS: Vendor[] = [
  DEMO_ADMIN_VENDOR,
  {
    id: "demo-store-1",
    user_id: null,
    name: "Metro Central Pharmacy #1",
    is_admin: false,
    phone: "+91 9123456789",
    address: "Shop 14, Metro Mall, Dadar West, Mumbai, PIN: 400028, India",
    email: "metro1@cureforever.in",
    state: "Maharashtra",
    contact_phone: "+91 9123456789",
    created_at: "2026-01-05T00:00:00Z",
  },
  {
    id: "demo-store-2",
    user_id: null,
    name: "Express Care Meds #2",
    is_admin: false,
    phone: "+91 9811223344",
    address: "Plot 88, Connaught Place, New Delhi, PIN: 110001, India",
    email: "express2@cureforever.in",
    state: "Delhi",
    contact_phone: "+91 9811223344",
    created_at: "2026-01-10T00:00:00Z",
  },
  {
    id: "demo-store-3",
    user_id: null,
    name: "City Health Store #3",
    is_admin: false,
    phone: "+91 9440055667",
    address: "H.No 4-1-20, Banjara Hills Road 1, Hyderabad, PIN: 500034, India",
    email: "city3@cureforever.in",
    state: "Telangana",
    contact_phone: "+91 9440055667",
    created_at: "2026-01-15T00:00:00Z",
  },
];

export const DEMO_PRODUCTS: Product[] = [
  {
    id: "demo-p-1",
    name: "Amoxicillin Trihydrate 500mg Capsules",
    sku: "AMX-500",
    category: "Antibiotics",
    cost_price: 45,
    selling_price: 75,
    low_stock_threshold: 20,
    reorder_threshold: 15,
    created_at: "2026-01-01T00:00:00Z",
    barcode: "8901234567890",
    description: "Broad spectrum antibiotic capsules",
  },
  {
    id: "demo-p-2",
    name: "Paracetamol Extra 650mg Tablets",
    sku: "PCM-650",
    category: "Analgesics & Fever",
    cost_price: 12,
    selling_price: 25,
    low_stock_threshold: 30,
    reorder_threshold: 20,
    created_at: "2026-01-01T00:00:00Z",
    barcode: "8901234567891",
    description: "Fast action fever and pain relief",
  },
  {
    id: "demo-p-3",
    name: "Insulin Glargine 100IU/ml Injection",
    sku: "INS-GLA",
    category: "Diabetes Care",
    cost_price: 420,
    selling_price: 650,
    low_stock_threshold: 10,
    reorder_threshold: 5,
    created_at: "2026-01-02T00:00:00Z",
    barcode: "8901234567892",
    description: "Long-acting human insulin analog",
  },
  {
    id: "demo-p-4",
    name: "Vitamin D3 60,000 IU Softgels",
    sku: "VTD-60K",
    category: "Vitamins & Supplements",
    cost_price: 35,
    selling_price: 60,
    low_stock_threshold: 15,
    reorder_threshold: 10,
    created_at: "2026-01-02T00:00:00Z",
    barcode: "8901234567893",
    description: "High potency Cholecalciferol supplements",
  },
  {
    id: "demo-p-5",
    name: "Azithromycin 250mg Suspension",
    sku: "AZM-250",
    category: "Antibiotics",
    cost_price: 65,
    selling_price: 110,
    low_stock_threshold: 12,
    reorder_threshold: 8,
    created_at: "2026-01-03T00:00:00Z",
    barcode: "8901234567894",
    description: "Pediatric macrolide antibiotic suspension",
  },
  {
    id: "demo-p-6",
    name: "Digital Infrared Thermometer Pro",
    sku: "DEV-THERM",
    category: "Medical Devices",
    cost_price: 850,
    selling_price: 1499,
    low_stock_threshold: 5,
    reorder_threshold: 3,
    created_at: "2026-01-03T00:00:00Z",
    barcode: "8901234567895",
    description: "Non-contact medical forehead thermometer",
  },
  {
    id: "demo-p-7",
    name: "Automatic Blood Pressure Monitor",
    sku: "DEV-BPM",
    category: "Medical Devices",
    cost_price: 1250,
    selling_price: 2199,
    low_stock_threshold: 4,
    reorder_threshold: 2,
    created_at: "2026-01-04T00:00:00Z",
    barcode: "8901234567896",
    description: "Digital arm blood pressure monitor with LCD",
  },
  {
    id: "demo-p-8",
    name: "Omeprazole 20mg Gastro-Resistant",
    sku: "OMP-20",
    category: "Gastrointestinal",
    cost_price: 28,
    selling_price: 55,
    low_stock_threshold: 25,
    reorder_threshold: 15,
    created_at: "2026-01-04T00:00:00Z",
    barcode: "8901234567897",
    description: "Proton pump inhibitor capsules",
  },
];

export const DEMO_PRODUCT_BATCHES: ProductBatch[] = [
  {
    id: "demo-b-1",
    product_id: "demo-p-1",
    vendor_id: "demo-store-1",
    batch_number: "BATCH-AMX-2026A",
    quantity: 150,
    rate: 45,
    received_date: "2026-01-10T00:00:00Z",
    mfg_date: "2025-11-01",
    expiry_date: "2027-11-01",
    status: "active",
    supplier: "Cipla Meds Ltd",
    notes: "Inspected and verified",
    created_at: "2026-01-10T00:00:00Z",
  },
  {
    id: "demo-b-2",
    product_id: "demo-p-2",
    vendor_id: "demo-store-1",
    batch_number: "BATCH-PCM-2026B",
    quantity: 80,
    rate: 12,
    received_date: "2026-01-15T00:00:00Z",
    mfg_date: "2025-08-01",
    expiry_date: "2026-08-25", // Expiring soon in ~13 days!
    status: "active",
    supplier: "Sun Pharma",
    notes: "Expiring within 30 days - high priority sale",
    created_at: "2026-01-15T00:00:00Z",
  },
  {
    id: "demo-b-3",
    product_id: "demo-p-3",
    vendor_id: "demo-store-1",
    batch_number: "BATCH-INS-2025X",
    quantity: 25,
    rate: 420,
    received_date: "2025-06-01T00:00:00Z",
    mfg_date: "2024-05-01",
    expiry_date: "2026-06-01", // Expired!
    status: "expired",
    supplier: "Sanofi India",
    notes: "Expired batch - quarantined for return",
    created_at: "2025-06-01T00:00:00Z",
  },
  {
    id: "demo-b-4",
    product_id: "demo-p-4",
    vendor_id: "demo-store-2",
    batch_number: "BATCH-VTD-2026C",
    quantity: 200,
    rate: 35,
    received_date: "2026-02-01T00:00:00Z",
    mfg_date: "2026-01-01",
    expiry_date: "2028-01-01",
    status: "active",
    supplier: "Zydus Healthcare",
    notes: "Fresh stock",
    created_at: "2026-02-01T00:00:00Z",
  },
];

export const DEMO_STOCK_ENTRIES: StockEntry[] = [
  { id: "demo-se-1", vendor_id: "demo-store-1", product_id: "demo-p-1", batch_id: "demo-b-1", quantity: 75, updated_at: "2026-02-10T10:00:00Z" },
  { id: "demo-se-2", vendor_id: "demo-store-1", product_id: "demo-p-2", batch_id: "demo-b-2", quantity: 18, updated_at: "2026-02-10T10:00:00Z" },
  { id: "demo-se-3", vendor_id: "demo-store-1", product_id: "demo-p-3", batch_id: "demo-b-3", quantity: 6, updated_at: "2026-02-10T10:00:00Z" },
  { id: "demo-se-4", vendor_id: "demo-store-2", product_id: "demo-p-1", batch_id: "demo-b-1", quantity: 50, updated_at: "2026-02-11T11:00:00Z" },
  { id: "demo-se-5", vendor_id: "demo-store-2", product_id: "demo-p-4", batch_id: "demo-b-4", quantity: 120, updated_at: "2026-02-11T11:00:00Z" },
  { id: "demo-se-6", vendor_id: "demo-store-3", product_id: "demo-p-6", batch_id: null, quantity: 12, updated_at: "2026-02-12T12:00:00Z" },
  { id: "demo-se-7", vendor_id: "demo-store-3", product_id: "demo-p-7", batch_id: null, quantity: 8, updated_at: "2026-02-12T12:00:00Z" },
];

export const DEMO_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "demo-po-1",
    po_number: "PO-982104",
    supplier: "CureForever HQ Central Depot",
    destination_vendor_id: "demo-store-1",
    expected_delivery: "2026-08-16",
    status: "accepted",
    notes: "[Vendor Note]: Requesting urgent delivery for Metro Pharmacy Store #1.\n[HQ Admin]: Purchase order approved & dispatched.",
    created_at: "2026-08-10T14:30:00Z",
  },
  {
    id: "demo-po-2",
    po_number: "PO-441092",
    supplier: "Sun Pharma Supplies",
    destination_vendor_id: "demo-store-2",
    expected_delivery: "2026-08-18",
    status: "revision_requested",
    notes: "[HQ Admin Note]: Initial PO created for 20 units.\n[Vendor Note]: We can only supply 10 units this week. Please revise order.\n[HQ Admin]: Revised to 10 units as requested.",
    created_at: "2026-08-11T09:15:00Z",
  },
  {
    id: "demo-po-3",
    po_number: "PO-102938",
    supplier: "Zydus Distributors",
    destination_vendor_id: "demo-store-3",
    expected_delivery: "2026-08-20",
    status: "sent",
    notes: "[HQ Admin Note]: New stock replenishment PO sent to City Health Store #3.",
    created_at: "2026-08-12T16:00:00Z",
  },
];

export const DEMO_STOCK_TRANSFERS: StockTransfer[] = [
  {
    id: "demo-st-1",
    source_vendor_id: "demo-store-1",
    target_vendor_id: "demo-store-2",
    product_id: "demo-p-2",
    batch_id: "demo-b-2",
    quantity: 20,
    status: "in_transit",
    notes: "Inter-store transfer to cover low stock at Express Care Meds #2",
    created_at: "2026-08-11T12:00:00Z",
    updated_at: "2026-08-11T12:00:00Z",
  },
];

export const DEMO_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "demo-ann-1",
    title: "Quarterly Inventory Audit & Reconciliation Notice",
    message: "All store managers please ensure complete batch scanning and stock count verifications before Friday.",
    is_active: true,
    is_blocking: true,
    created_at: "2026-08-10T08:00:00Z",
  },
  {
    id: "demo-ann-2",
    title: "Cold Chain Storage Temperature Logs Requirement",
    message: "Mandatory daily temperature recording for all refrigerated insulin and biological stock.",
    is_active: true,
    is_blocking: false,
    created_at: "2026-08-11T10:30:00Z",
  },
];

export const DEMO_NOTIFICATIONS: AppNotification[] = [
  {
    id: "demo-notif-1",
    vendor_id: null,
    title: "📦 PO #PO-982104 Accepted",
    message: "Metro Central Pharmacy #1 accepted purchase order for Amoxicillin & Paracetamol",
    module: "purchase_orders",
    module_ref_id: "demo-po-1",
    is_read: false,
    created_at: "2026-08-10T14:35:00Z",
  },
  {
    id: "demo-notif-2",
    vendor_id: null,
    title: "💬 Revision Requested for PO #PO-441092",
    message: "Express Care Meds #2 requested quantity revision for Insulin order.",
    module: "purchase_orders",
    module_ref_id: "demo-po-2",
    is_read: false,
    created_at: "2026-08-11T09:20:00Z",
  },
  {
    id: "demo-notif-3",
    vendor_id: null,
    title: "🚚 Stock Transfer Dispatched",
    message: "20 units of Paracetamol 650mg dispatched from Store #1 to Store #2.",
    module: "transfers",
    module_ref_id: "demo-st-1",
    is_read: false,
    created_at: "2026-08-11T12:05:00Z",
  },
];

export function loadDemoSandbox() {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Failed to parse demo sandbox state from localStorage", e);
  }

  const initial = {
    products: DEMO_PRODUCTS,
    productBatches: DEMO_PRODUCT_BATCHES,
    vendors: DEMO_VENDORS,
    stockEntries: DEMO_STOCK_ENTRIES,
    stockHistory: [],
    stockAdjustments: [],
    reorderRequests: [],
    productVisibility: [],
    announcements: DEMO_ANNOUNCEMENTS,
    announcementReads: [],
    purchaseOrders: DEMO_PURCHASE_ORDERS,
    stockTransfers: DEMO_STOCK_TRANSFERS,
    notifications: DEMO_NOTIFICATIONS,
  };

  saveDemoSandbox(initial);
  return initial;
}

export function saveDemoSandbox(data: any) {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore storage errors */
  }
}

export function resetDemoSandbox() {
  localStorage.removeItem(DEMO_STORAGE_KEY);
  return loadDemoSandbox();
}
