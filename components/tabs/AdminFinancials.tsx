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

  // Comprehensive Valuation Comparison (Weighted Avg vs FIFO vs LIFO side-by-side)
  const valuationComparison = useMemo(() => {
    let weightedTotal = 0;
    let fifoTotal = 0;
    let lifoTotal = 0;
    let retailTotal = 0;

    const perProductRows = products.map((p) => {
      const pEntries = stockEntries.filter((se) => se.product_id === p.id);
      const totalQty = pEntries.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
      const pBatches = productBatches.filter((b) => b.product_id === p.id);

      let weightedCost = p.cost_price;
      let fifoCost = p.cost_price;
      let lifoCost = p.cost_price;

      if (pBatches.length > 0) {
        const totalBatchQty = pBatches.reduce((acc, b) => acc + (b.quantity || 1), 0);
        const weightedCostSum = pBatches.reduce((acc, b) => acc + (b.cost_price || p.cost_price) * (b.quantity || 1), 0);
        weightedCost = totalBatchQty > 0 ? weightedCostSum / totalBatchQty : p.cost_price;

        const oldestBatch = [...pBatches].sort((a, b) => a.received_date.localeCompare(b.received_date))[0];
        fifoCost = oldestBatch?.cost_price || p.cost_price;

        const newestBatch = [...pBatches].sort((a, b) => b.received_date.localeCompare(a.received_date))[0];
        lifoCost = newestBatch?.cost_price || p.cost_price;
      }

      const weightedVal = totalQty * weightedCost;
      const fifoVal = totalQty * fifoCost;
      const lifoVal = totalQty * lifoCost;
      const retailVal = totalQty * p.selling_price;

      weightedTotal += weightedVal;
      fifoTotal += fifoVal;
      lifoTotal += lifoVal;
      retailTotal += retailVal;

      return {
        product: p,
        totalQty,
        weightedCost,
        fifoCost,
        lifoCost,
        weightedVal,
        fifoVal,
        lifoVal,
        retailVal,
        fifoLifoDiff: fifoVal - lifoVal,
      };
    });

    const fifoLifoVariance = fifoTotal - lifoTotal;

    return {
      perProductRows,
      weightedTotal,
      fifoTotal,
      lifoTotal,
      retailTotal,
      fifoLifoVariance,
    };
  }, [products, stockEntries, productBatches]);

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

  const exportValuationComparisonCSV = () => {
    const header = [
      "SKU",
      "Product Name",
      "Category",
      "Total On-Hand Qty",
      "Weighted Avg Unit Cost",
      "FIFO Unit Cost",
      "LIFO Unit Cost",
      "Weighted Avg Total Value",
      "FIFO Total Value",
      "LIFO Total Value",
      "FIFO vs LIFO Delta",
    ];
    const data = valuationComparison.perProductRows.map((r) => [
      r.product.sku,
      r.product.name,
      r.product.category || "",
      r.totalQty,
      r.weightedCost.toFixed(2),
      r.fifoCost.toFixed(2),
      r.lifoCost.toFixed(2),
      r.weightedVal.toFixed(2),
      r.fifoVal.toFixed(2),
      r.lifoVal.toFixed(2),
      r.fifoLifoDiff.toFixed(2),
    ]);
    downloadCSV(`fifo-lifo-valuation-report-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
  };

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
              data-testid="valuation-model-select"
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
              data-testid="currency-select"
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

      {/* Side-by-Side Accounting Valuation Model Comparison Matrix */}
      <div style={{ background: "#FFF", padding: 16, borderRadius: 8, border: "1px solid #E5E7EB", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h4 style={{ margin: 0, fontSize: 14, color: "#0F1F3D", fontWeight: 700 }}>
            📊 Valuation Model Side-by-Side Comparison (FIFO vs LIFO vs Weighted Avg)
          </h4>
          <button
            onClick={exportValuationComparisonCSV}
            style={{ padding: "6px 14px", background: "#0F1F3D", color: "#FFF", borderRadius: 4, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
            data-testid="export-valuation-comparison-btn"
          >
            📥 Export FIFO/LIFO Comparison CSV
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 6, border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>WEIGHTED AVERAGE COST</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>
              {fmtCurrency(valuationComparison.weightedTotal)}
            </div>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Balanced smooth average</div>
          </div>

          <div style={{ background: "#EFF6FF", padding: 12, borderRadius: 6, border: "1px solid #BFDBFE" }}>
            <div style={{ fontSize: 11, color: "#1E40AF", fontWeight: 600 }}>FIFO (FIRST-IN, FIRST-OUT)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1E3A8A", marginTop: 4 }}>
              {fmtCurrency(valuationComparison.fifoTotal)}
            </div>
            <div style={{ fontSize: 11, color: "#2563EB", marginTop: 2 }}>Oldest batch costs applied</div>
          </div>

          <div style={{ background: "#FEF3C7", padding: 12, borderRadius: 6, border: "1px solid #FDE68A" }}>
            <div style={{ fontSize: 11, color: "#92400E", fontWeight: 600 }}>LIFO (LAST-IN, FIRST-OUT)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#78350F", marginTop: 4 }}>
              {fmtCurrency(valuationComparison.lifoTotal)}
            </div>
            <div style={{ fontSize: 11, color: "#D97706", marginTop: 2 }}>Newest batch costs applied</div>
          </div>

          <div style={{ background: "#F3E8FF", padding: 12, borderRadius: 6, border: "1px solid #E9D5FF" }}>
            <div style={{ fontSize: 11, color: "#6B21A8", fontWeight: 600 }}>FIFO vs LIFO VARIANCE</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#581C87", marginTop: 4 }}>
              {fmtCurrency(Math.abs(valuationComparison.fifoLifoVariance))}
            </div>
            <div style={{ fontSize: 11, color: "#7E22CE", marginTop: 2 }}>
              {valuationComparison.fifoLifoVariance >= 0 ? "FIFO higher by" : "LIFO higher by"} {Math.abs(valuationComparison.fifoLifoVariance).toFixed(0)}
            </div>
          </div>
        </div>
      </div>

      {/* Financial Valuation Stat Cards */}
      <div className="stat-row">
        <div className="stat ok" data-testid="cost-valuation-card">
          <div className="num" data-testid="cost-valuation-display">{fmtCurrency(valuation.totalCostVal)}</div>
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
            <button className="export-btn" onClick={exportCSV} data-testid="export-csv-btn">
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