"use client";

import React, { useEffect, useMemo, useRef } from "react";
import Chart from "chart.js/auto";
import { useApp } from "@/components/AppProvider";
import { REASON_LABELS } from "@/lib/constants";
import { cleanText, money } from "@/lib/utils";

export default function AdminDashboard() {
  const {
    products,
    productBatches,
    vendors,
    stockEntries,
    stockAdjustments,
    reorderRequests,
    purchaseOrders,
    stockTransfers,
    stockHistory,
    openModal,
  } = useApp();

  const categoryChartRef = useRef<HTMLCanvasElement | null>(null);
  const topProductsChartRef = useRef<HTMLCanvasElement | null>(null);
  const trendChartRef = useRef<HTMLCanvasElement | null>(null);

  const categoryChart = useRef<Chart | null>(null);
  const topProductsChart = useRef<Chart | null>(null);
  const trendChart = useRef<Chart | null>(null);

  // Real on-hand quantity per product, summed across every vendor's stock_entries row —
  // shared by the KPI cards and both valuation charts below so they can't disagree with
  // each other or with All Stock.
  const qtyByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    stockEntries.forEach((se) => {
      map[se.product_id] = (map[se.product_id] || 0) + Number(se.quantity || 0);
    });
    return map;
  }, [stockEntries]);

  const stats = useMemo(() => {
    let totalCostVal = 0;
    let totalRetailVal = 0;
    let lowStockCount = 0;

    products.forEach((p) => {
      // No stock_entries row for this product yet means genuinely zero on hand —
      // never assume a default quantity that isn't backed by real data.
      const onHandQty = qtyByProduct[p.id] || 0;
      totalCostVal += onHandQty * (p.cost_price || 0);
      totalRetailVal += onHandQty * (p.selling_price || 0);

      if (onHandQty <= (p.low_stock_threshold || 10)) {
        lowStockCount++;
      }
    });

    const pendingReorders = reorderRequests.filter((r) => r.status === "pending").length;
    const pendingPOs = purchaseOrders.filter((po) => po.status === "draft" || po.status === "sent").length;
    const pendingTransfers = stockTransfers.filter((st) => st.status === "pending" || st.status === "in_transit").length;

    const expiringBatches = productBatches.filter((b) => {
      if (!b.expiry_date) return false;
      const days = Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 30;
    }).length;

    return {
      totalCostVal,
      totalRetailVal,
      lowStockCount,
      expiringBatches,
      pendingReorders,
      pendingPOs,
      pendingTransfers,
    };
  }, [products, stockEntries, productBatches, reorderRequests, purchaseOrders, stockTransfers]);

  // Category Distribution for Doughnut Chart — real on-hand value (qty × cost), not a
  // fabricated multiplier. Categories with zero on-hand stock are omitted rather than
  // shown with a made-up value.
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      const value = (qtyByProduct[p.id] || 0) * (p.cost_price || 0);
      if (value <= 0) return;
      const cat = p.category || "General";
      map[cat] = (map[cat] || 0) + value;
    });
    return {
      labels: Object.keys(map),
      values: Object.values(map),
    };
  }, [products, qtyByProduct]);

  // Top 5 SKUs by real on-hand retail valuation (qty × selling price).
  const topProducts = useMemo(() => {
    return [...products]
      .map((p) => ({
        name: cleanText(p.name),
        val: (qtyByProduct[p.id] || 0) * (p.selling_price || 0),
      }))
      .filter((p) => p.val > 0)
      .sort((a, b) => b.val - a.val)
      .slice(0, 5);
  }, [products, qtyByProduct]);

  // Historical Stock Movement Trend — real stock_history points only. An empty array (no
  // synthetic fallback) is rendered as an honest "not enough data yet" state below.
  const trendPoints = useMemo(() => {
    if (!stockHistory || stockHistory.length === 0) return [];
    const series = stockHistory.reduce((acc, h) => {
      const day = (h.recorded_at || "").slice(5, 10);
      acc[day] = (acc[day] || 0) + (Number(h.quantity) || 0);
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(series).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  }, [stockHistory]);

  // Render Charts
  useEffect(() => {
    // 1. Category Chart
    if (categoryChartRef.current && categoryData.labels.length > 0) {
      if (categoryChart.current) categoryChart.current.destroy();
      const ctx = categoryChartRef.current.getContext("2d");
      if (ctx) {
        categoryChart.current = new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: categoryData.labels,
            datasets: [
              {
                data: categoryData.values,
                backgroundColor: ["#0F1F3D", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"],
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "right" } },
          },
        });
      }
    }

    // 2. Top Products Chart
    if (topProductsChartRef.current && topProducts.length > 0) {
      if (topProductsChart.current) topProductsChart.current.destroy();
      const ctx = topProductsChartRef.current.getContext("2d");
      if (ctx) {
        topProductsChart.current = new Chart(ctx, {
          type: "bar",
          data: {
            labels: topProducts.map((p) => (p.name.length > 18 ? p.name.substring(0, 18) + "..." : p.name)),
            datasets: [
              {
                label: "Est. Valuation ($)",
                data: topProducts.map((p) => p.val),
                backgroundColor: "rgba(15, 31, 61, 0.85)",
                borderRadius: 4,
              },
            ],
          },
          options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true } },
          },
        });
      }
    }

    // 3. Trend Chart
    if (trendChartRef.current && trendPoints.length > 0) {
      if (trendChart.current) trendChart.current.destroy();
      const ctx = trendChartRef.current.getContext("2d");
      if (ctx) {
        trendChart.current = new Chart(ctx, {
          type: "line",
          data: {
            labels: trendPoints.map((p) => p[0]),
            datasets: [
              {
                label: "Stock Movement Qty",
                data: trendPoints.map((p) => p[1] as number),
                borderColor: "#3B82F6",
                backgroundColor: "rgba(59, 130, 246, 0.12)",
                fill: true,
                tension: 0.3,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
          },
        });
      }
    }

    return () => {
      if (categoryChart.current) categoryChart.current.destroy();
      if (topProductsChart.current) topProductsChart.current.destroy();
      if (trendChart.current) trendChart.current.destroy();
    };
  }, [categoryData, topProducts, trendPoints]);

  return (
    <div className="tab-pane active" style={{ animation: "fadeIn 0.2s ease" }}>
      {/* Master Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, color: "#0F1F3D", fontSize: 22, fontWeight: 700 }}>Executive Master Dashboard</h2>
          <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: 13 }}>
            Real-time supply chain overview, inventory valuation, depletion risks, and cross-location store health.
          </p>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#FFF", borderLeft: "4px solid #0F1F3D", padding: 16, borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Master Catalog SKUs</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>{products.length}</div>
          <div style={{ fontSize: 11, color: "#10B981", marginTop: 2 }}>{vendors.length} Vendor Stores</div>
        </div>

        <div style={{ background: "#FFF", borderLeft: "4px solid #10B981", padding: 16, borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Total Cost Valuation</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#059669", marginTop: 4 }}>{money(stats.totalCostVal, 0)}</div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Retail: {money(stats.totalRetailVal, 0)}</div>
        </div>

        <div style={{ background: "#FFF", borderLeft: "4px solid #F59E0B", padding: 16, borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Low / Depleted SKUs</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: stats.lowStockCount > 0 ? "#D97706" : "#059669", marginTop: 4 }}>
            {stats.lowStockCount}
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Below Threshold</div>
        </div>

        <div style={{ background: "#FFF", borderLeft: "4px solid #EF4444", padding: 16, borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Expiring ≤ 30 Days</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: stats.expiringBatches > 0 ? "#DC2626" : "#059669", marginTop: 4 }}>
            {stats.expiringBatches}
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Batches at risk</div>
        </div>

        <div style={{ background: "#FFF", borderLeft: "4px solid #8B5CF6", padding: 16, borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Pending POs & Transfers</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#7C3AED", marginTop: 4 }}>
            {stats.pendingPOs + stats.pendingTransfers + stats.pendingReorders}
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Orders in pipeline</div>
        </div>
      </div>

      {/* Master Analytics Charts Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginBottom: 24 }}>
        {/* Category Breakdown */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#0F172A" }}>Inventory Valuation by Category</h3>
          <div style={{ height: 220, position: "relative" }}>
            {categoryData.labels.length > 0 ? (
              <canvas ref={categoryChartRef} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#94A3B8", fontSize: 13, textAlign: "center" }}>
                No stock on hand yet.
              </div>
            )}
          </div>
        </div>

        {/* Top Products Leaderboard */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#0F172A" }}>Top Highest Value SKUs</h3>
          <div style={{ height: 220, position: "relative" }}>
            {topProducts.length > 0 ? (
              <canvas ref={topProductsChartRef} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#94A3B8", fontSize: 13, textAlign: "center" }}>
                No stock on hand yet.
              </div>
            )}
          </div>
        </div>

        {/* 14-Day Movement Trend */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#0F172A" }}>Stock Movement Velocity (Last 14 Days)</h3>
          <div style={{ height: 220, position: "relative" }}>
            {trendPoints.length > 0 ? (
              <canvas ref={trendChartRef} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#94A3B8", fontSize: 13, textAlign: "center" }}>
                Not enough stock history yet — this fills in as quantities change.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Master Control Bottom Grid: Low Stock Alert & Vendor Stores */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, flexWrap: "wrap" }}>
        {/* Low Stock Quick Action Widget */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 14, color: "#0F172A" }}>⚠️ Low Stock & Depletion Warnings</h3>
            <span style={{ fontSize: 11, background: "#FEF3C7", color: "#92400E", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
              Action Required
            </span>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F1F5F9", fontSize: 11, textTransform: "uppercase", color: "#475569" }}>
                  <th style={{ padding: "8px 14px" }}>Product Name</th>
                  <th style={{ padding: "8px 14px" }}>SKU</th>
                  <th style={{ padding: "8px 14px" }}>Low Limit</th>
                  <th style={{ padding: "8px 14px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 5).map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0F172A" }}>{cleanText(p.name)}</td>
                    <td style={{ padding: "10px 14px", color: "#64748B", fontSize: 12 }}>{p.sku}</td>
                    <td style={{ padding: "10px 14px", color: "#DC2626", fontWeight: 700 }}>{p.low_stock_threshold} units</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <button
                        className="btn-ghost"
                        onClick={() => openModal({ type: "createPO" })}
                        style={{ padding: "3px 8px", fontSize: 11, color: "#2563EB" }}
                      >
                        + Reorder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vendor Locations Quick Widget */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 14, color: "#0F172A" }}>🏬 Multi-Location Vendor Stores</h3>
            <button className="btn-ghost" onClick={() => openModal({ type: "addVendor" })} style={{ fontSize: 12, color: "#0F1F3D" }}>
              + Add Store
            </button>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F1F5F9", fontSize: 11, textTransform: "uppercase", color: "#475569" }}>
                  <th style={{ padding: "8px 14px" }}>Store Name</th>
                  <th style={{ padding: "8px 14px" }}>Location</th>
                  <th style={{ padding: "8px 14px" }}>Role</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0F172A" }}>{v.name}</td>
                    <td style={{ padding: "10px 14px", color: "#64748B" }}>{v.address || v.email || "Primary Location"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span
                        style={{
                          background: v.is_admin ? "#FEF3C7" : "#E0F2FE",
                          color: v.is_admin ? "#92400E" : "#0369A1",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {v.is_admin ? "HQ ADMIN" : "VENDOR STORE"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}