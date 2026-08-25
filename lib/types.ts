export type BatchStatus = "active" | "recalled" | "expired" | "quarantined";

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
  image_url?: string | null;
  created_at: string;
}

export interface ProductBatch {
  id: string;
  product_id: string;
  vendor_id: string;
  batch_number?: string;
  quantity: number;
  rate: number;
  cost_price?: number;
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
  state?: string | null;
  contact_phone?: string | null;
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
  quantity?: number;
  requested_qty?: number;
  batch_id: string | null;
  notes?: string | null;
  note?: string | null;
  status: "pending" | "approved" | "rejected" | "fulfilled";
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

export type POStatus = "draft" | "sent" | "accepted" | "revision_requested" | "partially_received" | "fulfilled" | "completed" | "cancelled" | "rejected";

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier: string;
  destination_vendor_id: string;
  status: POStatus;
  notes: string | null;
  created_at: string;
  expected_delivery: string | null;
  items?: PurchaseOrderItem[];
}

export type TransferStatus = "pending" | "approved" | "in_transit" | "completed" | "rejected";

export interface StockTransfer {
  id: string;
  source_vendor_id: string;
  target_vendor_id: string;
  product_id: string;
  batch_id: string | null;
  quantity: number;
  status: TransferStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificationModule = "purchase_orders" | "transfers" | "announcements" | "stock" | "batches";

export interface AppNotification {
  id: string;
  vendor_id: string | null;
  title: string;
  message: string;
  module: NotificationModule;
  module_ref_id: string | null;
  is_read: boolean;
  created_at: string;
}

export type ValuationModel = "weighted_avg" | "fifo" | "lifo";

export type Currency = "USD" | "EUR" | "GBP" | "INR" | "CAD";

export type OfflineOp =
  | { type: "stock_upsert"; id: string; data: Record<string, unknown> }
  | { type: "reorder"; data: Record<string, unknown> }
  | { type: "announcement_read"; data: Record<string, unknown> }
  | { type: "purchase_order_create"; data: Record<string, unknown> }
  | { type: "transfer_create"; data: Record<string, unknown> }
  | { type: "transfer_status_update"; data: { transfer: StockTransfer; status: string } }
  | { type: "notification_read"; data: { id: string } };

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
  purchaseOrders?: PurchaseOrder[];
  stockTransfers?: StockTransfer[];
  notifications?: AppNotification[];
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
  | { type: "receiveStock" }
  | { type: "restrict"; productId: string }
  | { type: "scanner" }
  | { type: "product"; product: Product | null }
  | { type: "announcement"; announcement?: Announcement | null }
  | { type: "history"; entry: StockEntry }
  | { type: "commandPalette" }
  | { type: "labelStudio"; product?: Product; batch?: ProductBatch }
  | { type: "createPO" }
  | { type: "viewPO"; po: PurchaseOrder }
  | { type: "createTransfer" }
  | { type: "dataImport" }
  | null;