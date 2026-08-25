"use client";

import React, { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { batchDisplayStatus, batchStatusBadge, computeVendorRowsAll, daysUntil, downloadCSV, money, sortRows, stockStatus } from "@/lib/utils";

const FILTER_LABELS: Record<string, string> = {
  all: "All Stock",
  low: "Low Stock",
  expiring: "Expiring Soon",
  expired: "Expired",
};

export default function AdminAllStock() {
  const { products, productBatches, vendors, stockEntries, visibilityMap, openModal, toast } = useApp();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortKey, setSortKey] = useState("vendor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))] as string[], [products]);

  const rows = useMemo(() => {
    let r = computeVendorRowsAll(stockEntries, productBatches, products, vendors);
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((x) => (x.product.name || "").toLowerCase().includes(q) || (x.product.sku || "").toLowerCase().includes(q) || (x.vendor?.name || "").toLowerCase().includes(q));
    if (category !== "all") r = r.filter((x) => x.product.category === category);
    if (filter === "low") r = r.filter((x) => stockStatus(x.product, x.entry.quantity) !== "in");
    if (filter === "expiring") r = r.filter((x) => { const d = daysUntil(x.batch?.expiry_date); return d !== null && d >= 0 && d <= 30; });
    if (filter === "expired") r = r.filter((x) => { const d = daysUntil(x.batch?.expiry_date); return d !== null && d < 0; });
    return sortRows(r, sortKey, sortDir);
  }, [stockEntries, productBatches, products, vendors, filter, search, category, sortKey, sortDir]);

  const setSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const exportCSV = () => {
    const header = ["Vendor", "Product", "SKU", "Category", "Qty", "Cost", "Rate", "Value", "Status", "Expiry"];
    const data = rows.map((r) => [
      r.vendor?.name || "",
      r.product.name,
      r.product.sku,
      r.product.category || "",
      r.entry.quantity,
      money(r.product.cost_price ?? 0),
      money(r.batch?.rate ?? 0),
      money((r.batch?.rate ?? r.product.cost_price ?? 0) * r.entry.quantity),
      stockStatus(r.product, r.entry.quantity),
      r.batch?.expiry_date?.slice(0, 10) || "",
    ]);
    downloadCSV(`all-stock-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
    toast("CSV exported");
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>All Stock ({rows.length} lines)</h2>
        <div className="filters">
          <input className="search-input" placeholder="Search vendor, product, SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="reason-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {Object.entries(FILTER_LABELS).map(([k, v]) => (
            <button key={k} className={`chip ${filter === k ? "active" : ""}`} onClick={() => setFilter(k)}>
              {v}
            </button>
          ))}
          <button className="export-btn" onClick={exportCSV}>
            Export CSV
          </button>
          <button className="export-btn alt" onClick={() => void import("@/lib/xlsxExport").then((m) => m.exportAllStockXLSX(rows))}>
            Export XLSX
          </button>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Vendor</th>
              <th className="sortable" onClick={() => setSort("name")}>
                Product
              </th>
              <th>SKU</th>
              <th className="sortable" onClick={() => setSort("qty")}>
                Qty
              </th>
              <th>Status</th>
              <th className="sortable" onClick={() => setSort("expiry")}>
                Batch / Expiry
              </th>
              <th>Rate</th>
              <th>Value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">
                  No stock lines match.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const status = stockStatus(r.product, r.entry.quantity);
              const label = batchDisplayStatus(r.batch ?? { status: "active" });
              const b = batchStatusBadge(label);
              const restricted = (visibilityMap[r.product.id]?.size || 0) > 0;
              return (
                <tr key={r.entry.id}>
                  <td>{r.vendor?.name || "—"}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {r.product.image_url ? (
                        <img src={r.product.image_url} alt={r.product.name} style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", border: "1px solid #E2E8F0" }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: 6, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                          📦
                        </div>
                      )}
                      <div>
                        <strong>{r.product.name}</strong>
                        {restricted && <span className="badge purple" style={{ marginLeft: 6 }}>RESTRICTED</span>}
                      </div>
                    </div>
                  </td>
                  <td className="sku">{r.product.sku}</td>
                  <td>{r.entry.quantity}</td>
                  <td>
                    <span className={status === "out" ? "badge danger" : status === "low" ? "badge warn" : "badge ok"}>
                      {status === "out" ? "OUT" : status === "low" ? "LOW" : "IN"}
                    </span>
                  </td>
                  <td>
                    <span className={b.cls}>{b.label}</span>
                    <div className="sku">{r.batch?.expiry_date ? `exp ${r.batch.expiry_date.slice(0, 10)}` : "—"}</div>
                  </td>
                  <td>{money(r.batch?.rate ?? 0)}</td>
                  <td>{money((r.batch?.rate ?? r.product.cost_price ?? 0) * r.entry.quantity)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="link-btn" onClick={() => openModal({ type: "history", entry: r.entry })}>
                        History
                      </button>
                      <button className="link-btn" onClick={() => openModal({ type: "restrict", productId: r.product.id })}>
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
    </div>
  );
}