export const REASONS = [
  "manual_adjustment",
  "physical_reconciliation",
  "damaged_goods",
  "expired_disposal",
  "qc_sample",
  "return_to_vendor",
] as const;

export const REASON_LABELS: Record<string, string> = {
  manual_adjustment: "Manual Adjustment",
  physical_reconciliation: "Physical Audit Reconciliation",
  damaged_goods: "Damaged Goods / Waste",
  expired_disposal: "Expired Stock Disposal",
  qc_sample: "QC Testing Sample",
  return_to_vendor: "Restock Return",
  initial_stock: "Initial Stock",
};

export const CACHE_KEY = "cf_cache_v2";
export const OFFLINE_OPS_KEY = "cf_offline_ops_v2";

export const FILTER_LABELS: Record<string, string> = {
  all: "All Stock",
  low: "Low Stock",
  expiring: "Expiring Soon",
  expired: "Expired",
};

export const ADMIN_TAB_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  vendors: "Vendors",
  allstock: "All Stock",
  batches: "Batches",
  financials: "Financials",
  products: "Products",
  announcements: "Announcements",
};