"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import type { StockEntry } from "@/lib/types";
import { safeInt } from "@/lib/utils";

export default function ReorderModal({ entry }: { entry: StockEntry }) {
  const { products, vendorRow, queueOp, refreshAll, toast, closeModal } = useApp();
  const product = products.find((p) => p.id === entry.product_id);
  const [quantity, setQuantity] = useState(Math.max(safeInt(product?.reorder_threshold ?? product?.low_stock_threshold, 10), 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  if (!product || !vendorRow) return null;

  const submit = async () => {
    if (quantity <= 0) {
      toast("Quantity must be greater than zero");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        vendor_id: vendorRow.id,
        product_id: product.id,
        batch_id: entry.batch_id,
        requested_qty: quantity,
        quantity,
        note: notes || null,
        notes: notes || null,
        status: "pending",
        created_at: new Date().toISOString(),
      };
      queueOp({ type: "reorder", data: payload });
      await api.createReorder(payload);

      // Auto-notify HQ Admin of the reorder request
      await api.createNotification({
        vendor_id: null, // HQ Admin
        title: `Reorder Request: ${product.name}`,
        message: `${vendorRow.name} requested ${quantity} units of ${product.name}.${notes ? ` Note: "${notes}"` : ""}`,
        module: "stock",
      });

      await refreshAll();
      toast("Reorder request sent to admin");
      closeModal();
    } catch (err) {
      toast("Could not send request: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button className="modal-close" onClick={closeModal}>
        ×
      </button>
      <h3>Request Reorder</h3>
      <p className="modal-sub">
        {product.name} · SKU {product.sku}
      </p>
      <label>Quantity</label>
      <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)} />
      <label>Notes</label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Why is this stock needed?" />
      <div className="modal-actions">
        <button className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
        <button className="save-btn" onClick={() => void submit()} disabled={busy}>
          {busy ? "Sending…" : "Send Request"}
        </button>
      </div>
    </div>
  );
}