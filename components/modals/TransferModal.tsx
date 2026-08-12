"use client";

import React, { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";

export default function TransferModal() {
  const { products, vendors: allVendors, stockEntries, closeModal, toast, refreshAll, isOnline, queueOp } = useApp();
  // Stock transfers move inventory between real vendor stores, not to/from the HQ Admin account.
  const vendors = allVendors.filter((v) => !v.is_admin);
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [sourceVendorId, setSourceVendorId] = useState(vendors[0]?.id || "");
  const [targetVendorId, setTargetVendorId] = useState(vendors[1]?.id || vendors[0]?.id || "");
  const [quantity, setQuantity] = useState(10);
  const [notes, setNotes] = useState("");

  const availableAtSource = useMemo(
    () => stockEntries.find((e) => e.vendor_id === sourceVendorId && e.product_id === productId)?.quantity ?? 0,
    [stockEntries, sourceVendorId, productId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceVendorId === targetVendorId) {
      toast("Source and target locations must be different");
      return;
    }
    if (quantity > availableAtSource) {
      toast(`Source only has ${availableAtSource} units on hand — reduce the transfer quantity`);
      return;
    }

    const payload = {
      product_id: productId,
      source_vendor_id: sourceVendorId,
      target_vendor_id: targetVendorId,
      quantity,
      status: "pending",
      notes: notes || null,
    };

    try {
      if (isOnline) {
        await api.createStockTransfer(payload);
        toast("Stock transfer request submitted!");
        await refreshAll();
      } else {
        queueOp({
          type: "transfer_create",
          data: payload,
        });
        toast("Saved offline: Transfer request queued");
      }
      closeModal();
    } catch (err) {
      toast("Error creating transfer: " + (err as Error).message);
    }
  };

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, borderRadius: 8, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "#0F1F3D" }}>🚚 Request Stock Transfer</h2>
          <button className="btn-ghost" onClick={closeModal}>
            ✕ Close
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Select Product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: 4, borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>From (Source)</label>
              <select
                value={sourceVendorId}
                onChange={(e) => setSourceVendorId(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: 4, borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>To (Destination)</label>
              <select
                value={targetVendorId}
                onChange={(e) => setTargetVendorId(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: 4, borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Transfer Quantity</label>
            <input
              type="number"
              min="1"
              max={availableAtSource}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              required
              style={{ width: "100%", padding: "8px", marginTop: 4, borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
            />
            <div style={{ fontSize: 11, color: quantity > availableAtSource ? "#DC2626" : "#6B7280", marginTop: 4 }}>
              {availableAtSource} units on hand at the source location
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Notes & Reason</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Stock rebalancing for peak weekend demand"
              style={{ width: "100%", padding: "8px", marginTop: 4, borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn-ghost" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" className="btn-add-vendor" style={{ padding: "8px 20px" }}>
              Submit Transfer Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
