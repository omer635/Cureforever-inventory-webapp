"use client";

import React, { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { cleanText, downloadCSV, fmtDate, money } from "@/lib/utils";

export default function AdminProducts() {
  const { products, vendors, stockEntries, productBatches, visibilityMap, openModal, toast } = useApp();
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...products]
      .filter((p) => !q || cleanText(p.name).toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q))
      .sort((a, b) => cleanText(a.name).localeCompare(cleanText(b.name)));
  }, [products, search]);

  const stockTotals = useMemo(() => {
    const map: Record<string, { qty: number; value: number }> = {};
    stockEntries.forEach((e) => {
      const batch = productBatches.find((b) => b.id === e.batch_id);
      if (!map[e.product_id]) map[e.product_id] = { qty: 0, value: 0 };
      map[e.product_id].qty += Number(e.quantity) || 0;
      map[e.product_id].value += (Number(e.quantity) || 0) * (batch?.rate ?? 0);
    });
    return map;
  }, [stockEntries, productBatches]);

  const restrictedCount = (productId: string) => visibilityMap[productId]?.size || 0;

  const exportCSV = () => {
    const header = ["Name", "SKU", "Category", "Cost", "Selling", "Low threshold", "Reorder threshold", "Barcode", "Total qty", "Stock value"];
    const data = rows.map((p) => [
      p.name,
      p.sku,
      p.category || "",
      money(p.cost_price ?? 0),
      money(p.selling_price ?? 0),
      p.low_stock_threshold,
      p.reorder_threshold ?? "",
      p.barcode || "",
      stockTotals[p.id]?.qty ?? 0,
      money(stockTotals[p.id]?.value ?? 0),
    ]);
    downloadCSV(`products-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
    toast("Products exported");
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Products ({rows.length})</h2>
        <div className="filters">
          <input className="search-input" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="export-btn" onClick={exportCSV}>
            Export CSV
          </button>
          <button className="btn-add-vendor" onClick={() => openModal({ type: "product", product: null })}>
            + New Product
          </button>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Cost</th>
              <th>Selling</th>
              <th>Threshold</th>
              <th>In stock</th>
              <th>Stock value</th>
              <th>Visibility</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="empty">
                  No products found.
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const rc = restrictedCount(p.id);
              return (
                <tr key={p.id}>
                  <td>
                    <strong>{cleanText(p.name)}</strong>
                    {p.description && <div className="sku">{p.description}</div>}
                  </td>
                  <td className="sku">{p.sku}</td>
                  <td>{p.category || "—"}</td>
                  <td>{money(p.cost_price ?? 0)}</td>
                  <td>{money(p.selling_price ?? 0)}</td>
                  <td>
                    {p.low_stock_threshold}
                    {p.reorder_threshold ? ` / ${p.reorder_threshold}` : ""}
                  </td>
                  <td>{stockTotals[p.id]?.qty ?? 0}</td>
                  <td>{money(stockTotals[p.id]?.value ?? 0)}</td>
                  <td>
                    {rc > 0 ? (
                      <button className="link-btn" onClick={() => openModal({ type: "restrict", productId: p.id })}>
                        {rc} vendor{rc === 1 ? "" : "s"} only
                      </button>
                    ) : (
                      <span className="state-tag">ALL</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="link-btn" onClick={() => openModal({ type: "product", product: p })}>
                        Edit
                      </button>
                      <button className="link-btn" onClick={() => openModal({ type: "restrict", productId: p.id })}>
                        Restrict
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: "#6B7280", padding: "6px 16px 12px" }}>
        Vendors in system: {vendors.length} · {fmtDate(new Date().toISOString())}
      </div>
    </div>
  );
}