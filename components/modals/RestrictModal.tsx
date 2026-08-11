"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import type { ProductVisibility } from "@/lib/types";

export default function RestrictModal({ productId }: { productId: string }) {
  const { products, vendors, productVisibility, refreshAll, toast, closeModal } = useApp();
  const product = products.find((p) => p.id === productId);
  const current = new Set(
    (productVisibility || []).filter((pv) => pv.product_id === productId).map((pv) => pv.vendor_id)
  );
  const [selected, setSelected] = useState<Set<string>>(new Set(current));
  const [busy, setBusy] = useState(false);

  if (!product) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveRestrict = async (vendorIds: string[]) => {
    setBusy(true);
    try {
      await api.setProductVisibility(productId, vendorIds);
      await refreshAll();
      toast(vendorIds.length === 0 ? "Product now visible to all vendors" : `Visible to ${vendorIds.length} vendor(s)`);
      closeModal();
    } catch (err) {
      toast("Failed: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button className="modal-close" onClick={closeModal}>
        ×
      </button>
      <h3>Restrict Visibility</h3>
      <p className="modal-sub">
        {product.name} · SKU {product.sku}. Tick the vendors allowed to see this product. Unticking all makes it
        visible to everyone.
      </p>
      <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #E7E2D6", borderRadius: 3, padding: "8px 12px" }}>
        {vendors.map((v) => (
          <div key={v.id} className="check-row">
            <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} />
            {v.name}
            {v.is_admin ? " (admin)" : ""}
          </div>
        ))}
        {vendors.length === 0 && <div className="empty">No vendors found.</div>}
      </div>
      <div className="modal-actions">
        <button className="btn-secondary" onClick={() => void saveRestrict([])} disabled={busy}>
          Allow All
        </button>
        <button className="save-btn" onClick={() => void saveRestrict([...selected])} disabled={busy}>
          {busy ? "Saving…" : "Save Restrictions"}
        </button>
      </div>
    </div>
  );
}

export type { ProductVisibility };