"use client";

import { getSupabase } from "./supabase";
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
  WebhookEndpoint,
  DeliveryLog,
} from "./types";

import { loadDemoSandbox, saveDemoSandbox } from "./demoData";

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("cureforever_demo_mode") === "true";
}

export function isDemoId(id?: string | null): boolean {
  if (!id) return false;
  return (
    id.startsWith("demo-") ||
    id.startsWith("virtual-") ||
    id.startsWith("sh-") ||
    id.startsWith("sa-") ||
    id.startsWith("rr-") ||
    id.startsWith("poi-")
  );
}

function updateDemoSandbox(mutator: (data: any) => void) {
  const data = loadDemoSandbox();
  mutator(data);
  saveDemoSandbox(data);
  return data;
}

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
  notifications: AppNotification[];
}

export async function fetchAll(): Promise<AllData> {
  if (isDemoMode()) {
    return loadDemoSandbox() as AllData;
  }
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

  let notifications: AppNotification[] = [];
  try {
    const nRes = await sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
    if (!nRes.error && nRes.data) {
      notifications = nRes.data as AppNotification[];
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
    notifications,
  };
}

export interface SaveEntryInput {
  entryId: string;
  quantity: number;
  reasonCode: string;
  notes: string;
  batchId: string | null;
}

export async function saveEntry(input: SaveEntryInput): Promise<void> {
  if (isDemoMode() || isDemoId(input.entryId)) {
    updateDemoSandbox((data) => {
      let idx = data.stockEntries.findIndex((se: StockEntry) => se.id === input.entryId);
      if (idx === -1 && input.entryId.startsWith("virtual-")) {
        idx = data.stockEntries.findIndex((se: StockEntry) =>
          input.entryId.includes(se.product_id) || se.id.includes(input.entryId)
        );
      }
      if (idx !== -1) {
        const prev = data.stockEntries[idx].quantity;
        data.stockEntries[idx] = {
          ...data.stockEntries[idx],
          quantity: input.quantity,
          batch_id: input.batchId,
          updated_at: new Date().toISOString(),
        };
        data.stockAdjustments.unshift({
          id: `sa-demo-${Date.now()}`,
          vendor_id: data.stockEntries[idx].vendor_id,
          product_id: data.stockEntries[idx].product_id,
          quantity: input.quantity - prev,
          previous_qty: prev,
          new_qty: input.quantity,
          change_qty: input.quantity - prev,
          reason_code: input.reasonCode || "manual_adjustment",
          notes: input.notes || null,
          batch_id: input.batchId || null,
          created_at: new Date().toISOString(),
        });
      } else {
        const newEntry: StockEntry = {
          id: input.entryId,
          vendor_id: "demo-admin-hq",
          product_id: input.entryId.replace("virtual-", ""),
          batch_id: input.batchId || null,
          quantity: input.quantity,
          updated_at: new Date().toISOString(),
        };
        data.stockEntries.push(newEntry);
      }
    });
    return;
  }

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

export async function adjustStockQuantity(
  vendorId: string,
  productId: string,
  delta: number,
  reasonCode: string,
  batchId?: string | null
): Promise<AdjustStockResult> {
  if (isDemoMode() || isDemoId(vendorId) || isDemoId(productId)) {
    let result: AdjustStockResult = { entryId: `demo-se-${Date.now()}`, previousQty: 0, newQty: Math.max(0, delta) };
    updateDemoSandbox((data) => {
      const existing = data.stockEntries.find((se: StockEntry) => se.vendor_id === vendorId && se.product_id === productId);
      if (existing) {
        const prev = existing.quantity;
        const newQty = Math.max(0, prev + delta);
        existing.quantity = newQty;
        existing.updated_at = new Date().toISOString();
        if (batchId) existing.batch_id = batchId;
        result = { entryId: existing.id, previousQty: prev, newQty };
      } else {
        const newEntry: StockEntry = {
          id: `demo-se-${Date.now()}`,
          vendor_id: vendorId,
          product_id: productId,
          batch_id: batchId ?? null,
          quantity: Math.max(0, delta),
          updated_at: new Date().toISOString(),
        };
        data.stockEntries.push(newEntry);
        result = { entryId: newEntry.id, previousQty: 0, newQty: newEntry.quantity };
      }
    });
    return result;
  }

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

export async function createBatch(payload: Record<string, unknown>): Promise<ProductBatch> {
  if (isDemoMode() || isDemoId(payload.vendor_id as string) || isDemoId(payload.product_id as string)) {
    const newBatch: ProductBatch = {
      id: `demo-b-${Date.now()}`,
      product_id: String(payload.product_id),
      vendor_id: String(payload.vendor_id),
      batch_number: (payload.batch_number as string) || `BN-${Date.now().toString().slice(-6)}`,
      quantity: Number(payload.quantity || 0),
      rate: Number(payload.rate || 0),
      received_date: (payload.received_date as string) || new Date().toISOString(),
      mfg_date: (payload.mfg_date as string) || new Date().toISOString().slice(0, 10),
      expiry_date: (payload.expiry_date as string) || new Date().toISOString().slice(0, 10),
      status: (payload.status as any) || "active",
      supplier: (payload.supplier as string) || null,
      notes: (payload.notes as string) || null,
      created_at: new Date().toISOString(),
    };
    updateDemoSandbox((data) => {
      data.productBatches.push(newBatch);
    });
    if (newBatch.status === "active" && newBatch.quantity > 0) {
      await adjustStockQuantity(newBatch.vendor_id, newBatch.product_id, newBatch.quantity, "batch_received", newBatch.id);
    }
    return newBatch;
  }

  const sb = getSupabase();
  if (!payload.batch_number) {
    payload.batch_number = `BN-${Date.now().toString().slice(-6)}`;
  }
  const { data, error } = await sb.from("product_batches").insert(payload).select().single();
  if (error) throw new Error(error.message);
  const batch = data as ProductBatch;
  const status = (payload.status as string) || "active";
  if (status === "active" && batch.quantity > 0) {
    await adjustStockQuantity(batch.vendor_id, batch.product_id, batch.quantity, "batch_received", batch.id);
  }
  return batch;
}

export async function updateBatch(id: string, payload: Record<string, unknown>): Promise<void> {
  if (isDemoMode() || isDemoId(id)) {
    updateDemoSandbox((data) => {
      const idx = data.productBatches.findIndex((b: ProductBatch) => b.id === id);
      if (idx !== -1) {
        data.productBatches[idx] = { ...data.productBatches[idx], ...payload };
      }
    });
    return;
  }

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
  if (isDemoMode()) {
    const newProduct: Product = {
      id: `demo-prod-${Date.now()}`,
      name: String(payload.name || ""),
      sku: String(payload.sku || ""),
      category: String(payload.category || "General"),
      low_stock_threshold: Number(payload.low_stock_threshold || 10),
      reorder_threshold: payload.reorder_threshold ? Number(payload.reorder_threshold) : null,
      cost_price: Number(payload.cost_price || 0),
      selling_price: Number(payload.selling_price || 0),
      barcode: (payload.barcode as string) || null,
      description: (payload.description as string) || null,
      image_url: (payload.image_url as string) || null,
      created_at: new Date().toISOString(),
    };
    updateDemoSandbox((data) => {
      data.products.push(newProduct);
    });
    return newProduct;
  }

  const sb = getSupabase();
  const { data, error } = await sb.from("products").insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data as Product;
}

export async function updateProduct(id: string, payload: Record<string, unknown>): Promise<void> {
  if (isDemoMode()) {
    updateDemoSandbox((data) => {
      const idx = data.products.findIndex((p: Product) => p.id === id);
      if (idx !== -1) {
        data.products[idx] = { ...data.products[idx], ...payload };
      }
    });
    return;
  }

  const sb = getSupabase();
  const { error } = await sb.from("products").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProductRow(id: string): Promise<void> {
  if (isDemoMode()) {
    updateDemoSandbox((data) => {
      data.products = data.products.filter((p: Product) => p.id !== id);
      data.stockEntries = data.stockEntries.filter((se: StockEntry) => se.product_id !== id);
    });
    return;
  }

  const sb = getSupabase();
  await sb.from("product_visibility").delete().eq("product_id", id);
  await sb.from("stock_entries").delete().eq("product_id", id);
  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProductsBulk(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  const sb = getSupabase();
  await sb.from("product_visibility").delete().in("product_id", ids);
  await sb.from("stock_entries").delete().in("product_id", ids);
  const { error } = await sb.from("products").delete().in("id", ids);
  if (error) throw new Error(error.message);
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  const sb = getSupabase();
  await sb.from("purchase_order_items").delete().eq("purchase_order_id", id);
  const { error } = await sb.from("purchase_orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createVendor(payload: Record<string, unknown>): Promise<Vendor> {
  if (isDemoMode()) {
    const newVendor: Vendor = {
      id: `demo-store-${Date.now()}`,
      user_id: null,
      name: String(payload.name || "Demo Store"),
      is_admin: !!payload.is_admin,
      phone: (payload.phone as string) || null,
      address: (payload.address as string) || null,
      email: (payload.email as string) || null,
      state: String(payload.state || "HQ"),
      contact_phone: (payload.phone as string) || null,
      created_at: new Date().toISOString(),
    };
    updateDemoSandbox((data) => {
      data.vendors.push(newVendor);
    });
    return newVendor;
  }

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
  if (isDemoMode()) {
    return createVendor(payload);
  }

  try {
    const sb = getSupabase();
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) {
      const res = await fetch("/api/vendor/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...payload, password }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.vendor) return json.vendor as Vendor;
      }
    }
  } catch (err) {
    console.warn("Auth route vendor creation skipped, falling back to direct db insert:", err);
  }

  return createVendor(payload);
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
  await updateVendor(id, payload);

  if (password && password.trim().length >= 6) {
    // sb.auth.admin.* requires the service-role key — the client here only has the anon
    // key, so this must go through a server route that verifies the caller is an admin
    // and holds the real service-role key. (Previously called sb.auth.admin.updateUserById
    // directly with the anon-key client, which always fails silently — the password was
    // never actually changed even though the UI reported success.)
    const sb = getSupabase();
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Not authenticated");

    const res = await fetch("/api/vendor/update-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ vendorId: id, password: password.trim() }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.error || "Could not update login password");
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
  if (isDemoMode() || isDemoId(payload.vendor_id as string)) {
    const newRr: ReorderRequest = {
      id: `rr-demo-${Date.now()}`,
      vendor_id: String(payload.vendor_id),
      product_id: String(payload.product_id),
      batch_id: (payload.batch_id as string) || null,
      requested_qty: Number(payload.requested_qty ?? payload.quantity ?? 1),
      notes: ((payload.note || payload.notes || "") as string) || null,
      status: (payload.status as any) || "pending",
      created_at: new Date().toISOString(),
    };
    updateDemoSandbox((data) => {
      data.reorderRequests.unshift(newRr);
    });
    return;
  }

  const sb = getSupabase();
  const dbPayload = {
    vendor_id: payload.vendor_id,
    product_id: payload.product_id,
    batch_id: payload.batch_id ?? null,
    requested_qty: Number(payload.requested_qty ?? payload.quantity ?? 1),
    note: (payload.note ?? payload.notes ?? "") || null,
    status: (payload.status as string) || "pending",
  };
  const { error } = await sb.from("reorder_requests").insert(dbPayload);
  if (error) throw new Error(error.message);
}

export async function updateReorderStatus(id: string, status: string): Promise<void> {
  if (isDemoMode() || isDemoId(id)) {
    updateDemoSandbox((data) => {
      const idx = data.reorderRequests.findIndex((rr: ReorderRequest) => rr.id === id);
      if (idx !== -1) {
        data.reorderRequests[idx].status = status as any;
      }
    });
    return;
  }

  const sb = getSupabase();
  const { error } = await sb.from("reorder_requests").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAnnouncementRead(announcementId: string, vendorId: string): Promise<void> {
  if (isDemoMode() || isDemoId(announcementId) || isDemoId(vendorId)) {
    updateDemoSandbox((data) => {
      if (!data.announcementReads) data.announcementReads = [];
      data.announcementReads.push({ announcement_id: announcementId, vendor_id: vendorId, read_at: new Date().toISOString() });
    });
    return;
  }

  const sb = getSupabase();
  const { error } = await sb
    .from("announcement_reads")
    .upsert({ announcement_id: announcementId, vendor_id: vendorId, read_at: new Date().toISOString() }, { onConflict: "announcement_id,vendor_id" });
  if (error) throw new Error(error.message);
}

export async function setProductVisibility(productId: string, allowedVendorIds: string[]): Promise<void> {
  if (isDemoMode() || isDemoId(productId)) {
    updateDemoSandbox((data) => {
      data.productVisibility = data.productVisibility.filter((pv: ProductVisibility) => pv.product_id !== productId);
      allowedVendorIds.forEach((vendorId) => {
        data.productVisibility.push({ id: `pv-demo-${Date.now()}`, product_id: productId, vendor_id: vendorId });
      });
    });
    return;
  }

  const sb = getSupabase();
  await sb.from("product_visibility").delete().eq("product_id", productId);

  if (allowedVendorIds.length > 0) {
    const rows = allowedVendorIds.map((vendorId) => ({ product_id: productId, vendor_id: vendorId }));
    const { error } = await sb.from("product_visibility").insert(rows);
    if (error) throw new Error(error.message);
  }
}

export async function createAnnouncement(payload: Record<string, unknown>): Promise<void> {
  if (isDemoMode()) {
    const newAnn: Announcement = {
      id: `demo-ann-${Date.now()}`,
      title: String(payload.title || ""),
      message: String(payload.message || ""),
      is_active: !!payload.is_active,
      is_blocking: !!payload.is_blocking,
      created_at: new Date().toISOString(),
    };
    updateDemoSandbox((data) => {
      data.announcements.unshift(newAnn);
    });
    return;
  }

  const sb = getSupabase();
  const { error } = await sb.from("announcements").insert(payload);
  if (error) throw new Error(error.message);
}

export async function updateAnnouncement(id: string, payload: Record<string, unknown>): Promise<void> {
  if (isDemoMode() || isDemoId(id)) {
    updateDemoSandbox((data) => {
      const idx = data.announcements.findIndex((a: Announcement) => a.id === id);
      if (idx !== -1) {
        data.announcements[idx] = { ...data.announcements[idx], ...payload };
      }
    });
    return;
  }

  const sb = getSupabase();
  const { error } = await sb.from("announcements").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function toggleAnnouncementActive(id: string, is_active: boolean): Promise<void> {
  if (isDemoMode() || isDemoId(id)) {
    updateDemoSandbox((data) => {
      const ann = data.announcements.find((a: Announcement) => a.id === id);
      if (ann) ann.is_active = is_active;
    });
    return;
  }

  const sb = getSupabase();
  const { error } = await sb.from("announcements").update({ is_active }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  if (isDemoMode() || isDemoId(id)) {
    updateDemoSandbox((data) => {
      data.announcements = data.announcements.filter((a: Announcement) => a.id !== id);
    });
    return;
  }

  const sb = getSupabase();
  await sb.from("announcement_reads").delete().eq("announcement_id", id);
  const { error } = await sb.from("announcements").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createPurchaseOrder(po: Record<string, unknown>, items: Record<string, unknown>[]): Promise<void> {
  if (isDemoMode() || isDemoId(po.destination_vendor_id as string)) {
    const newPoId = `demo-po-${Date.now()}`;
    const newPo: PurchaseOrder = {
      id: newPoId,
      po_number: (po.po_number as string) || `PO-${Date.now().toString().slice(-6)}`,
      supplier: String(po.supplier || "Supplier"),
      destination_vendor_id: String(po.destination_vendor_id),
      expected_delivery: (po.expected_delivery as string) || new Date().toISOString().slice(0, 10),
      status: (po.status as any) || "sent",
      notes: (po.notes as string) || null,
      created_at: new Date().toISOString(),
      items: items ? items.map((it, i) => ({
        id: `poi-demo-${Date.now()}-${i}`,
        po_id: newPoId,
        product_id: String(it.product_id),
        quantity_ordered: Number(it.quantity_ordered || 1),
        quantity_received: Number(it.quantity_received || 0),
        unit_cost: Number(it.unit_cost || 0),
      })) : [],
    };
    updateDemoSandbox((data) => {
      data.purchaseOrders.unshift(newPo);
    });
    return;
  }

  const sb = getSupabase();
  const { data: createdPo, error: poErr } = await sb.from("purchase_orders").insert(po).select().single();
  if (poErr) throw new Error(poErr.message);
  if (items && items.length > 0) {
    const itemsWithPo = items.map((it) => ({ ...it, po_id: createdPo.id }));
    const { error: itemsErr } = await sb.from("purchase_order_items").insert(itemsWithPo);
    if (itemsErr) throw new Error("PO created, but line items failed to save: " + itemsErr.message);
  }
}

export async function updatePOItemReceived(itemId: string, quantityReceived: number): Promise<void> {
  if (isDemoMode() || isDemoId(itemId)) {
    updateDemoSandbox((data) => {
      data.purchaseOrders.forEach((po: PurchaseOrder) => {
        po.items?.forEach((item) => {
          if (item.id === itemId) item.quantity_received = quantityReceived;
        });
      });
    });
    return;
  }

  const sb = getSupabase();
  const { error } = await sb.from("purchase_order_items").update({ quantity_received: quantityReceived }).eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function updatePOStatus(poId: string, status: string, notes?: string): Promise<void> {
  if (isDemoMode() || isDemoId(poId)) {
    updateDemoSandbox((data) => {
      const po = data.purchaseOrders.find((p: PurchaseOrder) => p.id === poId);
      if (po) {
        po.status = status as any;
        if (notes !== undefined) po.notes = notes;
      }
    });
    return;
  }

  const sb = getSupabase();
  const payload: Record<string, unknown> = { status };
  if (notes !== undefined) payload.notes = notes;
  const { error } = await sb.from("purchase_orders").update(payload).eq("id", poId);
  if (error) throw new Error(error.message);
}

export async function createStockTransfer(transfer: Record<string, unknown>): Promise<void> {
  if (isDemoMode() || isDemoId(transfer.source_vendor_id as string)) {
    const newSt: StockTransfer = {
      id: `demo-st-${Date.now()}`,
      source_vendor_id: String(transfer.source_vendor_id),
      target_vendor_id: String(transfer.target_vendor_id),
      product_id: String(transfer.product_id),
      batch_id: (transfer.batch_id as string) || null,
      quantity: Number(transfer.quantity || 1),
      status: (transfer.status as any) || "in_transit",
      notes: (transfer.notes as string) || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    updateDemoSandbox((data) => {
      data.stockTransfers.unshift(newSt);
    });
    return;
  }

  const sb = getSupabase();
  const { error } = await sb.from("stock_transfers").insert(transfer);
  if (error) throw new Error(error.message);
}

export async function updateTransferStatus(transfer: StockTransfer, status: string): Promise<void> {
  if (isDemoMode() || isDemoId(transfer.id)) {
    updateDemoSandbox((data) => {
      const st = data.stockTransfers.find((t: StockTransfer) => t.id === transfer.id);
      if (st) {
        st.status = status as any;
        st.updated_at = new Date().toISOString();
      }
    });
    return;
  }

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

// ─── NOTIFICATIONS ──────────────────────────────────────────────────────────

export async function createNotification(payload: {
  vendor_id?: string | null;
  title: string;
  message: string;
  module: string;
  module_ref_id?: string | null;
}): Promise<void> {
  if (isDemoMode()) {
    const newNotif: AppNotification = {
      id: `demo-notif-${Date.now()}`,
      vendor_id: payload.vendor_id ?? null,
      title: payload.title,
      message: payload.message,
      module: payload.module as any,
      module_ref_id: payload.module_ref_id ?? null,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    updateDemoSandbox((data) => {
      data.notifications.unshift(newNotif);
    });
    return;
  }

  const sb = getSupabase();
  try {
    await sb.from("notifications").insert({
      vendor_id: payload.vendor_id ?? null,
      title: payload.title,
      message: payload.message,
      module: payload.module,
      module_ref_id: payload.module_ref_id ?? null,
    });
  } catch {
    /* Silently fail if table doesn't exist yet */
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  if (isDemoMode() || isDemoId(id)) {
    updateDemoSandbox((data) => {
      const n = data.notifications.find((notif: AppNotification) => notif.id === id);
      if (n) n.is_read = true;
    });
    return;
  }

  const sb = getSupabase();
  const { error } = await sb.from("notifications").update({ is_read: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(vendorId: string | null): Promise<void> {
  if (isDemoMode() || (vendorId && isDemoId(vendorId))) {
    updateDemoSandbox((data) => {
      data.notifications.forEach((n: AppNotification) => {
        if (!vendorId || n.vendor_id === vendorId) n.is_read = true;
      });
    });
    return;
  }

  const sb = getSupabase();
  let query = sb.from("notifications").update({ is_read: true });
  if (vendorId) {
    query = query.eq("vendor_id", vendorId);
  } else {
    query = query.is("vendor_id", null);
  }
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function createWebhookEndpointDB(endpoint: Omit<WebhookEndpoint, "id">): Promise<WebhookEndpoint> {
  if (isDemoMode()) {
    const newEp: WebhookEndpoint = { id: `wh-${Date.now()}`, ...endpoint };
    return newEp;
  }
  const sb = getSupabase();
  const { data, error } = await sb.from("webhook_endpoints").insert(endpoint).select().single();
  if (error) throw new Error(error.message);
  return data as WebhookEndpoint;
}

export async function deleteWebhookEndpointDB(id: string): Promise<void> {
  if (isDemoMode() || isDemoId(id)) return;
  const sb = getSupabase();
  const { error } = await sb.from("webhook_endpoints").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function recordDeliveryLogDB(log: Omit<DeliveryLog, "id">): Promise<void> {
  if (isDemoMode()) return;
  const sb = getSupabase();
  try {
    await sb.from("delivery_logs").insert({
      event_id: log.eventId,
      event: log.event,
      target_url: log.targetUrl,
      status_code: log.statusCode,
      duration_ms: log.durationMs,
      payload_snippet: log.payloadSnippet,
    });
  } catch {}
}