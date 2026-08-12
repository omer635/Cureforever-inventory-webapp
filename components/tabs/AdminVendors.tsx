"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import { computeVendorRows, computeVendorRowsAll, downloadCSV, fmtDateTime, money, stockStatus, cleanText } from "@/lib/utils";

export default function AdminVendors() {
  const { vendors, products, productBatches, stockEntries, visibilityMap, refreshAll, toast, openModal } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(vendors[0]?.id ?? null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selected = vendors.find((v) => v.id === selectedId) || vendors[0] || null;

  const selectedRows = useMemo(() => {
    if (!selected) return [];
    return computeVendorRows(stockEntries, selected.id, visibilityMap, productBatches, products);
  }, [selected, stockEntries, visibilityMap, productBatches, products]);

  const allRows = useMemo(
    () => computeVendorRowsAll(stockEntries, productBatches, products, vendors),
    [stockEntries, productBatches, products, vendors]
  );

  const vendorTotals = useMemo(() => {
    const map: Record<string, { value: number; lines: number }> = {};
    allRows.forEach((r) => {
      const k = r.vendor?.id || "?";
      if (!map[k]) map[k] = { value: 0, lines: 0 };
      map[k].value += (r.batch?.rate ?? r.product.cost_price ?? 0) * r.entry.quantity;
      map[k].lines += 1;
    });
    return map;
  }, [allRows]);

  const doughRef = useRef<HTMLCanvasElement | null>(null);
  const barRef = useRef<HTMLCanvasElement | null>(null);
  const doughChart = useRef<Chart | null>(null);
  const barChart = useRef<Chart | null>(null);

  useEffect(() => {
    if (!doughRef.current) return;
    if (doughChart.current) doughChart.current.destroy();

    const cats: Record<string, number> = {};
    selectedRows.forEach((r) => {
      const cat = r.product.category || "General";
      const val = (r.batch?.rate ?? r.product.cost_price ?? 0) * r.entry.quantity;
      cats[cat] = (cats[cat] || 0) + val;
    });
    const labels = Object.keys(cats);
    const data = Object.values(cats);

    doughChart.current = new Chart(doughRef.current, {
      type: "doughnut",
      data: {
        labels: labels.length > 0 ? labels : ["No Stock"],
        datasets: [
          {
            data: data.length > 0 ? data : [1],
            backgroundColor: ["#0F1F3D", "#B8935A", "#2F6B4F", "#5B21B6", "#B3261E", "#0284C7"],
            borderWidth: 1,
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right" } } },
    });

    return () => {
      if (doughChart.current) doughChart.current.destroy();
    };
  }, [selectedRows]);

  useEffect(() => {
    if (!barRef.current) return;
    if (barChart.current) barChart.current.destroy();
    if (selectedRows.length === 0) return;

    const top = [...selectedRows].sort((a, b) => b.entry.quantity - a.entry.quantity).slice(0, 7);

    barChart.current = new Chart(barRef.current, {
      type: "bar",
      data: {
        labels: top.map((r) => cleanText(r.product.name).slice(0, 15) + "..."),
        datasets: [
          {
            label: "Stock Units On Hand",
            data: top.map((r) => r.entry.quantity),
            backgroundColor: "#1C2E52",
            borderRadius: 4,
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });

    return () => {
      if (barChart.current) barChart.current.destroy();
    };
  }, [selectedRows]);

  const remove = async (id: string) => {
    if (!window.confirm("Delete this vendor location and its store stock?")) return;
    setDeletingId(id);
    try {
      await api.deleteVendorRow(id);
      await refreshAll();
      toast("Vendor location removed");
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      toast("Delete failed: " + (err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {/* Main Vendor Summary Table */}
      <div className="panel">
        <div className="panel-head">
          <h2>🏬 Vendor Locations & Store Accounts ({vendors.length})</h2>
          <button className="btn-add-vendor" onClick={() => openModal({ type: "addVendor" })}>
            + Add Vendor Location
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Store / Vendor Name</th>
                <th>Location / Address</th>
                <th>Email (Login)</th>
                <th>Phone</th>
                <th>Stock Lines</th>
                <th>Total Valuation</th>
                <th>Access Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => {
                const t = vendorTotals[v.id];
                const isSel = selected?.id === v.id;
                return (
                  <tr key={v.id} style={{ background: isSel ? "#FDF8F0" : undefined }}>
                    <td>
                      <strong>{v.name}</strong>
                    </td>
                    <td>
                      <span className="state-tag" style={{ background: "#E2E8F0", color: "#1E293B" }}>
                        📍 {v.address || v.state || "HQ Location"}
                      </span>
                    </td>
                    <td>{v.email || "—"}</td>
                    <td>{v.phone || v.contact_phone || "—"}</td>
                    <td>
                      <strong>{t?.lines ?? 0}</strong> lines
                    </td>
                    <td>
                      <strong>{money(t?.value ?? 0, 0)}</strong>
                    </td>
                    <td>
                      {v.is_admin ? <span className="badge purple">HQ ADMIN</span> : <span className="badge info">VENDOR STORE</span>}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="link-btn" onClick={() => setSelectedId(v.id)} style={{ fontWeight: isSel ? 700 : 500 }}>
                          {isSel ? "✓ Selected" : "View Stock & Analytics"}
                        </button>
                        <button className="link-btn" onClick={() => openModal({ type: "editVendor", vendor: v })}>
                          Edit / Reset Pass
                        </button>
                        <button className="link-btn danger-link" onClick={() => void remove(v.id)} disabled={deletingId === v.id}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {vendors.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    No vendor locations created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Vendor Location Details, Charts & Stock Table */}
      {selected && (
        <>
          {/* Vendor Store Analytics Charts */}
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            <div className="panel chart-card" style={{ flex: 1, minWidth: 280, margin: 0 }}>
              <h3>📊 Category Stock Valuation — {selected.name}</h3>
              <div style={{ height: 200, position: "relative" }}>
                <canvas ref={doughRef} />
              </div>
            </div>

            <div className="panel chart-card" style={{ flex: 1.5, minWidth: 320, margin: 0 }}>
              <h3>📈 Top Inventory Units by SKU — {selected.name}</h3>
              <div style={{ height: 200, position: "relative" }}>
                {selectedRows.length > 0 ? (
                  <canvas ref={barRef} />
                ) : (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", fontSize: 13 }}>
                    No active stock lines recorded for this store location.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Vendor Specific Stock Table */}
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>📦 Store Stock Inventory — {selected.name}</h2>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                  Location: 📍 {selected.address || selected.state || "HQ Location"} · Email: {selected.email || "N/A"}
                </div>
              </div>

              <div className="filters">
                <button className="btn-add-vendor" onClick={() => openModal({ type: "receiveStock" })} style={{ padding: "6px 12px" }}>
                  + Allocate / Receive Stock
                </button>
                <button
                  className="export-btn"
                  onClick={() => {
                    const header = ["Product", "SKU", "Qty", "Status", "Rate", "Value"];
                    const data = selectedRows.map((r) => [
                      cleanText(r.product.name),
                      r.product.sku,
                      r.entry.quantity,
                      stockStatus(r.product, r.entry.quantity),
                      money(r.batch?.rate ?? r.product.cost_price ?? 0),
                      money((r.batch?.rate ?? r.product.cost_price ?? 0) * r.entry.quantity),
                    ]);
                    downloadCSV(`vendor-${selected.name.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
                    toast("Exported store stock to CSV");
                  }}
                >
                  Export Store CSV
                </button>
                <button className="link-btn danger-link" onClick={() => void remove(selected.id)}>
                  Delete Location
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>On-Hand Qty</th>
                    <th>Stock Status</th>
                    <th>Unit Cost</th>
                    <th>Batch / Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRows.length === 0 ? (
                    products.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong>{cleanText(p.name)}</strong>
                        </td>
                        <td className="sku">{p.sku}</td>
                        <td>{p.category || "General"}</td>
                        <td>
                          <span style={{ color: "#94A3B8", fontWeight: 600 }}>0 units</span>
                        </td>
                        <td>
                          <span className="badge danger">OUT OF STOCK</span>
                        </td>
                        <td>{money(p.cost_price, 2)}</td>
                        <td>
                          <button
                            className="link-btn"
                            onClick={() => openModal({ type: "createBatch" })}
                            style={{ fontSize: 11 }}
                          >
                            + Receive Batch
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    selectedRows.map((r) => (
                      <tr key={r.entry.id}>
                        <td>
                          <strong>{cleanText(r.product.name)}</strong>
                        </td>
                        <td className="sku">{r.product.sku}</td>
                        <td>{r.product.category || "General"}</td>
                        <td>
                          <strong>{r.entry.quantity}</strong> units
                        </td>
                        <td>
                          <span
                            className={
                              stockStatus(r.product, r.entry.quantity) === "out"
                                ? "badge danger"
                                : stockStatus(r.product, r.entry.quantity) === "low"
                                ? "badge warn"
                                : "badge ok"
                            }
                          >
                            {stockStatus(r.product, r.entry.quantity).toUpperCase()}
                          </span>
                        </td>
                        <td>{money(r.batch?.rate ?? r.product.cost_price ?? 0)}</td>
                        <td>{r.batch?.expiry_date ? fmtDateTime(r.batch.expiry_date) : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}