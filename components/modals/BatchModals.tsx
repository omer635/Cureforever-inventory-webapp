"use client";

import React, { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import type { ProductBatch } from "@/lib/types";
import { fmtDate, isProductVisible, safeNum } from "@/lib/utils";

interface BatchModalsProps {
  batch: ProductBatch | null;
  /** When set (vendor "Receive Stock" flow), the vendor is fixed and hidden from the form, and
   * the product picker is limited to products visible to that vendor. */
  lockVendorId?: string;
}

export default function BatchModals({ batch, lockVendorId }: BatchModalsProps) {
  const { products, vendors: allVendors, visibilityMap, refreshAll, toast, closeModal } = useApp();
  // A batch belongs to a real vendor store, never the HQ Admin account itself.
  const vendors = allVendors.filter((v) => !v.is_admin);
  const [productId, setProductId] = useState(batch?.product_id || "");
  const [vendorId, setVendorId] = useState(batch?.vendor_id || lockVendorId || "");
  const pickableProducts = useMemo(
    () => (lockVendorId ? products.filter((p) => isProductVisible(p.id, lockVendorId, visibilityMap)) : products),
    [products, lockVendorId, visibilityMap]
  );
  const [batchNumber, setBatchNumber] = useState(batch?.batch_number || "");
  const [quantity, setQuantity] = useState(batch ? String(batch.quantity) : "");
  const [rate, setRate] = useState(batch ? String(batch.rate ?? "") : "");
  const [received, setReceived] = useState(batch?.received_date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [mfg, setMfg] = useState(batch?.mfg_date?.slice(0, 10) || "");
  const [expiry, setExpiry] = useState(batch?.expiry_date?.slice(0, 10) || "");
  const [supplier, setSupplier] = useState(batch?.supplier || "");
  const [notes, setNotes] = useState(batch?.notes || "");
  const [status, setStatus] = useState(batch?.status || "active");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!productId || !vendorId || safeNum(quantity) <= 0) {
      toast("Product, vendor and a positive quantity are required");
      return;
    }
    setBusy(true);
    try {
      const generatedBatchNo = `BN-${Date.now().toString().slice(-6)}`;
      const payload = {
        product_id: productId,
        vendor_id: vendorId,
        batch_number: batchNumber.trim() || generatedBatchNo,
        quantity: safeNum(quantity),
        rate: rate ? safeNum(rate) : 0,
        received_date: received || new Date().toISOString().slice(0, 10),
        mfg_date: mfg || null,
        expiry_date: expiry || null,
        supplier: supplier || null,
        notes: notes || null,
      };
      if (batch) {
        await api.updateBatch(batch.id, { ...payload, status });
        toast("Batch updated");
      } else {
        await api.createBatch({ ...payload, status: "active" });
        toast("Batch created");
      }
      await refreshAll();
      closeModal();
    } catch (err) {
      toast("Save failed: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button className="modal-close" onClick={closeModal}>
        ×
      </button>
      <h3>{batch ? "Manage Batch" : lockVendorId ? "Receive Stock" : "Create Batch"}</h3>
      <p className="modal-sub">
        {batch
          ? `Batch received ${fmtDate(batch.received_date)}`
          : lockVendorId
            ? "Record a new shipment you've received — it's added to your on-hand stock immediately."
            : "Register a new stock batch."}
      </p>
      <label>Product</label>
      <select value={productId} onChange={(e) => setProductId(e.target.value)}>
        <option value="">Select product…</option>
        {pickableProducts.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.sku})
          </option>
        ))}
      </select>
      {!lockVendorId && (
        <>
          <label>Vendor</label>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Select vendor…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </>
      )}
      <div className="inline-form-grid">
        <div>
          <label>Batch No (optional)</label>
          <input
            placeholder="e.g. BN-89012 (auto if empty)"
            value={batchNumber}
            onChange={(e) => setBatchNumber(e.target.value)}
          />
        </div>
        <div>
          <label>Quantity</label>
          <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div>
          <label>Rate (cost / unit)</label>
          <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <div>
          <label>Received date</label>
          <input type="date" value={received} onChange={(e) => setReceived(e.target.value)} />
        </div>
        <div>
          <label>Mfg date</label>
          <input type="date" value={mfg} onChange={(e) => setMfg(e.target.value)} />
        </div>
        <div>
          <label>Expiry date</label>
          <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </div>
        <div>
          <label>Supplier</label>
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </div>
      </div>
      <label>Notes</label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      {batch && (
        <>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ProductBatch["status"])}>
            <option value="active">Active</option>
            <option value="recalled">Recalled</option>
            <option value="expired">Expired</option>
          </select>
        </>
      )}
      <div className="modal-actions">
        <button className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
        <button className="save-btn" onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : batch ? "Save Changes" : lockVendorId ? "Receive Stock" : "Create Batch"}
        </button>
      </div>
    </div>
  );
}