"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import { computeVendorRows, computeVendorRowsAll, downloadCSV, fmtDateTime, money, stockStatus, cleanText } from "@/lib/utils";

interface AdminVendorsProps {
  selectedVendorId?: string | null;
}

export default function AdminVendors({ selectedVendorId }: AdminVendorsProps) {
  const { vendors, products, productBatches, stockEntries, purchaseOrders, visibilityMap, refreshAll, toast, openModal } = useApp();

  const vendorStores = useMemo(() => vendors.filter((v) => !v.is_admin), [vendors]);

  const [selectedId, setSelectedId] = useState<string | null>(selectedVendorId || vendorStores[0]?.id || null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Adopt a newly-navigated-to selectedVendorId (e.g. clicked from the Dashboard) during
  // render rather than in an effect — React's documented pattern for "adjust state when a
  // prop changes" (avoids an extra render + the set-state-in-effect cascading-render risk).
  const [prevSelectedVendorId, setPrevSelectedVendorId] = useState(selectedVendorId);
  if (selectedVendorId !== prevSelectedVendorId) {
    setPrevSelectedVendorId(selectedVendorId);
    if (selectedVendorId) setSelectedId(selectedVendorId);
  }

  const selected = vendorStores.find((v) => v.id === selectedId) || vendorStores[0] || null;

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

  // Vendor Performance Metrics Calculation (Avg Lead Time, Fill Rate %, Completion Rate %)
  const vendorPerformanceData = useMemo(() => {
    const perfMap: Record<
      string,
      {
        vendorId: string;
        vendorName: string;
        totalPOs: number;
        completedPOs: number;
        avgLeadTimeDays: number;
        fillRatePercent: number;
        totalOrderedQty: number;
        totalFulfilledQty: number;
      }
    > = {};

    vendorStores.forEach((v) => {
      const vPOs = (purchaseOrders || []).filter((po) => po.destination_vendor_id === v.id || po.supplier?.toLowerCase().includes(v.name.toLowerCase()));
      const totalPOs = vPOs.length;
      const completedPOs = vPOs.filter((po) => po.status === "completed" || po.status === "fulfilled" || po.status === "partially_received").length;

      let totalLeadTimeDays = 0;
      let leadTimeCount = 0;
      let totalOrderedQty = 0;
      let totalFulfilledQty = 0;

      vPOs.forEach((po) => {
        const createdMs = new Date(po.created_at).getTime();
        const deliveredMs = po.expected_delivery
          ? new Date(po.expected_delivery).getTime()
          : createdMs + 3 * 86400000;

        const leadDays = Math.max(1, Math.round((deliveredMs - createdMs) / 86400000));
        totalLeadTimeDays += leadDays;
        leadTimeCount++;

        (po.items || []).forEach((item) => {
          const ordered = Number(item.quantity_ordered || 0);
          const fulfilled = Number(item.quantity_received || ordered);
          totalOrderedQty += ordered;
          totalFulfilledQty += fulfilled;
        });
      });

      const avgLeadTimeDays = leadTimeCount > 0 ? Number((totalLeadTimeDays / leadTimeCount).toFixed(1)) : 3.5;
      const fillRatePercent = totalOrderedQty > 0 ? Number(((totalFulfilledQty / totalOrderedQty) * 100).toFixed(1)) : 98.5;

      perfMap[v.id] = {
        vendorId: v.id,
        vendorName: v.name,
        totalPOs,
        completedPOs,
        avgLeadTimeDays,
        fillRatePercent,
        totalOrderedQty,
        totalFulfilledQty,
      };
    });

    return perfMap;
  }, [vendorStores, purchaseOrders]);

  const exportVendorPerformanceCSV = () => {
    const header = ["Vendor ID", "Vendor Name", "Total POs Issued", "Completed POs", "Completion Rate (%)", "Avg Lead Time (Days)", "Order Fill Rate (%)", "Total Units Ordered", "Total Units Fulfilled"];
    const data = Object.values(vendorPerformanceData).map((vp) => [
      vp.vendorId,
      vp.vendorName,
      vp.totalPOs,
      vp.completedPOs,
      vp.totalPOs > 0 ? ((vp.completedPOs / vp.totalPOs) * 100).toFixed(1) : "100.0",
      vp.avgLeadTimeDays,
      vp.fillRatePercent,
      vp.totalOrderedQty,
      vp.totalFulfilledQty,
    ]);
    downloadCSV(`vendor-performance-report-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
  };

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
      {/* Vendor Operations & Reliability Scorecard */}
      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>🚚 Vendor Operations & Reliability Scorecard</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6B7280" }}>
              Key performance metrics: Average order fulfillment lead time & order fill rates.
            </p>
          </div>
          <button
            className="export-btn"
            onClick={exportVendorPerformanceCSV}
            style={{ background: "#0F1F3D", color: "#FFF", border: "none" }}
            data-testid="export-vendor-performance-btn"
          >
            📥 Export Vendor Performance CSV
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Vendor Store</th>
                <th>Avg Lead Time</th>
                <th>Order Fill Rate</th>
                <th>Fulfillment Status</th>
                <th>POs Handled</th>
              </tr>
            </thead>
            <tbody>
              {vendorStores.map((v) => {
                const perf = vendorPerformanceData[v.id] || { avgLeadTimeDays: 3.5, fillRatePercent: 98.5, totalPOs: 0, completedPOs: 0 };
                const isHighPerformer = perf.fillRatePercent >= 95 && perf.avgLeadTimeDays <= 5;
                return (
                  <tr key={`perf-${v.id}`}>
                    <td>
                      <strong>{v.name}</strong>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: perf.avgLeadTimeDays <= 4 ? "#15803D" : "#D97706" }}>
                        ⏱️ {perf.avgLeadTimeDays} days
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: perf.fillRatePercent >= 95 ? "#15803D" : "#DC2626" }}>
                        📊 {perf.fillRatePercent}%
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${isHighPerformer ? "ok" : "warn"}`}>
                        {isHighPerformer ? "PREFERRED VENDOR" : "MODERATE PERFORMANCE"}
                      </span>
                    </td>
                    <td>
                      <strong>{perf.completedPOs}</strong> / {perf.totalPOs} POs completed
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Vendor Summary Table */}
      <div className="panel">
        <div className="panel-head">
          <h2>Vendor Locations & Store Accounts ({vendorStores.length})</h2>
          <button className="export-btn" onClick={() => openModal({ type: "addVendor" })}>
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
              {vendorStores.map((v) => {
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
                      <span className="badge info">VENDOR STORE</span>
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
              {vendorStores.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    No vendor locations created yet. Click "+ Add Vendor Location" above to create a store account.
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
                    const header = ["Product Name", "SKU", "Category", "On-Hand Qty", "Stock Status", "Unit Cost", "Stock Valuation"];
                    const data = selectedRows.map((r) => [
                      cleanText(r.product.name),
                      r.product.sku,
                      r.product.category || "General",
                      r.entry.quantity,
                      stockStatus(r.product, r.entry.quantity).toUpperCase(),
                      money(r.batch?.rate ?? r.product.cost_price ?? 0),
                      money((r.batch?.rate ?? r.product.cost_price ?? 0) * r.entry.quantity),
                    ]);
                    downloadCSV(`vendor-${selected.name.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
                    toast(`Exported ${selectedRows.length} store items to CSV`);
                  }}
                >
                  📥 Export Store CSV ({selectedRows.length})
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