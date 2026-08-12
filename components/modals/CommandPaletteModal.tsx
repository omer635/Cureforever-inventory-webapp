"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppProvider";

import { cleanText } from "@/lib/utils";

export default function CommandPaletteModal() {
  const { products, vendors, productBatches, purchaseOrders, openModal, closeModal } = useApp();
  const [query, setQuery] = useState("");

  const results = React.useMemo(() => {
    if (!query.trim()) {
      return [
        { type: "action", title: "+ Add New Product", category: "Quick Action", action: () => openModal({ type: "product", product: null }) },
        { type: "action", title: "+ Provision Vendor Account", category: "Quick Action", action: () => openModal({ type: "addVendor" }) },
        { type: "action", title: "+ Add Product Batch", category: "Quick Action", action: () => openModal({ type: "createBatch" }) },
        { type: "action", title: "Print Barcode & QR Labels", category: "Tool", action: () => openModal({ type: "labelStudio" }) },
        { type: "action", title: "Bulk Data Import (CSV/JSON)", category: "Tool", action: () => openModal({ type: "dataImport" }) },
        { type: "action", title: "+ Create Purchase Order", category: "Procurement", action: () => openModal({ type: "createPO" }) },
        { type: "action", title: "Launch Barcode Scanner", category: "Tool", action: () => openModal({ type: "scanner" }) },
      ];
    }

    const q = query.toLowerCase();
    const matches: { type: string; title: string; subtitle?: string; category: string; action: () => void }[] = [];

    products.forEach((p) => {
      const name = cleanText(p.name);
      if (name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode || "").includes(q)) {
        matches.push({
          type: "product",
          title: name,
          subtitle: `SKU: ${p.sku} · Price: $${p.selling_price}`,
          category: "Product Catalog",
          action: () => openModal({ type: "product", product: p }),
        });
      }
    });

    vendors.forEach((v) => {
      if (v.name.toLowerCase().includes(q) || (v.email || "").toLowerCase().includes(q)) {
        matches.push({
          type: "vendor",
          title: v.name,
          subtitle: v.email || v.address || "Vendor Store",
          category: "Vendor Stores",
          action: () => openModal({ type: "editVendor", vendor: v }),
        });
      }
    });

    productBatches.forEach((b) => {
      const bn = b.batch_number || "";
      if (bn.toLowerCase().includes(q) || (b.supplier || "").toLowerCase().includes(q)) {
        matches.push({
          type: "batch",
          title: `Batch #${bn}`,
          subtitle: `Expires: ${b.expiry_date} · Status: ${b.status}`,
          category: "Batches",
          action: () => openModal({ type: "manageBatch", batch: b }),
        });
      }
    });

    purchaseOrders.forEach((po) => {
      if (po.po_number.toLowerCase().includes(q) || po.supplier.toLowerCase().includes(q)) {
        matches.push({
          type: "po",
          title: `PO #${po.po_number}`,
          subtitle: `Supplier: ${po.supplier} · Status: ${po.status}`,
          category: "Purchase Orders",
          action: () => openModal({ type: "viewPO", po }),
        });
      }
    });

    return matches;
  }, [query, products, vendors, productBatches, purchaseOrders, openModal]);

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 620,
          borderRadius: 12,
          padding: 0,
          overflow: "hidden",
          border: "1px solid #334155",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
          animation: "scaleUp 0.15s ease",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 12, background: "#F8FAFC" }}>
          <span style={{ fontSize: 18, color: "#64748B" }}>🔍</span>
          <input
            type="text"
            autoFocus
            placeholder="Type a command, product, SKU, batch, or vendor (Press Esc to exit)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                closeModal();
              }
            }}
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              outline: "none",
              fontSize: 15,
              color: "#0F172A",
              fontWeight: 500,
            }}
          />
          <kbd style={{ background: "#E2E8F0", padding: "2px 6px", borderRadius: 4, fontSize: 11, color: "#475569" }}>ESC</kbd>
        </div>

        <div style={{ maxHeight: 380, overflowY: "auto", padding: "8px 0" }}>
          {results.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#64748B", fontSize: 14 }}>
              No matches found for &quot;{query}&quot;
            </div>
          ) : (
            results.map((res, idx) => (
              <div
                key={idx}
                onClick={() => {
                  res.action();
                }}
                style={{
                  padding: "10px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  borderBottom: "1px solid #F1F5F9",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "#0F172A", fontSize: 14 }}>{res.title}</div>
                  {res.subtitle && <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{res.subtitle}</div>}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "#E0F2FE",
                    color: "#0369A1",
                  }}
                >
                  {res.category}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
