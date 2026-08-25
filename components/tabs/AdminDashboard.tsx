"use client";

import React, { useEffect, useMemo, useRef } from "react";
import Chart from "chart.js/auto";
import { useApp } from "@/components/AppProvider";
import { REASON_LABELS } from "@/lib/constants";
import { cleanText, daysUntil, money } from "@/lib/utils";

interface AdminDashboardProps {
  onNavigate?: (tab: string, vendorId?: string) => void;
}

export default function AdminDashboard({ onNavigate }: AdminDashboardProps) {
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
    refreshAll,
    openModal,
  } = useApp();

  const [lastRefreshed, setLastRefreshed] = React.useState<string>(
    new Date().toLocaleTimeString("en-US", { hour12: false })
  );
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  const [isCustomizing, setIsCustomizing] = React.useState<boolean>(false);

  // Widget Layout Order & Visibility (persisted in localStorage)
  const DEFAULT_WIDGETS = [
    "kpi_cards",
    "top_suppliers",
    "transfer_volume",
    "expiry_heatmap",
    "category_chart",
    "top_skus",
    "velocity_trend",
    "depletion_alerts",
  ];

  const [widgetOrder, setWidgetOrder] = React.useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("cureforever_admin_widgets_config");
        if (saved) return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return DEFAULT_WIDGETS;
  });

  const [hiddenWidgets, setHiddenWidgets] = React.useState<Record<string, boolean>>({});

  const saveWidgetOrder = (newOrder: string[]) => {
    setWidgetOrder(newOrder);
    if (typeof window !== "undefined") {
      localStorage.setItem("cureforever_admin_widgets_config", JSON.stringify(newOrder));
    }
  };

  const moveWidget = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= widgetOrder.length) return;
    const copy = [...widgetOrder];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    saveWidgetOrder(copy);
  };

  const toggleWidgetVisibility = (id: string) => {
    setHiddenWidgets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const resetWidgetOrder = () => {
    saveWidgetOrder(DEFAULT_WIDGETS);
    setHiddenWidgets({});
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshAll();
    setLastRefreshed(new Date().toLocaleTimeString("en-US", { hour12: false }));
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const categoryChartRef = useRef<HTMLCanvasElement | null>(null);
  const topProductsChartRef = useRef<HTMLCanvasElement | null>(null);
  const trendChartRef = useRef<HTMLCanvasElement | null>(null);

  const categoryChart = useRef<Chart | null>(null);
  const topProductsChart = useRef<Chart | null>(null);
  const trendChart = useRef<Chart | null>(null);

  const vendorStores = useMemo(() => vendors.filter((v) => !v.is_admin), [vendors]);

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
      const days = daysUntil(b.expiry_date);
      return days !== null && days >= 0 && days <= 30;
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

  const trendPoints = useMemo(() => {
    if (!stockHistory || stockHistory.length === 0) return [];
    const series = stockHistory.reduce((acc, h) => {
      const day = (h.recorded_at || "").slice(5, 10);
      acc[day] = (acc[day] || 0) + (Number(h.quantity) || 0);
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(series).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  }, [stockHistory]);

  // Top Suppliers Ranking Calculation
  const topSuppliersData = useMemo(() => {
    const supplierMap: Record<string, { name: string; poCount: number; totalValue: number; activePOs: number }> = {};
    (purchaseOrders || []).forEach((po) => {
      const name = po.supplier || "Vendor Location";
      if (!supplierMap[name]) {
        supplierMap[name] = { name, poCount: 0, totalValue: 0, activePOs: 0 };
      }
      supplierMap[name].poCount += 1;
      if (po.status === "draft" || po.status === "sent" || po.status === "accepted") {
        supplierMap[name].activePOs += 1;
      }
      const poVal = (po.items || []).reduce((acc, item) => acc + (item.quantity_ordered || 0) * (item.unit_cost || 0), 0);
      supplierMap[name].totalValue += poVal;
    });
    return Object.values(supplierMap).sort((a, b) => b.totalValue - a.totalValue).slice(0, 5);
  }, [purchaseOrders]);

  // Expiry Risk Heatmap Calculation
  const expiryHeatmap = useMemo(() => {
    let expired = 0;
    let critical30 = 0;
    let warning90 = 0;
    let fresh90Plus = 0;

    productBatches.forEach((b) => {
      const days = daysUntil(b.expiry_date);
      if (days === null) return;
      if (days < 0) expired++;
      else if (days <= 30) critical30++;
      else if (days <= 90) warning90++;
      else fresh90Plus++;
    });

    const total = expired + critical30 + warning90 + fresh90Plus;

    return {
      expired,
      critical30,
      warning90,
      fresh90Plus,
      total,
    };
  }, [productBatches]);

  useEffect(() => {
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
                label: "Retail Valuation (₹)",
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

  const renderWidget = (id: string, index: number) => {
    if (hiddenWidgets[id]) return null;

    const renderControls = () => {
      if (!isCustomizing) return null;
      return (
        <div style={{ background: "#F1F5F9", padding: "4px 8px", borderRadius: 4, display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>Widget #{index + 1}</span>
          <button
            onClick={(e) => { e.stopPropagation(); moveWidget(index, "up"); }}
            disabled={index === 0}
            style={{ padding: "2px 6px", fontSize: 11, borderRadius: 3, border: "1px solid #CBD5E1", background: "#FFF", cursor: index === 0 ? "not-allowed" : "pointer" }}
            title="Move Up"
            data-testid={`move-up-${id}`}
          >
            ▲
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); moveWidget(index, "down"); }}
            disabled={index === widgetOrder.length - 1}
            style={{ padding: "2px 6px", fontSize: 11, borderRadius: 3, border: "1px solid #CBD5E1", background: "#FFF", cursor: index === widgetOrder.length - 1 ? "not-allowed" : "pointer" }}
            title="Move Down"
            data-testid={`move-down-${id}`}
          >
            ▼
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleWidgetVisibility(id); }}
            style={{ padding: "2px 6px", fontSize: 11, borderRadius: 3, border: "1px solid #CBD5E1", background: "#FFF", cursor: "pointer", marginLeft: "auto" }}
            title="Hide Widget"
            data-testid={`hide-${id}`}
          >
            👁️ Hide
          </button>
        </div>
      );
    };

    switch (id) {
      case "kpi_cards":
        return (
          <div key={id} style={{ marginBottom: 24 }}>
            {renderControls()}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
              <div
                className="interactive-card"
                onClick={() => onNavigate?.("products")}
                style={{ cursor: "pointer", background: "#FFF", borderLeft: "4px solid #0F1F3D", padding: 16, borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                data-testid="kpi-catalog-skus"
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Master Catalog SKUs</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>{products.length}</div>
                <div style={{ fontSize: 11, color: "#10B981", marginTop: 2 }}>{vendorStores.length} Vendor Store{vendorStores.length === 1 ? "" : "s"}</div>
              </div>

              <div
                className="interactive-card"
                onClick={() => onNavigate?.("financials")}
                style={{ cursor: "pointer", background: "#FFF", borderLeft: "4px solid #10B981", padding: 16, borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                data-testid="kpi-total-valuation"
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Total Cost Valuation</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#059669", marginTop: 4 }}>{money(stats.totalCostVal, 0)}</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Retail: {money(stats.totalRetailVal, 0)}</div>
              </div>

              <div
                className="interactive-card"
                onClick={() => onNavigate?.("allstock")}
                style={{ cursor: "pointer", background: "#FFF", borderLeft: "4px solid #F59E0B", padding: 16, borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                data-testid="kpi-low-stock"
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Low / Depleted SKUs</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: stats.lowStockCount > 0 ? "#D97706" : "#059669", marginTop: 4 }}>
                  {stats.lowStockCount}
                </div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Below Threshold</div>
              </div>

              <div
                className="interactive-card"
                onClick={() => onNavigate?.("batches")}
                style={{ cursor: "pointer", background: "#FFF", borderLeft: "4px solid #EF4444", padding: 16, borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                data-testid="kpi-expiring-batches"
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Expiring ≤ 30 Days</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: stats.expiringBatches > 0 ? "#DC2626" : "#059669", marginTop: 4 }}>
                  {stats.expiringBatches}
                </div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Batches at risk</div>
              </div>

              <div
                className="interactive-card"
                onClick={() => onNavigate?.("pos")}
                style={{ cursor: "pointer", background: "#FFF", borderLeft: "4px solid #8B5CF6", padding: 16, borderRadius: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                data-testid="kpi-pending-pipeline"
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Pending POs & Transfers</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#7C3AED", marginTop: 4 }}>
                  {stats.pendingPOs + stats.pendingTransfers + stats.pendingReorders}
                </div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Orders in pipeline</div>
              </div>
            </div>
          </div>
        );

      case "top_suppliers":
        return (
          <div key={id} style={{ marginBottom: 24 }} data-testid="widget-top-suppliers">
            {renderControls()}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: "#0F172A" }}>🏭 Top Suppliers & Partner Volume</h3>
                <button
                  onClick={() => onNavigate?.("pos")}
                  style={{ background: "none", border: "none", color: "#2563EB", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Manage POs →
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {topSuppliersData.map((sup, idx) => (
                  <div key={idx} style={{ background: "#F8FAFC", padding: 12, borderRadius: 6, border: "1px solid #E2E8F0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>{sup.name}</span>
                      <span style={{ fontSize: 10, background: "#DBEAFE", color: "#1E40AF", padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>
                        Rank #{idx + 1}
                      </span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#059669", marginTop: 4 }}>
                      {money(sup.totalValue, 0)}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                      {sup.poCount} POs ({sup.activePOs} Active)
                    </div>
                  </div>
                ))}
                {topSuppliersData.length === 0 && (
                  <div style={{ color: "#94A3B8", fontSize: 13, padding: 12 }}>No purchase order suppliers recorded.</div>
                )}
              </div>
            </div>
          </div>
        );

      case "transfer_volume":
        return (
          <div key={id} style={{ marginBottom: 24 }} data-testid="widget-transfer-volume">
            {renderControls()}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: "#0F172A" }}>🚚 Inter-Store Transfer Volume & Logistics</h3>
                <button
                  onClick={() => onNavigate?.("transfers")}
                  style={{ background: "none", border: "none", color: "#2563EB", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Manage Transfers →
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div style={{ background: "#FEF3C7", padding: 12, borderRadius: 6, border: "1px solid #FDE68A" }}>
                  <div style={{ fontSize: 11, color: "#92400E", fontWeight: 700 }}>PENDING APPROVAL</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#78350F", marginTop: 4 }}>
                    {stockTransfers.filter((t) => t.status === "pending").length} <span style={{ fontSize: 12, fontWeight: 400 }}>transfers</span>
                  </div>
                </div>

                <div style={{ background: "#EFF6FF", padding: 12, borderRadius: 6, border: "1px solid #BFDBFE" }}>
                  <div style={{ fontSize: 11, color: "#1E40AF", fontWeight: 700 }}>IN-TRANSIT</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#1E3A8A", marginTop: 4 }}>
                    {stockTransfers.filter((t) => t.status === "in_transit").length} <span style={{ fontSize: 12, fontWeight: 400 }}>transfers</span>
                  </div>
                </div>

                <div style={{ background: "#F0FDF4", padding: 12, borderRadius: 6, border: "1px solid #BBF7D0" }}>
                  <div style={{ fontSize: 11, color: "#166534", fontWeight: 700 }}>COMPLETED (FULFILLED)</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#15803D", marginTop: 4 }}>
                    {stockTransfers.filter((t) => t.status === "completed").length} <span style={{ fontSize: 12, fontWeight: 400 }}>transfers</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "expiry_heatmap":
        return (
          <div key={id} style={{ marginBottom: 24 }} data-testid="widget-expiry-heatmap">
            {renderControls()}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: "#0F172A" }}>🔥 Expiry Risk Heatmap</h3>
                <button
                  onClick={() => onNavigate?.("batches")}
                  style={{ background: "none", border: "none", color: "#2563EB", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  View All Batches →
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                <div style={{ background: "#FEF2F2", padding: 12, borderRadius: 6, border: "1px solid #FECACA" }}>
                  <div style={{ fontSize: 11, color: "#991B1B", fontWeight: 700 }}>EXPIRED BATCHES</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#991B1B", marginTop: 4 }}>{expiryHeatmap.expired}</div>
                  <div style={{ fontSize: 11, color: "#DC2626", marginTop: 2 }}>Immediate disposition</div>
                </div>

                <div style={{ background: "#FFF7ED", padding: 12, borderRadius: 6, border: "1px solid #FFEDD5" }}>
                  <div style={{ fontSize: 11, color: "#C2410C", fontWeight: 700 }}>CRITICAL (≤ 30 DAYS)</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#EA580C", marginTop: 4 }}>{expiryHeatmap.critical30}</div>
                  <div style={{ fontSize: 11, color: "#C2410C", marginTop: 2 }}>Discount / Move first</div>
                </div>

                <div style={{ background: "#FEFCE8", padding: 12, borderRadius: 6, border: "1px solid #FEF08A" }}>
                  <div style={{ fontSize: 11, color: "#A16207", fontWeight: 700 }}>WARNING (31–90 DAYS)</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#CA8A04", marginTop: 4 }}>{expiryHeatmap.warning90}</div>
                  <div style={{ fontSize: 11, color: "#854D0E", marginTop: 2 }}>Monitor depletion rate</div>
                </div>

                <div style={{ background: "#F0FDF4", padding: 12, borderRadius: 6, border: "1px solid #BBF7D0" }}>
                  <div style={{ fontSize: 11, color: "#166534", fontWeight: 700 }}>FRESH (&gt; 90 DAYS)</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#15803D", marginTop: 4 }}>{expiryHeatmap.fresh90Plus}</div>
                  <div style={{ fontSize: 11, color: "#166534", marginTop: 2 }}>Optimal shelf life</div>
                </div>
              </div>
            </div>
          </div>
        );

      case "category_chart":
        return (
          <div key={id} style={{ marginBottom: 24 }} data-testid="widget-category-chart">
            {renderControls()}
            <div
              className="interactive-card"
              onClick={() => onNavigate?.("financials")}
              style={{ cursor: "pointer", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
            >
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
          </div>
        );

      case "top_skus":
        return (
          <div key={id} style={{ marginBottom: 24 }} data-testid="widget-top-skus">
            {renderControls()}
            <div
              className="interactive-card"
              onClick={() => onNavigate?.("products")}
              style={{ cursor: "pointer", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
            >
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
          </div>
        );

      case "velocity_trend":
        return (
          <div key={id} style={{ marginBottom: 24 }} data-testid="widget-velocity-trend">
            {renderControls()}
            <div
              className="interactive-card"
              onClick={() => onNavigate?.("analytics")}
              style={{ cursor: "pointer", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
            >
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
        );

      case "depletion_alerts":
        return (
          <div key={id} style={{ marginBottom: 24 }} data-testid="widget-depletion-alerts">
            {renderControls()}
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
                      <tr
                        key={p.id}
                        onClick={() => onNavigate?.("allstock")}
                        style={{ cursor: "pointer", borderBottom: "1px solid #F1F5F9" }}
                      >
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0F172A" }}>{cleanText(p.name)}</td>
                        <td style={{ padding: "10px 14px", color: "#64748B" }}>{p.sku}</td>
                        <td style={{ padding: "10px 14px", color: "#DC2626", fontWeight: 600 }}>{p.low_stock_threshold || 10} units</td>
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); openModal({ type: "createPO" }); }}
                            style={{ padding: "4px 8px", background: "#0F1F3D", color: "#FFF", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          >
                            Reorder
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="tab-pane active" style={{ animation: "fadeIn 0.2s ease" }}>
      {/* Real-Time Sync & Customization Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "#0F1F3D", fontSize: 22, fontWeight: 700 }}>Executive Master Dashboard</h2>
          <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: 13 }}>
            Real-time supply chain overview, inventory valuation, depletion risks, and cross-location store health.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Live Sync Status Indicator */}
          <div
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#F0FDF4", border: "1px solid #BBF7D0", padding: "6px 12px", borderRadius: 6, fontSize: 12, color: "#166534", fontWeight: 600 }}
            data-testid="live-sync-indicator"
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", display: "inline-block", boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.2)" }} />
            <span>Live Sync</span>
            <span style={{ fontSize: 11, color: "#475569", fontWeight: 400 }}>({lastRefreshed})</span>
          </div>

          {/* Refresh Trigger */}
          <button
            onClick={() => void handleManualRefresh()}
            disabled={isRefreshing}
            style={{ padding: "6px 12px", background: "#FFF", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#0F172A", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            data-testid="manual-refresh-btn"
          >
            <span style={{ display: "inline-block", transform: isRefreshing ? "rotate(360deg)" : "none", transition: "transform 0.5s ease" }}>🔄</span>
            <span>{isRefreshing ? "Refreshing…" : "Refresh"}</span>
          </button>

          {/* Customize Layout Toggle */}
          <button
            onClick={() => setIsCustomizing((prev) => !prev)}
            style={{ padding: "6px 12px", background: isCustomizing ? "#0F1F3D" : "#FFF", color: isCustomizing ? "#FFF" : "#0F172A", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            data-testid="customize-layout-btn"
          >
            ⚙️ {isCustomizing ? "Done Customizing" : "Customize Layout"}
          </button>
        </div>
      </div>

      {/* Customization Control Panel Banner */}
      {isCustomizing && (
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: 16, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontWeight: 700, color: "#1E40AF", fontSize: 13 }}>⚙️ Dashboard Customization Active</span>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#1E3A8A" }}>
              Use ▲ / ▼ to reorder widgets, or hide/show widgets. Changes save automatically.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={resetWidgetOrder}
              style={{ padding: "6px 12px", background: "#FFF", border: "1px solid #93C5FD", color: "#1D4ED8", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              data-testid="reset-layout-btn"
            >
              Reset to Default Layout
            </button>
          </div>
        </div>
      )}

      {/* Render Dynamic Widget Stream */}
      {widgetOrder.map((id, index) => renderWidget(id, index))}
    </div>
  );
}