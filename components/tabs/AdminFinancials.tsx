"use client";

import React, { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { REASONS, REASON_LABELS } from "@/lib/constants";
import { downloadCSV, fmtDateTime, money } from "@/lib/utils";
import type { Currency, ValuationModel } from "@/lib/types";

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
};

const CURRENCY_RATES: Record<Currency, number> = {
  INR: 1.0,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
  CAD: 0.016,
};

export default function AdminFinancials() {
  const { stockAdjustments, products, vendors, stockEntries, productBatches, currency, setCurrency, valuationModel, setValuationModel } = useApp();
  const [vendorFilter, setVendorFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");

  const fmtCurrency = (baseInrVal: number) => {
    const rate = CURRENCY_RATES[currency] || 1;
    const sym = CURRENCY_SYMBOLS[currency] || "₹";
    const converted = baseInrVal * rate;
    return `${sym}${converted.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const rows = useMemo(() => {
    return (stockAdjustments || [])
      .filter((a) => (vendorFilter === "all" || a.vendor_id === vendorFilter) && (reasonFilter === "all" || a.reason_code === reasonFilter))
      .slice(0, 300);
  }, [stockAdjustments, vendorFilter, reasonFilter]);

  // Inventory Valuation Calculation (FIFO vs LIFO vs Weighted Avg)
  const valuation = useMemo(() => {
    let totalCostVal = 0;
    let totalRetailVal = 0;

    products.forEach((p) => {
      const pEntries = stockEntries.filter((se) => se.product_id === p.id);
      const totalQty = pEntries.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
      const pBatches = productBatches.filter((b) => b.product_id === p.id);

      let unitCost = p.cost_price;

      if (valuationModel === "weighted_avg" && pBatches.length > 0) {
        const totalBatchQty = pBatches.reduce((acc, b) => acc + (b.quantity || 1), 0);
        const weightedCostSum = pBatches.reduce((acc, b) => acc + (b.cost_price || p.cost_price) * (b.quantity || 1), 0);
        unitCost = totalBatchQty > 0 ? weightedCostSum / totalBatchQty : p.cost_price;
      } else if (valuationModel === "fifo" && pBatches.length > 0) {
        const oldestBatch = [...pBatches].sort((a, b) => a.received_date.localeCompare(b.received_date))[0];
        unitCost = oldestBatch?.cost_price || p.cost_price;
      } else if (valuationModel === "lifo" && pBatches.length > 0) {
        const newestBatch = [...pBatches].sort((a, b) => b.received_date.localeCompare(a.received_date))[0];
        unitCost = newestBatch?.cost_price || p.cost_price;
      }

      totalCostVal += totalQty * unitCost;
      totalRetailVal += totalQty * p.selling_price;
    });

    const totalProfitMargin = totalRetailVal > 0 ? ((totalRetailVal - totalCostVal) / totalRetailVal) * 100 : 0;

    return { totalCostVal, totalRetailVal, totalProfitMargin };
  }, [products, stockEntries, productBatches, valuationModel]);

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
    downloadCSV(`financial-audit-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
  };

  return (
    <>
      {/* Valuation Model & Currency Control Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, background: "#FFF", padding: 16, borderRadius: 8, border: "1px solid #E5E7EB" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: "#0F1F3D" }}>Inventory Valuation Engine</h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6B7280" }}>
            Select accounting valuation method & local currency display.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#4B5563" }}>Valuation Model</label>
            <select
              value={valuationModel}
              onChange={(e) => setValuationModel(e.target.value as ValuationModel)}
              style={{ display: "block", padding: "6px 10px", borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13, fontWeight: 600 }}
            >
              <option value="weighted_avg">Weighted Average Cost</option>
              <option value="fifo">FIFO (First-In, First-Out)</option>
              <option value="lifo">LIFO (Last-In, First-Out)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#4B5563" }}>Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              style={{ display: "block", padding: "6px 10px", borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13, fontWeight: 600 }}
            >
              <option value="INR">INR (₹) Indian Rupee</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CAD">CAD (CA$)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Financial Valuation Stat Cards */}
      <div className="stat-row">
        <div className="stat ok">
          <div className="num">{fmtCurrency(valuation.totalCostVal)}</div>
          <div className="lbl">Total Cost Valuation ({valuationModel.toUpperCase()})</div>
        </div>
        <div className="stat">
          <div className="num">{fmtCurrency(valuation.totalRetailVal)}</div>
          <div className="lbl">Potential Retail Market Value</div>
        </div>
        <div className="stat purple">
          <div className="num">{valuation.totalProfitMargin.toFixed(1)}%</div>
          <div className="lbl">Gross Profit Margin</div>
        </div>
        <div className="stat">
          <div className="num">{rows.length}</div>
          <div className="lbl">Audit Adjustment Records</div>
        </div>
      </div>

      {/* Audit Log Panel */}
      <div className="panel">
        <div className="panel-head">
          <h2>Financial Audit & Stock Modifications</h2>
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
                    No adjustment records match the filter.
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