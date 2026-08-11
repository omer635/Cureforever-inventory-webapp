"use client";

import React, { useEffect, useMemo, useRef } from "react";
import Chart from "chart.js/auto";
import { useApp } from "@/components/AppProvider";
import type { StockEntry } from "@/lib/types";
import { fmtDateTime } from "@/lib/utils";

interface Point {
  t: string;
  qty: number;
  delta: number;
}

export default function HistoryModal({ entry }: { entry: StockEntry }) {
  const { products, vendors, productBatches, stockHistory: allHistory, closeModal } = useApp();
  const product = products.find((p) => p.id === entry.product_id);
  const vendor = vendors.find((v) => v.id === entry.vendor_id);
  const batch = entry.batch_id ? productBatches.find((b) => b.id === entry.batch_id) : undefined;
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const points: Point[] = useMemo(() => {
    const mine = (allHistory || [])
      .filter((h) => h.product_id === entry.product_id && h.vendor_id === entry.vendor_id)
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    const out: Point[] = [];
    mine.forEach((h, i) => {
      const prev = mine[i - 1];
      out.push({ t: h.recorded_at, qty: Number(h.quantity) || 0, delta: prev ? (Number(h.quantity) || 0) - (Number(prev.quantity) || 0) : 0 });
    });
    return out;
  }, [allHistory, entry.product_id, entry.vendor_id]);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();
    chartInstance.current = new Chart(chartRef.current, {
      type: "line",
      data: {
        labels: points.map((p) => fmtDateTime(p.t)),
        datasets: [
          {
            label: "Quantity",
            data: points.map((p) => p.qty),
            borderColor: "#0F1F3D",
            backgroundColor: "rgba(15,31,61,.08)",
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [points]);

  return (
    <div>
      <button className="modal-close" onClick={closeModal}>
        ×
      </button>
      <h3>Stock History</h3>
      <p className="modal-sub">
        {product?.name || "Unknown product"} · {vendor?.name || "Unknown vendor"}
        {batch ? ` · Batch ${batch.expiry_date?.slice(0, 10) || batch.id.slice(0, 8)}` : ""}
      </p>
      <canvas ref={chartRef} height={110} />
      <div className="preview-table-wrap" style={{ marginTop: 14 }}>
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Qty</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {points.length === 0 && (
              <tr>
                <td colSpan={3} className="empty">
                  No history recorded yet.
                </td>
              </tr>
            )}
            {[...points].reverse().map((p, i) => (
              <tr key={i}>
                <td>{fmtDateTime(p.t)}</td>
                <td>{p.qty}</td>
                <td style={{ color: p.delta < 0 ? "#B3261E" : p.delta > 0 ? "#2F6B4F" : "inherit" }}>
                  {p.delta === 0 ? "—" : p.delta > 0 ? `+${p.delta}` : p.delta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="modal-actions">
        <button className="btn-secondary" onClick={closeModal}>
          Close
        </button>
      </div>
    </div>
  );
}