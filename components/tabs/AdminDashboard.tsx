"use client";

import React, { useEffect, useMemo, useRef } from "react";
import Chart from "chart.js/auto";
import { useApp } from "@/components/AppProvider";
import { REASON_LABELS } from "@/lib/constants";
import { computeVendorRowsAll, money, stockStatus } from "@/lib/utils";

export default function AdminDashboard() {
  const { products, productBatches, vendors, stockEntries, stockAdjustments, reorderRequests, stockHistory, visibilityMap } = useApp();
  const reasonChartRef = useRef<HTMLCanvasElement>(null);
  const trendChartRef = useRef<HTMLCanvasElement>(null);
  const reasonChart = useRef<Chart | null>(null);
  const trendChart = useRef<Chart | null>(null);

  const rows = useMemo(() => computeVendorRowsAll(stockEntries, productBatches, products, vendors), [stockEntries, productBatches, products, vendors]);

  const stats = useMemo(() => {
    const stockValue = rows.reduce((sum, r) => sum + (r.batch?.rate ?? r.product.cost_price ?? 0) * r.entry.quantity, 0);
    const low = rows.filter((r) => stockStatus(r.product, r.entry.quantity) !== "in").length;
    const pending = reorderRequests.filter((r) => r.status === "pending").length;
    const expiring = rows.filter((r) => {
      // eslint-disable-next-line react-hooks/purity
      const exp = r.batch?.expiry_date ? new Date(r.batch.expiry_date).getTime() - Date.now() : null;
      return exp !== null && exp < 30 * 86400000 && exp >= 0;
    }).length;
    return { stockValue, low, pending, expiring };
  }, [rows, reorderRequests]);

  const reasonCounts = useMemo(() => {
    const map: Record<string, number> = {};
    stockAdjustments.forEach((a) => {
      const key = a.reason_code || "manual_adjustment";
      map[key] = (map[key] || 0) + Math.abs(Number(a.change_qty) || 0);
    });
    return map;
  }, [stockAdjustments]);

  const trendPoints = useMemo(() => {
    const series = (stockHistory || []).reduce((acc, h) => {
      const day = (h.recorded_at || "").slice(0, 10);
      acc[day] = (acc[day] || 0) + (Number(h.quantity) || 0);
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(series).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  }, [stockHistory]);

  useEffect(() => {
    if (reasonChartRef.current) {
      if (reasonChart.current) reasonChart.current.destroy();
      reasonChart.current = new Chart(reasonChartRef.current, {
        type: "doughnut",
        data: {
          labels: Object.keys(reasonCounts).map((k) => REASON_LABELS[k] || k),
          datasets: [
            {
              data: Object.values(reasonCounts),
              backgroundColor: ["#0F1F3D", "#B8935A", "#B3261E", "#B8722A", "#5B21B6", "#2F6B4F"],
            },
          ],
        },
        options: { responsive: true, plugins: { legend: { position: "bottom" } } },
      });
    }
    return () => {
      if (reasonChart.current) {
        reasonChart.current.destroy();
        reasonChart.current = null;
      }
    };
  }, [reasonCounts]);

  useEffect(() => {
    if (trendChartRef.current) {
      if (trendChart.current) trendChart.current.destroy();
      trendChart.current = new Chart(trendChartRef.current, {
        type: "line",
        data: {
          labels: trendPoints.map((p) => p[0]),
          datasets: [
            {
              label: "Recorded quantity",
              data: trendPoints.map((p) => p[1]),
              borderColor: "#B8935A",
              backgroundColor: "rgba(184,147,90,.12)",
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: { responsive: true, plugins: { legend: { display: false } } },
      });
    }
    return () => {
      if (trendChart.current) {
        trendChart.current.destroy();
        trendChart.current = null;
      }
    };
  }, [trendPoints]);

  return (
    <>
      <div className="stat-row">
        <div className="stat">
          <div className="num">{products.length}</div>
          <div className="lbl">Products</div>
        </div>
        <div className="stat">
          <div className="num">{vendors.length}</div>
          <div className="lbl">Vendors</div>
        </div>
        <div className="stat ok">
          <div className="num">{money(stats.stockValue, 0)}</div>
          <div className="lbl">Total stock value</div>
        </div>
        <div className="stat warn">
          <div className="num">{stats.low}</div>
          <div className="lbl">Low / out lines</div>
        </div>
        <div className="stat">
          <div className="num">{stats.expiring}</div>
          <div className="lbl">Expiring ≤ 30 days</div>
        </div>
        <div className="stat purple">
          <div className="num">{stats.pending}</div>
          <div className="lbl">Pending reorders</div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>Insights</h2>
        </div>
        <div className="panel-body" style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <div className="chart-card">
            <h3>Movement by reason</h3>
            {Object.keys(reasonCounts).length === 0 ? (
              <div className="empty">No adjustments recorded yet.</div>
            ) : (
              <canvas ref={reasonChartRef} height={150} />
            )}
          </div>
          <div className="chart-card">
            <h3>Stock trend (last 14 days)</h3>
            {trendPoints.length === 0 ? (
              <div className="empty">No history recorded yet.</div>
            ) : (
              <canvas ref={trendChartRef} height={150} />
            )}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#6B7280" }}>
        Visibility restricted products: {Object.keys(visibilityMap).filter((k) => (visibilityMap[k]?.size || 0) > 0).length}
      </div>
    </>
  );
}