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

// Persists the vendor's edited quantity/reason/notes/batch directly on the stock_entries
// row. The DB triggers (record_stock_history, record_stock_adjustment — schema.sql) read
// these NEW column values and write the stock_history/stock_adjustments audit rows
// themselves; inserting those rows again here would double-count every adjustment.
export async function saveEntry(input: SaveEntryInput): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("stock_entries")
    .update({
      quantity: input.quantity,
      batch_id: input.batchId,
      reason_code: input.reasonCode,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.entryId);
  if (error) throw new Error("Could not save quantity: " + error.message);
}

export interface AdjustStockResult {
  entryId: string;
  previousQty: number;
  newQty: number;
}

// Applies a signed quantity delta to a vendor's stock_entries row for a product,
// creating the row if it doesn't exist yet. This is the single place that keeps
// on-hand quantity (what All Stock / Dashboard / Financials read) in sync with
// batch receipts, PO receipts, and transfers — call it from every path that adds
// or removes real stock instead of writing to product_batches/purchase_order_items/
// stock_transfers alone.
export async function adjustStockQuantity(
  vendorId: string,
  productId: string,
  delta: number,
  reasonCode: string,
  batchId?: string | null
): Promise<AdjustStockResult> {
  const sb = getSupabase();
  const { data: existing, error: findErr } = await sb
    .from("stock_entries")
    .select("id, quantity")
    .eq("vendor_id", vendorId)
    .eq("product_id", productId)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);

  if (!existing) {
    const newQty = Math.max(0, delta);
    const { data: created, error: insErr } = await sb
      .from("stock_entries")
      .insert({
        vendor_id: vendorId,
        product_id: productId,
        batch_id: batchId ?? null,
        quantity: newQty,
        reason_code: reasonCode,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    return { entryId: created.id, previousQty: 0, newQty };
  }

  const prevQty = Number(existing.quantity) || 0;
  const newQty = Math.max(0, prevQty + delta);
  const update: Record<string, unknown> = {
    quantity: newQty,
    reason_code: reasonCode,
    updated_at: new Date().toISOString(),
  };
  if (batchId) update.batch_id = batchId;
  const { error: updErr } = await sb.from("stock_entries").update(update).eq("id", existing.id);
  if (updErr) throw new Error(updErr.message);
  return { entryId: existing.id, previousQty: prevQty, newQty };
}

// Creates a batch AND adds its quantity to the vendor's on-hand stock_entries row
// (only "active" batches count as sellable stock — quarantined/recalled batches
// are recorded but don't move the on-hand number).
export async function createBatch(payload: Record<string, unknown>): Promise<ProductBatch> {
  const sb = getSupabase();
  const { data, error } = await sb.from("product_batches").insert(payload).select().single();
  if (error) throw new Error(error.message);
  const batch = data as ProductBatch;
  const status = (payload.status as string) || "active";
  if (status === "active" && batch.quantity > 0) {
    await adjustStockQuantity(batch.vendor_id, batch.product_id, batch.quantity, "batch_received", batch.id);
  }
  return batch;
}

// Reconciles the change in a batch's stock contribution (quantity and/or active-status
// flip) into stock_entries, then applies the edit.
export async function updateBatch(id: string, payload: Record<string, unknown>): Promise<void> {
  const sb = getSupabase();
  const { data: existing, error: findErr } = await sb
    .from("product_batches")
    .select("vendor_id, product_id, quantity, status")
    .eq("id", id)
    .single();
  if (findErr || !existing) throw new Error(findErr?.message || "Batch not found");

  const newQuantity = payload.quantity !== undefined ? Number(payload.quantity) : existing.quantity;
  const newStatus = (payload.status as string) || existing.status;
  const oldContribution = existing.status === "active" ? existing.quantity : 0;
  const newContribution = newStatus === "active" ? newQuantity : 0;
  const delta = newContribution - oldContribution;

  const { error } = await sb.from("product_batches").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  if (delta !== 0) {
    await adjustStockQuantity(existing.vendor_id, existing.product_id, delta, "batch_updated", id);
  }
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
  await sb.from("product_visibility").delete().eq("product_id", id);
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

export async function createVendorWithAuth(
  payload: Record<string, unknown>,
  password?: string
): Promise<Vendor> {
  const sb = getSupabase();
  let userId: string | null = null;

  if (payload.email && password && String(password).trim()) {
    try {
      const { data: authData, error: authError } = await sb.auth.signUp({
        email: String(payload.email).trim(),
        password: String(password).trim(),
        options: {
          data: {
            name: String(payload.name || ""),
            is_admin: !!payload.is_admin,
          },
        },
      });
      if (!authError && authData.user) {
        userId = authData.user.id;
      }
    } catch {
      /* proceed with vendor row creation */
    }
  }

  const finalPayload = { ...payload };
  if (userId) {
    finalPayload.user_id = userId;
  }

  return createVendor(finalPayload);
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

export async function updateVendorWithAuth(
  id: string,
  payload: Record<string, unknown>,
  password?: string
): Promise<void> {
  const sb = getSupabase();
  await updateVendor(id, payload);

  if (password && password.trim().length >= 6) {
    try {
      const { data: v } = await sb.from("vendors").select("user_id").eq("id", id).single();
      if (v?.user_id) {
        await sb.auth.admin.updateUserById(v.user_id, { password: password.trim() });
      }
    } catch {
      /* proceed */
    }
  }
}

export async function deleteVendorRow(id: string): Promise<void> {
  const sb = getSupabase();
  try {
    await sb.from("stock_entries").delete().eq("vendor_id", id);
    await sb.from("reorder_requests").delete().eq("vendor_id", id);
    await sb.from("product_visibility").delete().eq("vendor_id", id);
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
  await sb.from("product_visibility").delete().eq("product_id", productId);

  if (allowedVendorIds.length > 0) {
    const rows = allowedVendorIds.map((vendorId) => ({ product_id: productId, vendor_id: vendorId }));
    const { error } = await sb.from("product_visibility").insert(rows);
    if (error) throw new Error(error.message);
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

export async function updatePOItemReceived(itemId: string, quantityReceived: number): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("purchase_order_items").update({ quantity_received: quantityReceived }).eq("id", itemId);
  if (error) throw new Error(error.message);
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

// On completion, actually moves the quantity between vendors' stock_entries rows
// (decrement source, increment target) instead of only flipping a status label.
export async function updateTransferStatus(transfer: StockTransfer, status: string): Promise<void> {
  const sb = getSupabase();
  if (status === "completed") {
    const { data: sourceEntry, error: findErr } = await sb
      .from("stock_entries")
      .select("quantity")
      .eq("vendor_id", transfer.source_vendor_id)
      .eq("product_id", transfer.product_id)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    const available = Number(sourceEntry?.quantity) || 0;
    if (available < transfer.quantity) {
      throw new Error(`Source location only has ${available} units on hand — cannot complete a transfer of ${transfer.quantity}`);
    }
    await adjustStockQuantity(transfer.source_vendor_id, transfer.product_id, -transfer.quantity, "transfer_out", transfer.batch_id);
    await adjustStockQuantity(transfer.target_vendor_id, transfer.product_id, transfer.quantity, "transfer_in", transfer.batch_id);
  }
  const { error } = await sb.from("stock_transfers").update({ status, updated_at: new Date().toISOString() }).eq("id", transfer.id);
  if (error) throw new Error(error.message);
}