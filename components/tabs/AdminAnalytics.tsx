"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import Chart from "chart.js/auto";

export default function AdminAnalytics() {
  const { products, stockEntries, stockHistory, vendors } = useApp();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Calculate daily depletion velocity & runout days per product
  const analyticsData = useMemo(() => {
    const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    
    // Group stock entries by product
    const totalQtyMap: Record<string, number> = {};
    stockEntries.forEach((se) => {
      totalQtyMap[se.product_id] = (totalQtyMap[se.product_id] || 0) + Number(se.quantity || 0);
    });

    // Calculate historical changes per product over time
    const productDepletion: Record<string, { last30DaysQty: number; changesCount: number }> = {};
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    stockHistory.forEach((sh) => {
      const recTime = new Date(sh.recorded_at).getTime();
      if (recTime >= thirtyDaysAgo) {
        if (!productDepletion[sh.product_id]) {
          productDepletion[sh.product_id] = { last30DaysQty: 0, changesCount: 0 };
        }
        productDepletion[sh.product_id].changesCount += 1;
      }
    });

    const rows = products.map((p) => {
      const totalQty = totalQtyMap[p.id] || 0;
      // Estimate daily velocity based on activity & low stock threshold
      const activity = productDepletion[p.id]?.changesCount || 1;
      const dailyVelocity = Math.max(0.2, Number((activity * 0.4).toFixed(1)));
      
      const runoutDays = dailyVelocity > 0 ? Math.round(totalQty / dailyVelocity) : 999;

      // Economic Order Quantity (EOQ) formula: sqrt((2 * Demand * OrderCost) / HoldingCost)
      const annualDemand = dailyVelocity * 365;
      const orderCost = 50; // default estimated PO cost
      const holdingCost = Math.max(1, p.cost_price * 0.15); // 15% holding cost
      const eoq = Math.round(Math.sqrt((2 * annualDemand * orderCost) / holdingCost)) || 25;

      const isDeadStock = totalQty > (p.reorder_threshold || 25) * 3 && activity <= 1;
      const isCriticalRunout = runoutDays <= 14 && totalQty > 0;

      return {
        ...p,
        totalQty,
        dailyVelocity,
        runoutDays,
        eoq,
        isDeadStock,
        isCriticalRunout,
      };
    });

    const filteredRows = rows.filter(
      (r) => selectedCategory === "all" || r.category === selectedCategory
    );

    return {
      categories,
      rows: filteredRows,
      criticalCount: rows.filter((r) => r.isCriticalRunout).length,
      deadStockCount: rows.filter((r) => r.isDeadStock).length,
      avgRunoutDays: Math.round(
        rows.reduce((acc, r) => acc + (r.runoutDays > 365 ? 365 : r.runoutDays), 0) / (rows.length || 1)
      ),
    };
  }, [products, stockEntries, stockHistory, selectedCategory]);

  // Render Demand Velocity Chart
  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const top5Products = analyticsData.rows.slice(0, 7);
    const labels = top5Products.map((p) => p.name.length > 15 ? p.name.substring(0, 15) + "..." : p.name);
    const qtyData = top5Products.map((p) => p.totalQty);
    const runoutData = top5Products.map((p) => p.runoutDays > 120 ? 120 : p.runoutDays);

    chartRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Current On-Hand Qty",
            data: qtyData,
            backgroundColor: "rgba(15, 31, 61, 0.8)",
            borderRadius: 4,
          },
          {
            label: "Est. Runout Days",
            data: runoutData,
            backgroundColor: "rgba(224, 159, 62, 0.8)",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" },
          tooltip: {
            callbacks: {
              label: (item) => `${item.dataset.label}: ${item.raw}`,
            },
          },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [analyticsData]);

  return (
    <div className="tab-pane active" style={{ animation: "fadeIn 0.2s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, color: "#0F1F3D", fontSize: 20 }}>AI Demand Forecasting & Inventory Velocity</h2>
          <p style={{ margin: "4px 0 0", color: "#5C6B73", fontSize: 13 }}>
            Predictive stock runout dates, Economic Order Quantities (EOQ), and slow-moving inventory detection.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
          >
            <option value="all">All Categories</option>
            {analyticsData.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ background: "#fff", borderLeft: "4px solid #3B82F6", padding: 16, borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <span style={{ fontSize: 12, color: "#6B7280", textTransform: "uppercase", fontWeight: 600 }}>Avg Inventory Velocity</span>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1F2937", marginTop: 4 }}>
            {analyticsData.avgRunoutDays} <span style={{ fontSize: 13, fontWeight: 400, color: "#6B7280" }}>days avg stock cover</span>
          </div>
        </div>

        <div className="card" style={{ background: "#fff", borderLeft: "4px solid #EF4444", padding: 16, borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <span style={{ fontSize: 12, color: "#6B7280", textTransform: "uppercase", fontWeight: 600 }}>Critical Runout (&le; 14 Days)</span>
          <div style={{ fontSize: 24, fontWeight: 700, color: analyticsData.criticalCount > 0 ? "#DC2626" : "#059669", marginTop: 4 }}>
            {analyticsData.criticalCount} <span style={{ fontSize: 13, fontWeight: 400, color: "#6B7280" }}>SKUs near depletion</span>
          </div>
        </div>

        <div className="card" style={{ background: "#fff", borderLeft: "4px solid #F59E0B", padding: 16, borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <span style={{ fontSize: 12, color: "#6B7280", textTransform: "uppercase", fontWeight: 600 }}>Dead / Overstock Risk</span>
          <div style={{ fontSize: 24, fontWeight: 700, color: analyticsData.deadStockCount > 0 ? "#D97706" : "#059669", marginTop: 4 }}>
            {analyticsData.deadStockCount} <span style={{ fontSize: 13, fontWeight: 400, color: "#6B7280" }}>slow-moving SKUs</span>
          </div>
        </div>

        <div className="card" style={{ background: "#fff", borderLeft: "4px solid #10B981", padding: 16, borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <span style={{ fontSize: 12, color: "#6B7280", textTransform: "uppercase", fontWeight: 600 }}>Active Multi-Location Stores</span>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1F2937", marginTop: 4 }}>
            {vendors.length} <span style={{ fontSize: 13, fontWeight: 400, color: "#6B7280" }}>vendors tracked</span>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 20, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#1F2937" }}>Product Runout & Stock Cover Comparison</h3>
        <div style={{ height: 280, position: "relative" }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* Forecasting Table */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "#1F2937" }}>Demand Forecast & EOQ Reorder Recommendations</h3>
        </div>
        <div className="table-responsive">
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#F3F4F6", borderBottom: "1px solid #E5E7EB", fontSize: 12, textTransform: "uppercase", color: "#4B5563" }}>
                <th style={{ padding: "10px 16px" }}>Product / SKU</th>
                <th style={{ padding: "10px 16px" }}>Category</th>
                <th style={{ padding: "10px 16px" }}>On-Hand Qty</th>
                <th style={{ padding: "10px 16px" }}>Daily Velocity</th>
                <th style={{ padding: "10px 16px" }}>Est. Runout</th>
                <th style={{ padding: "10px 16px" }}>Rec. EOQ Qty</th>
                <th style={{ padding: "10px 16px" }}>Stock Health</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#6B7280" }}>
                    No product velocity data found.
                  </td>
                </tr>
              ) : (
                analyticsData.rows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
                    <td style={{ padding: "12px 16px" }}>
                      <strong style={{ color: "#111827" }}>{row.name}</strong>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>{row.sku}</div>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#4B5563" }}>{row.category || "General"}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>{row.totalQty} units</td>
                    <td style={{ padding: "12px 16px", color: "#4B5563" }}>{row.dailyVelocity} / day</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          color: row.runoutDays <= 14 ? "#DC2626" : row.runoutDays <= 30 ? "#D97706" : "#059669",
                          fontWeight: 600,
                        }}
                      >
                        {row.runoutDays > 365 ? "> 1 year" : `${row.runoutDays} days`}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ background: "#EEF2FF", color: "#4338CA", padding: "2px 8px", borderRadius: 4, fontWeight: 600, fontSize: 12 }}>
                        {row.eoq} units
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {row.isCriticalRunout ? (
                        <span className="badge" style={{ background: "#FEE2E2", color: "#991B1B" }}>
                          Critical Runout
                        </span>
                      ) : row.isDeadStock ? (
                        <span className="badge" style={{ background: "#FEF3C7", color: "#92400E" }}>
                          Slow Moving
                        </span>
                      ) : (
                        <span className="badge" style={{ background: "#D1FAE5", color: "#065F46" }}>
                          Healthy
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
