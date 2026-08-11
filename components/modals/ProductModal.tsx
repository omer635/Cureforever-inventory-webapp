"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import type { Product } from "@/lib/types";
import { safeInt, safeNum } from "@/lib/utils";

export default function ProductModal({ product }: { product: Product | null }) {
  const { closeModal, toast, refreshAll, isAdmin } = useApp();
  const [name, setName] = useState(product?.name || "");
  const [sku, setSku] = useState(product?.sku || "");
  const [category, setCategory] = useState(product?.category || "");
  const [barcode, setBarcode] = useState(product?.barcode || "");
  const [costPrice, setCostPrice] = useState(product ? String(product.cost_price ?? "") : "");
  const [sellingPrice, setSellingPrice] = useState(product ? String(product.selling_price ?? "") : "");
  const [low, setLow] = useState(product ? String(product.low_stock_threshold ?? 10) : "10");
  const [reorder, setReorder] = useState(product?.reorder_threshold != null ? String(product.reorder_threshold) : "");
  const [description, setDescription] = useState(product?.description || "");
  const [busy, setBusy] = useState(false);

  if (!isAdmin) {
    closeModal();
    return null;
  }

  const save = async () => {
    if (!name.trim() || !sku.trim()) {
      toast("Product name and SKU are required");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        sku: sku.trim(),
        category: category || null,
        barcode: barcode || null,
        cost_price: safeNum(costPrice),
        selling_price: safeNum(sellingPrice),
        low_stock_threshold: safeInt(low, 10),
        reorder_threshold: reorder ? safeInt(reorder, 10) : null,
        description: description || null,
      };
      if (product) {
        await api.updateProduct(product.id, payload);
        toast("Product updated");
      } else {
        await api.createProduct(payload);
        toast("Product created");
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
      <h3>{product ? "Edit Product" : "New Product"}</h3>
      <p className="modal-sub">Product master record.</p>
      <label>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <div className="inline-form-grid">
        <div>
          <label>SKU</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
        <div>
          <label>Category</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div>
          <label>Barcode</label>
          <input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        </div>
        <div>
          <label>Low stock threshold</label>
          <input type="number" value={low} onChange={(e) => setLow(e.target.value)} />
        </div>
        <div>
          <label>Reorder threshold</label>
          <input type="number" value={reorder} onChange={(e) => setReorder(e.target.value)} placeholder="defaults to low" />
        </div>
        <div>
          <label>Cost price</label>
          <input type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
        </div>
        <div>
          <label>Selling price</label>
          <input type="number" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
        </div>
      </div>
      <label>Description</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <div className="modal-actions">
        <button className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
        <button className="save-btn" onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}