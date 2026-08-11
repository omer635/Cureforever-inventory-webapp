"use client";

import React, { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { REASONS, REASON_LABELS } from "@/lib/constants";
import { downloadCSV, fmtDateTime, money } from "@/lib/utils";

export default function AdminFinancials() {
  const { stockAdjustments, products, vendors, stockHistory } = useApp();
  const [vendorFilter, setVendorFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");

  const rows = useMemo(() => {
    return (stockAdjustments || [])
      .filter((a) => (vendorFilter === "all" || a.vendor_id === vendorFilter) && (reasonFilter === "all" || a.reason_code === reasonFilter))
      .slice(0, 300);
  }, [stockAdjustments, vendorFilter, reasonFilter]);

  const totals = useMemo(() => {
    let costValue = 0;
    let changeTotal = 0;
    rows.forEach((a) => {
      const product = products.find((p) => p.id === a.product_id);
      changeTotal += Math.abs(Number(a.change_qty) || 0);
      costValue += (Number(a.change_qty) || 0) * (product?.cost_price ?? 0);
    });
    return { changeTotal, costValue };
  }, [rows, products]);

  const avgDaily = useMemo(() => {
    const sorted = [...(stockHistory || [])].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    if (sorted.length < 2) return null;
    const first = new Date(sorted[0].recorded_at).getTime();
    const last = new Date(sorted[sorted.length - 1].recorded_at).getTime();
    const days = (last - first) / 86400000;
    if (days <= 0) return null;
    const total = sorted.reduce((sum, h) => sum + (Number(h.quantity) || 0), 0);
    return total / days;
  }, [stockHistory]);

  const exportCSV = () => {
    const header = ["When", "Vendor", "Product", "Prev", "New", "Change", "Reason", "Notes"];
    const data = rows.map((a) => [
      fmtDateTime(a.created_at),
      vendors.find((v) => v.id === a.vendor_id)?.name || "",
      products.find((p) => p.id === a.product_id)?.name || "",
      a.previous_qty,
      a.new_qty,
      a.change_qty,
      REASON_LABELS[a.reason_code || ""] || a.reason_code || "",
      a.notes || "",
    ]);
    downloadCSV(`adjustments-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
  };

  return (
    <>
      <div className="stat-row">
        <div className="stat">
          <div className="num">{rows.length}</div>
          <div className="lbl">Adjustment records</div>
        </div>
        <div className="stat">
          <div className="num">{totals.changeTotal.toLocaleString()}</div>
          <div className="lbl">Units moved</div>
        </div>
        <div className="stat ok">
          <div className="num">{money(totals.costValue, 0)}</div>
          <div className="lbl">Net cost movement</div>
        </div>
        <div className="stat purple">
          <div className="num">{avgDaily !== null ? avgDaily.toFixed(1) : "—"}</div>
          <div className="lbl">Avg recorded qty / day</div>
          <div className="mini-stat-note">based on stock history snapshots</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Financials & Adjustments</h2>
          <div className="filters">
            <select className="reason-select" value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
              <option value="all">All vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <select className="reason-select" value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}>
              <option value="all">All reasons</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {REASON_LABELS[r]}
                </option>
              ))}
            </select>
            <button className="export-btn" onClick={exportCSV}>
              Export CSV
            </button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Vendor</th>
                <th>Product</th>
                <th>Prev</th>
                <th>New</th>
                <th>Change</th>
                <th>Reason</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    No adjustment records.
                  </td>
                </tr>
              )}
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{fmtDateTime(a.created_at)}</td>
                  <td>{vendors.find((v) => v.id === a.vendor_id)?.name || "—"}</td>
                  <td>{products.find((p) => p.id === a.product_id)?.name || "—"}</td>
                  <td>{a.previous_qty}</td>
                  <td>{a.new_qty}</td>
                  <td style={{ color: Number(a.change_qty) < 0 ? "#B3261E" : Number(a.change_qty) > 0 ? "#2F6B4F" : "inherit" }}>
                    {Number(a.change_qty) > 0 ? `+${a.change_qty}` : a.change_qty}
                  </td>
                  <td>
                    <span className="state-tag">{REASON_LABELS[a.reason_code || ""] || a.reason_code || "—"}</span>
                  </td>
                  <td style={{ maxWidth: 200 }}>{a.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}