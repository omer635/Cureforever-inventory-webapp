export type BatchStatus = "active" | "recalled" | "expired";

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  low_stock_threshold: number;
  reorder_threshold: number | null;
  cost_price: number;
  selling_price: number;
  barcode: string | null;
  description: string | null;
  created_at: string;
}

export interface ProductBatch {
  id: string;
  product_id: string;
  vendor_id: string;
  quantity: number;
  rate: number;
  received_date: string;
  mfg_date: string;
  expiry_date: string;
  status: BatchStatus;
  supplier: string | null;
  notes: string | null;
  created_at: string;
}

export interface StockEntry {
  id: string;
  vendor_id: string;
  product_id: string;
  batch_id: string | null;
  quantity: number;
  updated_at: string;
}

export interface Vendor {
  id: string;
  user_id: string | null;
  name: string;
  is_admin: boolean;
  phone: string | null;
  address: string | null;
  email: string | null;
  created_at: string;
}

export interface StockAdjustment {
  id: string;
  vendor_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  previous_qty: number;
  new_qty: number;
  change_qty: number;
  reason_code: string | null;
  notes: string | null;
  batch_id: string | null;
}

export interface ReorderRequest {
  id: string;
  vendor_id: string;
  product_id: string;
  quantity: number;
  batch_id: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface ProductVisibility {
  id: string;
  product_id: string;
  vendor_id: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  is_active: boolean;
  is_blocking: boolean | null;
  created_at: string;
}

export interface AnnouncementRead {
  id: string;
  announcement_id: string;
  vendor_id: string;
  created_at: string;
}

export interface StockHistory {
  id: string;
  vendor_id: string;
  product_id: string;
  quantity: number;
  recorded_at: string;
}

export type OfflineOp =
  | { type: "stock_upsert"; id: string; data: Record<string, unknown> }
  | { type: "reorder"; data: Record<string, unknown> }
  | { type: "announcement_read"; data: Record<string, unknown> };

export interface RestoreCache {
  products: Product[];
  productBatches: ProductBatch[];
  vendors: Vendor[];
  stockEntries: StockEntry[];
  stockHistory: StockHistory[];
  stockAdjustments: StockAdjustment[];
  reorderRequests: ReorderRequest[];
  productVisibility: ProductVisibility[];
  announcements: Announcement[];
  announcementReads: AnnouncementRead[];
  savedAt: number;
}

export type ModalState =
  | { type: "profile" }
  | { type: "alerts" }
  | { type: "addVendor" }
  | { type: "editVendor"; vendor: Vendor }
  | { type: "reorder"; entry: StockEntry }
  | { type: "createBatch" }
  | { type: "manageBatch"; batch: ProductBatch }
  | { type: "restrict"; productId: string }
  | { type: "scanner" }
  | { type: "product"; product: Product | null }
  | { type: "announcement" }
  | { type: "history"; entry: StockEntry }
  | null;