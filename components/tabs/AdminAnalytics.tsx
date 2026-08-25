"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { downloadCSV } from "@/lib/utils";
import Chart from "chart.js/auto";

function msAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

export default function AdminAnalytics() {
  const { products, productBatches, stockEntries, stockHistory, vendors } = useApp();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [chartMode, setChartMode] = useState<"bar" | "line">("bar");

  // Calculate daily depletion velocity & runout days per product from REAL stock_history
  const analyticsData = useMemo(() => {
    const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

    const totalQtyMap: Record<string, number> = {};
    stockEntries.forEach((se) => {
      totalQtyMap[se.product_id] = (totalQtyMap[se.product_id] || 0) + Number(se.quantity || 0);
    });

    const thirtyDaysAgo = msAgo(30);
    const pointsByProductVendor: Record<string, Record<string, { qty: number; time: number }[]>> = {};
    stockHistory.forEach((sh) => {
      const time = new Date(sh.recorded_at).getTime();
      if (isNaN(time) || time < thirtyDaysAgo) return;
      const byVendor = (pointsByProductVendor[sh.product_id] ??= {});
      (byVendor[sh.vendor_id] ??= []).push({ qty: Number(sh.quantity) || 0, time });
    });

    const depletionFor = (productId: string): { dailyVelocity: number; hasData: boolean } => {
      const byVendor = pointsByProductVendor[productId];
      if (!byVendor) return { dailyVelocity: 0, hasData: false };
      let totalDrop = 0;
      let maxSpanDays = 0;
      let hasData = false;
      Object.values(byVendor).forEach((points) => {
        if (points.length < 2) return;
        points.sort((a, b) => a.time - b.time);
        const first = points[0];
        const last = points[points.length - 1];
        const spanDays = (last.time - first.time) / 86400000;
        if (spanDays <= 0) return;
        totalDrop += first.qty - last.qty;
        maxSpanDays = Math.max(maxSpanDays, spanDays);
        hasData = true;
      });
      if (!hasData) return { dailyVelocity: 0, hasData: false };
      return { dailyVelocity: Math.max(0, totalDrop) / maxSpanDays, hasData: true };
    };

    const nowTime = Date.now();
    const sevenDaysAgo = nowTime - 7 * 86400000;
    const fourteenDaysAgo = nowTime - 14 * 86400000;

    const computeMABaseline = (productId: string, days: number, minTime: number) => {
      const byVendor = pointsByProductVendor[productId];
      if (!byVendor) return 0;
      let totalDrop = 0;
      let count = 0;
      Object.values(byVendor).forEach((points) => {
        const filtered = points.filter((pt) => pt.time >= minTime);
        if (filtered.length < 2) return;
        filtered.sort((a, b) => a.time - b.time);
        const drop = filtered[0].qty - filtered[filtered.length - 1].qty;
        totalDrop += Math.max(0, drop);
        count++;
      });
      if (count === 0) return 0;
      return Number((totalDrop / days).toFixed(2));
    };

    const ASSUMED_ORDER_COST = 50;
    const HOLDING_COST_RATE = 0.15;

    const rows = products.map((p) => {
      const totalQty = totalQtyMap[p.id] || 0;
      const { dailyVelocity: rawVelocity, hasData } = depletionFor(p.id);
      const dailyVelocity = Number(rawVelocity.toFixed(2));

      // Deterministic Moving Averages (7-day, 14-day, 30-day) from real stock history
      const rawMa7 = computeMABaseline(p.id, 7, sevenDaysAgo);
      const rawMa14 = computeMABaseline(p.id, 14, fourteenDaysAgo);

      const ma7 = rawMa7 > 0 ? rawMa7 : dailyVelocity;
      const ma14 = rawMa14 > 0 ? rawMa14 : dailyVelocity;
      const ma30 = dailyVelocity;

      const projected30Demand = Math.round(ma7 * 30);
      const projected90Demand = Math.round(ma14 * 90);

      const runoutDays = dailyVelocity > 0 ? Math.round(totalQty / dailyVelocity) : 999;
      const annualDemand = dailyVelocity * 365;
      const holdingCost = Math.max(1, p.cost_price * HOLDING_COST_RATE);
      const eoq = annualDemand > 0 ? Math.round(Math.sqrt((2 * annualDemand * ASSUMED_ORDER_COST) / holdingCost)) : 0;
      const reorderFrequencyDays = eoq > 0 && dailyVelocity > 0 ? Math.round(eoq / dailyVelocity) : 30;

      const isDeadStock = totalQty > (p.reorder_threshold || 25) * 3 && dailyVelocity < 0.1;
      const isCriticalRunout = hasData && runoutDays <= 14 && totalQty > 0;

      return {
        ...p,
        totalQty,
        dailyVelocity,
        ma7,
        ma14,
        ma30,
        projected30Demand,
        projected90Demand,
        hasVelocityData: hasData,
        runoutDays,
        eoq,
        reorderFrequencyDays,
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

  // Seasonal Trend Analysis Calculation (Q1-Q4 Index & Multipliers)
  const seasonalTrendData = useMemo(() => {
    const q1Count = stockHistory.filter((h) => { const m = new Date(h.recorded_at).getMonth(); return m >= 0 && m <= 2; }).length;
    const q2Count = stockHistory.filter((h) => { const m = new Date(h.recorded_at).getMonth(); return m >= 3 && m <= 5; }).length;
    const q3Count = stockHistory.filter((h) => { const m = new Date(h.recorded_at).getMonth(); return m >= 6 && m <= 8; }).length;
    const q4Count = stockHistory.filter((h) => { const m = new Date(h.recorded_at).getMonth(); return m >= 9 && m <= 11; }).length;

    const totalEvents = Math.max(1, q1Count + q2Count + q3Count + q4Count);
    const avgPerQ = totalEvents / 4;

    const q1Index = Number((q1Count / avgPerQ).toFixed(2)) || 1.0;
    const q2Index = Number((q2Count / avgPerQ).toFixed(2)) || 1.0;
    const q3Index = Number((q3Count / avgPerQ).toFixed(2)) || 1.0;
    const q4Index = Number((q4Count / avgPerQ).toFixed(2)) || 1.25;

    const currentMonth = new Date().getMonth();
    const activeQuarter = currentMonth <= 2 ? "Q1 (Jan-Mar)" : currentMonth <= 5 ? "Q2 (Apr-Jun)" : currentMonth <= 8 ? "Q3 (Jul-Sep)" : "Q4 (Oct-Dec)";
    const activeMultiplier = currentMonth <= 2 ? q1Index : currentMonth <= 5 ? q2Index : currentMonth <= 8 ? q3Index : q4Index;

    return {
      q1Index,
      q2Index,
      q3Index,
      q4Index,
      activeQuarter,
      activeMultiplier,
    };
  }, [stockHistory]);

  // Stock Aging Analysis (0-30d, 31-60d, 61-90d, 90+d)
  const stockAgingData = useMemo(() => {
    const now = Date.now();
    let fresh0_30 = 0;
    let moderate31_60 = 0;
    let aging61_90 = 0;
    let stale90Plus = 0;
    let totalStockVal = 0;

    const agingRows: {
      productId: string;
      productName: string;
      sku: string;
      batchNumber: string;
      receivedDate: string;
      daysInStock: number;
      quantity: number;
      unitCost: number;
      totalValue: number;
      tier: "0-30 Days" | "31-60 Days" | "61-90 Days" | "90+ Days";
    }[] = [];

    productBatches.forEach((b) => {
      const p = products.find((x) => x.id === b.product_id);
      if (!p) return;
      const recvTime = new Date(b.received_date || b.created_at || "2026-01-01").getTime();
      const diffMs = Math.max(0, now - recvTime);
      const daysInStock = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const qty = Number(b.quantity || 0);
      const cost = Number(b.cost_price || p.cost_price || 0);
      const val = qty * cost;

      totalStockVal += val;

      let tier: "0-30 Days" | "31-60 Days" | "61-90 Days" | "90+ Days" = "0-30 Days";
      if (daysInStock <= 30) {
        fresh0_30 += val;
        tier = "0-30 Days";
      } else if (daysInStock <= 60) {
        moderate31_60 += val;
        tier = "31-60 Days";
      } else if (daysInStock <= 90) {
        aging61_90 += val;
        tier = "61-90 Days";
      } else {
        stale90Plus += val;
        tier = "90+ Days";
      }

      agingRows.push({
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        batchNumber: b.batch_number || "N/A",
        receivedDate: b.received_date,
        daysInStock,
        quantity: qty,
        unitCost: cost,
        totalValue: val,
        tier,
      });
    });

    return {
      fresh0_30,
      moderate31_60,
      aging61_90,
      stale90Plus,
      totalStockVal,
      agingRows,
    };
  }, [productBatches, products]);

  const exportStockAgingCSV = () => {
    const header = ["SKU", "Product Name", "Batch Number", "Received Date", "Days in Stock", "Aging Tier", "Quantity", "Unit Cost", "Total Value"];
    const data = stockAgingData.agingRows.map((r) => [
      r.sku,
      r.productName,
      r.batchNumber,
      r.receivedDate,
      r.daysInStock,
      r.tier,
      r.quantity,
      r.unitCost.toFixed(2),
      r.totalValue.toFixed(2),
    ]);
    downloadCSV(`stock-aging-report-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
  };

  const exportEOQReportCSV = () => {
    const header = ["SKU", "Product Name", "Category", "On-Hand Qty", "MA (7-Day)", "MA (14-Day)", "MA (30-Day)", "30-Day Forecast", "90-Day Forecast", "Recommended EOQ Qty", "Reorder Cycle (Days)", "Stock Health"];
    const data = analyticsData.rows.map((r) => [
      r.sku,
      r.name,
      r.category || "General",
      r.totalQty,
      r.ma7,
      r.ma14,
      r.ma30,
      r.projected30Demand,
      r.projected90Demand,
      r.eoq,
      r.reorderFrequencyDays,
      r.isCriticalRunout ? "Critical Runout" : r.isDeadStock ? "Slow Moving" : "Healthy",
    ]);
    downloadCSV(`eoq-forecasting-report-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
  };

  // Render Demand Velocity & Velocity Trend Chart
  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const top5Products = analyticsData.rows.slice(0, 7);
    const labels = top5Products.map((p) => (p.name.length > 15 ? p.name.substring(0, 15) + "..." : p.name));

    if (chartMode === "bar") {
      const qtyData = top5Products.map((p) => p.totalQty);
      const runoutData = top5Products.map((p) => (p.runoutDays > 120 ? 120 : p.runoutDays));

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
          plugins: { legend: { position: "top" } },
          scales: { y: { beginAtZero: true } },
        },
      });
    } else {
      // Stock Velocity Over Time (Line Chart with 7D & 14D Moving Averages)
      const ma7Data = top5Products.map((p) => p.ma7);
      const ma14Data = top5Products.map((p) => p.ma14);
      const ma30Data = top5Products.map((p) => p.ma30);

      chartRef.current = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "7-Day Moving Avg Velocity (units/day)",
              data: ma7Data,
              borderColor: "#2563EB",
              backgroundColor: "rgba(37, 99, 235, 0.1)",
              fill: true,
              tension: 0.3,
            },
            {
              label: "14-Day Velocity Baseline",
              data: ma14Data,
              borderColor: "#10B981",
              backgroundColor: "transparent",
              borderDash: [5, 5],
              tension: 0.3,
            },
            {
              label: "30-Day Velocity Baseline",
              data: ma30Data,
              borderColor: "#F59E0B",
              backgroundColor: "transparent",
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "top" } },
          scales: { y: { beginAtZero: true } },
        },
      });
    }

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [analyticsData, chartMode]);

  return (
    <div className="tab-pane active" style={{ animation: "fadeIn 0.2s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "#0F1F3D", fontSize: 20 }}>Demand Forecast & Reorder Planning</h2>
          <p style={{ margin: "4px 0 0", color: "#5C6B73", fontSize: 13 }}>
            Statistical trend analysis from real stock movement — 7/14/30-day Moving Averages, Seasonal Trends, Economic Order Quantities (EOQ), and Velocity Graphs.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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

          <button
            onClick={exportEOQReportCSV}
            style={{ padding: "6px 14px", background: "#0F1F3D", color: "#FFF", borderRadius: 4, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            data-testid="export-eoq-csv-btn"
          >
            📥 Export EOQ & Forecast CSV
          </button>
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
          <span style={{ fontSize: 12, color: "#6B7280", textTransform: "uppercase", fontWeight: 600 }}>Active Seasonal Index</span>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#059669", marginTop: 4 }}>
            {seasonalTrendData.activeMultiplier}x <span style={{ fontSize: 13, fontWeight: 400, color: "#6B7280" }}>({seasonalTrendData.activeQuarter})</span>
          </div>
        </div>
      </div>

      {/* Seasonal Trend Analysis Panel */}
      <div style={{ background: "linear-gradient(135deg, #0F1F3D 0%, #1E3A8A 100%)", color: "#FFF", borderRadius: 8, padding: 20, marginBottom: 24, boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: "#C9A96E" }}>📈 Seasonal Demand & Quarterly Multiplier Model</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94A3B8" }}>
              Quarterly stock depletion index calculated from historical movement logs. Adjusts safety stock & reorder triggers for peak seasons.
            </p>
          </div>
          <span style={{ background: "rgba(201, 169, 110, 0.2)", color: "#C9A96E", border: "1px solid #C9A96E", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
            Active Quarter: {seasonalTrendData.activeQuarter} ({seasonalTrendData.activeMultiplier}x Demand)
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div style={{ background: "rgba(255, 255, 255, 0.08)", padding: 12, borderRadius: 6, border: "1px solid rgba(255, 255, 255, 0.12)" }}>
            <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>Q1 (JAN - MAR)</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#FFF", marginTop: 4 }}>{seasonalTrendData.q1Index}x</div>
            <div style={{ fontSize: 11, color: "#CBD5E1", marginTop: 2 }}>Baseline Winter Demand</div>
          </div>

          <div style={{ background: "rgba(255, 255, 255, 0.08)", padding: 12, borderRadius: 6, border: "1px solid rgba(255, 255, 255, 0.12)" }}>
            <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>Q2 (APR - JUN)</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#FFF", marginTop: 4 }}>{seasonalTrendData.q2Index}x</div>
            <div style={{ fontSize: 11, color: "#CBD5E1", marginTop: 2 }}>Summer replenishment</div>
          </div>

          <div style={{ background: "rgba(255, 255, 255, 0.08)", padding: 12, borderRadius: 6, border: "1px solid rgba(255, 255, 255, 0.12)" }}>
            <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>Q3 (JUL - SEP)</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#FFF", marginTop: 4 }}>{seasonalTrendData.q3Index}x</div>
            <div style={{ fontSize: 11, color: "#CBD5E1", marginTop: 2 }}>Monsoon stock stabilization</div>
          </div>

          <div style={{ background: "rgba(255, 255, 255, 0.12)", padding: 12, borderRadius: 6, border: "1px solid #C9A96E" }}>
            <div style={{ fontSize: 11, color: "#C9A96E", fontWeight: 700 }}>Q4 (OCT - DEC) 🔥 PEAK</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#FFF", marginTop: 4 }}>{seasonalTrendData.q4Index}x</div>
            <div style={{ fontSize: 11, color: "#FDE68A", marginTop: 2 }}>Festive High-Demand Surge</div>
          </div>
        </div>
      </div>

      {/* Stock Velocity Chart Section */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 20, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "#1F2937" }}>
            📊 {chartMode === "bar" ? "Product Runout & Stock Cover Comparison" : "Stock Velocity Over Time (7D / 14D / 30D Moving Averages)"}
          </h3>
          <select
            value={chartMode}
            onChange={(e) => setChartMode(e.target.value as "bar" | "line")}
            style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 12, fontWeight: 600, color: "#0F172A" }}
            data-testid="chart-mode-select"
          >
            <option value="bar">Bar Chart: On-Hand vs Stock Cover</option>
            <option value="line">Line Chart: Stock Velocity Over Time</option>
          </select>
        </div>
        <div style={{ height: 280, position: "relative" }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* Stock Aging Analysis Panel (0-30d, 31-60d, 61-90d, 90+d) */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 20, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: "#0F1F3D" }}>📦 Stock Aging & Asset Life Breakdown</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6B7280" }}>
              Holding valuation grouped by inventory age (0-30 days, 31-60 days, 61-90 days, 90+ days).
            </p>
          </div>
          <button
            onClick={exportStockAgingCSV}
            style={{ padding: "6px 14px", background: "#0F1F3D", color: "#FFF", borderRadius: 4, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
            data-testid="export-stock-aging-btn"
          >
            📥 Export Stock Aging CSV
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div style={{ background: "#F0FDF4", padding: 12, borderRadius: 6, border: "1px solid #BBF7D0" }}>
            <div style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>0–30 DAYS (FRESH)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#15803D", marginTop: 4 }}>
              ₹{stockAgingData.fresh0_30.toLocaleString("en-IN")}
            </div>
            <div style={{ fontSize: 11, color: "#166534", marginTop: 2 }}>
              {stockAgingData.totalStockVal > 0 ? ((stockAgingData.fresh0_30 / stockAgingData.totalStockVal) * 100).toFixed(1) : 0}% of inventory
            </div>
          </div>

          <div style={{ background: "#EFF6FF", padding: 12, borderRadius: 6, border: "1px solid #BFDBFE" }}>
            <div style={{ fontSize: 11, color: "#1E40AF", fontWeight: 600 }}>31–60 DAYS (MODERATE)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1E3A8A", marginTop: 4 }}>
              ₹{stockAgingData.moderate31_60.toLocaleString("en-IN")}
            </div>
            <div style={{ fontSize: 11, color: "#2563EB", marginTop: 2 }}>
              {stockAgingData.totalStockVal > 0 ? ((stockAgingData.moderate31_60 / stockAgingData.totalStockVal) * 100).toFixed(1) : 0}% of inventory
            </div>
          </div>

          <div style={{ background: "#FEF3C7", padding: 12, borderRadius: 6, border: "1px solid #FDE68A" }}>
            <div style={{ fontSize: 11, color: "#92400E", fontWeight: 600 }}>61–90 DAYS (AGING)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#78350F", marginTop: 4 }}>
              ₹{stockAgingData.aging61_90.toLocaleString("en-IN")}
            </div>
            <div style={{ fontSize: 11, color: "#D97706", marginTop: 2 }}>
              {stockAgingData.totalStockVal > 0 ? ((stockAgingData.aging61_90 / stockAgingData.totalStockVal) * 100).toFixed(1) : 0}% of inventory
            </div>
          </div>

          <div style={{ background: "#FEF2F2", padding: 12, borderRadius: 6, border: "1px solid #FECACA" }}>
            <div style={{ fontSize: 11, color: "#991B1B", fontWeight: 600 }}>90+ DAYS (STALE RISK)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#991B1B", marginTop: 4 }}>
              ₹{stockAgingData.stale90Plus.toLocaleString("en-IN")}
            </div>
            <div style={{ fontSize: 11, color: "#DC2626", marginTop: 2 }}>
              {stockAgingData.totalStockVal > 0 ? ((stockAgingData.stale90Plus / stockAgingData.totalStockVal) * 100).toFixed(1) : 0}% of inventory
            </div>
          </div>
        </div>
      </div>

      {/* Forecasting & Moving Averages Table */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "#1F2937" }}>Demand Forecast & Economic Order Quantity (EOQ) Recommendations</h3>
          <span style={{ fontSize: 12, color: "#64748B" }}>MA-7 / MA-14 / MA-30 Velocity Models</span>
        </div>
        <div className="table-responsive">
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#F3F4F6", borderBottom: "1px solid #E5E7EB", fontSize: 12, textTransform: "uppercase", color: "#4B5563" }}>
                <th style={{ padding: "10px 16px" }}>Product / SKU</th>
                <th style={{ padding: "10px 16px" }}>On-Hand Qty</th>
                <th style={{ padding: "10px 16px" }}>Moving Averages (7D / 14D)</th>
                <th style={{ padding: "10px 16px" }}>30-Day Forecast</th>
                <th style={{ padding: "10px 16px" }}>Est. Runout</th>
                <th style={{ padding: "10px 16px" }}>Rec. EOQ Qty</th>
                <th style={{ padding: "10px 16px" }}>Order Interval</th>
                <th style={{ padding: "10px 16px" }}>Stock Health</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#6B7280" }}>
                    No product velocity data found.
                  </td>
                </tr>
              ) : (
                analyticsData.rows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
                    <td style={{ padding: "12px 16px" }}>
                      <strong style={{ color: "#111827" }}>{row.name}</strong>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>{row.sku} ({row.category || "General"})</div>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>{row.totalQty} units</td>
                    <td style={{ padding: "12px 16px", color: "#4B5563" }}>
                      {row.hasVelocityData ? (
                        <span>
                          <strong>{row.ma7}</strong> (7d) / <span style={{ color: "#64748B" }}>{row.ma14} (14d)</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#1E3A8A", fontWeight: 600 }}>
                      {row.hasVelocityData ? `${row.projected30Demand} units` : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {row.hasVelocityData ? (
                        <span
                          style={{
                            color: row.runoutDays <= 14 ? "#DC2626" : row.runoutDays <= 30 ? "#D97706" : "#059669",
                            fontWeight: 600,
                          }}
                        >
                          {row.runoutDays > 365 ? "> 1 year" : `${row.runoutDays} days`}
                        </span>
                      ) : (
                        <span style={{ color: "#94A3B8" }}>Not enough history</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ background: "#EEF2FF", color: "#4338CA", padding: "4px 8px", borderRadius: 4, fontWeight: 700, fontSize: 12 }}>
                        {row.eoq} units
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#475569" }}>
                      Every {row.reorderFrequencyDays} days
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
