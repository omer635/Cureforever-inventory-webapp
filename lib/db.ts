"use client";

import { getSupabase } from "./supabase";
import type {
  Announcement,
  AnnouncementRead,
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

export interface AllData {
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
  purchaseOrders: PurchaseOrder[];
  stockTransfers: StockTransfer[];
}

export async function fetchAll(): Promise<AllData> {
  const sb = getSupabase();
  const [p, pb, v, se, sh, sa, rr, pv, an, ar] = await Promise.all([
    sb.from("products").select("*").order("name"),
    sb.from("product_batches").select("*").order("received_date", { ascending: false }),
    sb.from("vendors").select("*").order("name"),
    sb.from("stock_entries").select("*").order("updated_at", { ascending: false }),
    sb.from("stock_history").select("*").order("recorded_at", { ascending: false }).limit(500),
    sb.from("stock_adjustments").select("*").order("created_at", { ascending: false }).limit(500),
    sb.from("reorder_requests").select("*").order("created_at", { ascending: false }),
    sb.from("product_visibility").select("*"),
    sb.from("announcements").select("*").order("created_at", { ascending: false }),
    sb.from("announcement_reads").select("*"),
  ]);

  let purchaseOrders: PurchaseOrder[] = [];
  try {
    const poRes = await sb.from("purchase_orders").select("*, items:purchase_order_items(*)").order("created_at", { ascending: false });
    if (!poRes.error && poRes.data) {
      purchaseOrders = poRes.data as PurchaseOrder[];
    }
  } catch {
    /* Safe fallback if table does not exist yet */
  }

  let stockTransfers: StockTransfer[] = [];
  try {
    const stRes = await sb.from("stock_transfers").select("*").order("created_at", { ascending: false });
    if (!stRes.error && stRes.data) {
      stockTransfers = stRes.data as StockTransfer[];
    }
  } catch {
    /* Safe fallback if table does not exist yet */
  }

  const products = (p.data as Product[]) || [];
  const productBatches = (pb.data as ProductBatch[]) || [];
  const vendors = (v.data as Vendor[]) || [];
  const stockEntries = (se.data as StockEntry[]) || [];

  // Primary tables check
  if (p.error) throw new Error("Products error: " + p.error.message);
  if (v.error) throw new Error("Vendors error: " + v.error.message);

  return {
    products,
    productBatches,
    vendors,
    stockEntries,
    stockHistory: (sh.data as StockHistory[]) || [],
    stockAdjustments: (sa.data as StockAdjustment[]) || [],
    reorderRequests: (rr.data as ReorderRequest[]) || [],
    productVisibility: (pv.data as ProductVisibility[]) || [],
    announcements: (an.data as Announcement[]) || [],
    announcementReads: (ar.data as AnnouncementRead[]) || [],
    purchaseOrders,
    stockTransfers,
  };
}

export interface SaveEntryInput {
  entryId: string;
  quantity: number;
  reasonCode: string;
  notes: string;
  batchId: string | null;
}

export interface SaveEntryResult {
  adjustment?: StockAdjustment;
  history?: StockHistory;
}

export async function saveEntry(input: SaveEntryInput): Promise<SaveEntryResult> {
  const sb = getSupabase();
  const { data: entry, error: e0 } = await sb
    .from("stock_entries")
    .select("id, vendor_id, product_id, batch_id, quantity, updated_at")
    .eq("id", input.entryId)
    .single();
  if (e0 || !entry) throw new Error("Stock line not found: " + (e0?.message || input.entryId));

  const prevQty = Number(entry.quantity) || 0;
  const newQty = input.quantity;
  const change = newQty - prevQty;

  const { error: e1 } = await sb
    .from("stock_entries")
    .update({ quantity: newQty, updated_at: new Date().toISOString() })
    .eq("id", input.entryId);
  if (e1) throw new Error("Could not save quantity: " + e1.message);

  const adjPayload = {
    vendor_id: entry.vendor_id,
    product_id: entry.product_id,
    batch_id: input.batchId || entry.batch_id,
    change_qty: change,
    reason_code: input.reasonCode,
    notes: input.notes || null,
    created_at: new Date().toISOString(),
  };
  const { data: adj } = await sb
    .from("stock_adjustments")
    .insert(adjPayload)
    .select()
    .maybeSingle();

  if (change !== 0) {
    await sb
      .from("stock_history")
      .insert({
        vendor_id: entry.vendor_id,
        product_id: entry.product_id,
        quantity: newQty,
        recorded_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error("stock_history insert failed:", error.message);
      });
  }

  return { adjustment: adj as StockAdjustment };
}

export async function createBatch(payload: Record<string, unknown>): Promise<ProductBatch> {
  const sb = getSupabase();
  const { data, error } = await sb.from("product_batches").insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data as ProductBatch;
}

export async function updateBatch(id: string, payload: Record<string, unknown>): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("product_batches").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createProduct(payload: Record<string, unknown>): Promise<Product> {
  const sb = getSupabase();
  const { data, error } = await sb.from("products").insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data as Product;
}

export async function updateProduct(id: string, payload: Record<string, unknown>): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("products").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProductRow(id: string): Promise<void> {
  const sb = getSupabase();
  await sb.from("vendor_product_visibility").delete().eq("product_id", id);
  await sb.from("stock_entries").delete().eq("product_id", id);
  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createVendor(payload: Record<string, unknown>): Promise<Vendor> {
  const sb = getSupabase();
  const { data, error } = await sb.from("vendors").insert(payload).select().single();
  if (error) {
    // Fallback if address or phone column is missing in schema cache
    const fallbackPayload: Record<string, unknown> = { ...payload };
    delete fallbackPayload.address;
    delete fallbackPayload.phone;
    if (payload.address) fallbackPayload.state = String(payload.address);
    if (payload.phone) fallbackPayload.contact_phone = String(payload.phone);
    const { data: data2, error: error2 } = await sb.from("vendors").insert(fallbackPayload).select().single();
    if (error2) throw new Error(error.message);
    return data2 as Vendor;
  }
  return data as Vendor;
}

export async function updateVendor(id: string, payload: Record<string, unknown>): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("vendors").update(payload).eq("id", id);
  if (error) {
    // Fallback if address or phone column is missing in schema cache
    const fallbackPayload: Record<string, unknown> = { ...payload };
    delete fallbackPayload.address;
    delete fallbackPayload.phone;
    if (payload.address) fallbackPayload.state = String(payload.address);
    if (payload.phone) fallbackPayload.contact_phone = String(payload.phone);
    const { error: error2 } = await sb.from("vendors").update(fallbackPayload).eq("id", id);
    if (error2) throw new Error(error.message);
  }
}

export async function deleteVendorRow(id: string): Promise<void> {
  const sb = getSupabase();
  try {
    await sb.from("stock_entries").delete().eq("vendor_id", id);
    await sb.from("reorder_requests").delete().eq("vendor_id", id);
    await sb.from("product_visibility").delete().eq("vendor_id", id);
    await sb.from("vendor_product_visibility").delete().eq("vendor_id", id);
    await sb.from("announcement_reads").delete().eq("vendor_id", id);
  } catch {}
  const { error } = await sb.from("vendors").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createReorder(payload: Record<string, unknown>): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("reorder_requests").insert(payload);
  if (error) throw new Error(error.message);
}

export async function updateReorderStatus(id: string, status: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("reorder_requests").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAnnouncementRead(announcementId: string, vendorId: string): Promise<void> {
  const sb = getSupabase();
  await sb
    .from("announcement_reads")
    .upsert({ announcement_id: announcementId, vendor_id: vendorId, created_at: new Date().toISOString() }, { onConflict: "announcement_id,vendor_id" });
}

export async function setProductVisibility(productId: string, allowedVendorIds: string[]): Promise<void> {
  const sb = getSupabase();
  try {
    await sb.from("product_visibility").delete().eq("product_id", productId);
    await sb.from("vendor_product_visibility").delete().eq("product_id", productId);
  } catch {}

  if (allowedVendorIds.length > 0) {
    const rows = allowedVendorIds.map((vendorId) => ({ product_id: productId, vendor_id: vendorId }));
    const { error: ins1 } = await sb.from("product_visibility").insert(rows);
    if (ins1) {
      const { error: ins2 } = await sb.from("vendor_product_visibility").insert(rows);
      if (ins2) throw new Error(ins1.message);
    }
  }
}

export async function createAnnouncement(payload: Record<string, unknown>): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("announcements").insert(payload);
  if (error) throw new Error(error.message);
}

export async function revokeAnnouncement(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("announcements").update({ is_active: false }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createPurchaseOrder(po: Record<string, unknown>, items: Record<string, unknown>[]): Promise<void> {
  const sb = getSupabase();
  const { data: createdPo, error: poErr } = await sb.from("purchase_orders").insert(po).select().single();
  if (poErr) throw new Error(poErr.message);
  if (items && items.length > 0) {
    const itemsWithPo = items.map((it) => ({ ...it, po_id: createdPo.id }));
    const { error: itemsErr } = await sb.from("purchase_order_items").insert(itemsWithPo);
    if (itemsErr) console.warn("Failed inserting PO items:", itemsErr.message);
  }
}

export async function updatePOStatus(poId: string, status: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("purchase_orders").update({ status }).eq("id", poId);
  if (error) throw new Error(error.message);
}

export async function createStockTransfer(transfer: Record<string, unknown>): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("stock_transfers").insert(transfer);
  if (error) throw new Error(error.message);
}

export async function updateTransferStatus(transferId: string, status: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("stock_transfers").update({ status, updated_at: new Date().toISOString() }).eq("id", transferId);
  if (error) throw new Error(error.message);
}