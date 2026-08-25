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
  const [imageUrl, setImageUrl] = useState(product?.image_url || "");
  const [busy, setBusy] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setImageUrl(evt.target.result as string);
        toast("Product image uploaded");
      }
    };
    reader.readAsDataURL(file);
  };

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
        image_url: imageUrl.trim() || null,
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

  const handleDelete = async () => {
    if (!product) return;
    if (confirm(`Are you sure you want to delete product "${product.name}"? This action cannot be undone.`)) {
      setBusy(true);
      try {
        await api.deleteProductRow(product.id);
        await refreshAll();
        toast("Product deleted");
        closeModal();
      } catch (err) {
        toast("Delete failed: " + (err as Error).message);
      } finally {
        setBusy(false);
      }
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
      <input value={name} onChange={(e) => setName(e.target.value)} data-testid="product-name-input" />
      <div className="inline-form-grid">
        <div>
          <label>SKU</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} data-testid="product-sku-input" />
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

      {/* Product Image Section */}
      <div style={{ marginTop: 12, marginBottom: 12, background: "#F8FAFC", padding: 12, borderRadius: 6, border: "1px solid #E2E8F0" }}>
        <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13, color: "#0F172A" }}>
          🖼️ Product Image (URL or Local Upload)
        </label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {imageUrl ? (
            <img src={imageUrl} alt="Product Preview" style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover", border: "1px solid #CBD5E1", background: "#FFF" }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 6, border: "1px border-dashed #CBD5E1", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
              📦
            </div>
          )}
          <input
            type="text"
            placeholder="Paste image URL (https://...)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            style={{ flex: 1, padding: "7px 10px", borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 13 }}
            data-testid="product-image-url-input"
          />
          <label
            style={{
              padding: "7px 12px",
              background: "#FFF",
              border: "1px solid #CBD5E1",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            📁 Upload File
            <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} data-testid="product-image-file-input" />
          </label>
        </div>
      </div>

      <label>Description</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <div className="modal-actions" style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
        {product ? (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={busy}
            style={{ background: "transparent", color: "#B3261E", border: "1px solid #B3261E", padding: "8px 14px", borderRadius: 3, cursor: "pointer", fontSize: 13 }}
          >
            Delete Product
          </button>
        ) : <div />}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-secondary" onClick={closeModal}>
            Cancel
          </button>
          <button className="save-btn" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}