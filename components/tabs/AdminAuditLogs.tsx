"use client";

import React, { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";

type ViewMode = "table" | "timeline";
type DatePreset = "all" | "today" | "7days" | "30days";

export default function AdminAuditLogs() {
  const { stockAdjustments, vendors, products } = useApp();
  const [selectedReason, setSelectedReason] = useState<string>("all");
  const [selectedVendor, setSelectedVendor] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");

  const vendorMap = useMemo(() => {
    const map: Record<string, string> = {};
    vendors.forEach((v) => {
      map[v.id] = v.name;
    });
    return map;
  }, [vendors]);

  const productMap = useMemo(() => {
    const map: Record<string, { name: string; sku: string; cost: number }> = {};
    products.forEach((p) => {
      map[p.id] = { name: p.name, sku: p.sku, cost: p.cost_price || 0 };
    });
    return map;
  }, [products]);

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "7days") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === "30days") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
    }
  };

  const filteredLogs = useMemo(() => {
    return stockAdjustments.filter((sa) => {
      const matchesReason = selectedReason === "all" || sa.reason_code === selectedReason;
      const matchesVendor = selectedVendor === "all" || sa.vendor_id === selectedVendor;
      const prod = productMap[sa.product_id];
      const matchesSearch =
        !searchQuery ||
        (prod?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (prod?.sku || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sa.notes || "").toLowerCase().includes(searchQuery.toLowerCase());

      const itemDate = (sa.created_at || "").slice(0, 10);
      const matchesStart = !startDate || itemDate >= startDate;
      const matchesEnd = !endDate || itemDate <= endDate;

      return matchesReason && matchesVendor && matchesSearch && matchesStart && matchesEnd;
    });
  }, [stockAdjustments, selectedReason, selectedVendor, searchQuery, startDate, endDate, productMap]);

  const summaryMetrics = useMemo(() => {
    let totalIncreases = 0;
    let totalDecreases = 0;
    let totalValuationImpact = 0;
    const reasonCounts: Record<string, number> = {};

    filteredLogs.forEach((sa) => {
      const change = sa.change_qty || 0;
      const cost = productMap[sa.product_id]?.cost || 0;
      if (change > 0) totalIncreases += change;
      else if (change < 0) totalDecreases += Math.abs(change);

      totalValuationImpact += change * cost;

      const code = sa.reason_code || "manual_adjustment";
      reasonCounts[code] = (reasonCounts[code] || 0) + 1;
    });

    return {
      totalCount: filteredLogs.length,
      totalIncreases,
      totalDecreases,
      netChange: totalIncreases - totalDecreases,
      totalValuationImpact,
      reasonCounts,
    };
  }, [filteredLogs, productMap]);

  const getReasonBadge = (reason: string | null) => {
    switch (reason) {
      case "damaged_goods":
        return { bg: "#FEE2E2", color: "#991B1B", label: "Damaged Goods", icon: "⚠️" };
      case "expired_disposal":
        return { bg: "#FEF3C7", color: "#92400E", label: "Expired Disposal", icon: "🗑️" };
      case "physical_reconciliation":
        return { bg: "#DBEAFE", color: "#1E40AF", label: "Physical Audit", icon: "📦" };
      case "return_to_vendor":
        return { bg: "#EDE9FE", color: "#6D28D9", label: "Vendor Return", icon: "🔄" };
      case "qc_sample":
        return { bg: "#F3E8FF", color: "#7E22CE", label: "QC Sample", icon: "🧪" };
      default:
        return { bg: "#F3F4F6", color: "#374151", label: reason || "Manual Adjustment", icon: "✏️" };
    }
  };

  const exportAuditPDF = () => {
    window.print();
  };

  return (
    <div className="tab-pane active" style={{ animation: "fadeIn 0.2s ease" }}>
      {/* Header Bar */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "#0F1F3D", fontSize: 20 }}>Audit Trail & Compliance Log</h2>
          <p style={{ margin: "4px 0 0", color: "#5C6B73", fontSize: 13 }}>
            Immutable audit record of all stock adjustments, write-offs, physical reconciliations, and quantity modifications.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* View Mode Toggle */}
          <div style={{ background: "#F1F5F9", padding: 3, borderRadius: 6, display: "flex", gap: 2 }}>
            <button
              onClick={() => setViewMode("table")}
              style={{
                padding: "5px 12px",
                border: "none",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: viewMode === "table" ? "#FFF" : "transparent",
                color: viewMode === "table" ? "#0F172A" : "#64748B",
                boxShadow: viewMode === "table" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              }}
              data-testid="view-mode-table"
            >
              📋 Table View
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              style={{
                padding: "5px 12px",
                border: "none",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: viewMode === "timeline" ? "#FFF" : "transparent",
                color: viewMode === "timeline" ? "#0F172A" : "#64748B",
                boxShadow: viewMode === "timeline" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              }}
              data-testid="view-mode-timeline"
            >
              ⏳ Activity Timeline
            </button>
          </div>

          {/* Export PDF Button */}
          <button
            onClick={exportAuditPDF}
            style={{ padding: "6px 14px", background: "#0F1F3D", color: "#FFF", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            data-testid="export-audit-pdf-btn"
          >
            📥 Export Audit PDF
          </button>
        </div>
      </div>

      {/* Audit Executive Summary Header Card (Printable & Screen) */}
      <div style={{ background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 8, padding: 16, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h4 style={{ margin: 0, fontSize: 14, color: "#0F1F3D", fontWeight: 700 }}>
            📊 Audit Period Summary {startDate || endDate ? `(${startDate || "Start"} to ${endDate || "Present"})` : "(All Time)"}
          </h4>
          <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>{summaryMetrics.totalCount} Events Logged</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 6, border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>TOTAL ADJUSTMENT EVENTS</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>{summaryMetrics.totalCount}</div>
          </div>

          <div style={{ background: "#F0FDF4", padding: 12, borderRadius: 6, border: "1px solid #BBF7D0" }}>
            <div style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>STOCK ADDITIONS</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#15803D", marginTop: 4 }}>+{summaryMetrics.totalIncreases} units</div>
          </div>

          <div style={{ background: "#FEF2F2", padding: 12, borderRadius: 6, border: "1px solid #FECACA" }}>
            <div style={{ fontSize: 11, color: "#991B1B", fontWeight: 600 }}>STOCK DEDUCTIONS</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#DC2626", marginTop: 4 }}>-{summaryMetrics.totalDecreases} units</div>
          </div>

          <div style={{ background: summaryMetrics.netChange >= 0 ? "#EFF6FF" : "#FFF7ED", padding: 12, borderRadius: 6, border: "1px solid #BFDBFE" }}>
            <div style={{ fontSize: 11, color: summaryMetrics.netChange >= 0 ? "#1E40AF" : "#C2410C", fontWeight: 600 }}>NET QUANTITY IMPACT</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: summaryMetrics.netChange >= 0 ? "#1E3A8A" : "#EA580C", marginTop: 4 }}>
              {summaryMetrics.netChange >= 0 ? `+${summaryMetrics.netChange}` : summaryMetrics.netChange} units
            </div>
          </div>
        </div>
      </div>

      {/* Date Range & Text Filters Toolbar */}
      <div className="no-print" style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center", background: "#FFF", padding: 12, borderRadius: 8, border: "1px solid #E5E7EB" }}>
        <input
          type="text"
          placeholder="Filter by product name, SKU, or notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: "7px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13 }}
        />

        {/* Date Presets */}
        <select
          value={datePreset}
          onChange={(e) => handleDatePresetChange(e.target.value as DatePreset)}
          style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13, fontWeight: 600 }}
          data-testid="date-preset-select"
        >
          <option value="all">Date Range: All Time</option>
          <option value="today">Today</option>
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
        </select>

        {/* Custom Start & End Date Inputs */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>From:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setDatePreset("all"); }}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
            data-testid="start-date-input"
          />
          <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>To:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setDatePreset("all"); }}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}
            data-testid="end-date-input"
          />
        </div>

        <select
          value={selectedVendor}
          onChange={(e) => setSelectedVendor(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13 }}
        >
          <option value="all">All Vendors</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        <select
          value={selectedReason}
          onChange={(e) => setSelectedReason(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13 }}
        >
          <option value="all">All Reason Codes</option>
          <option value="physical_reconciliation">Physical Reconciliation</option>
          <option value="damaged_goods">Damaged Goods</option>
          <option value="expired_disposal">Expired Disposal</option>
          <option value="qc_sample">QC Sample</option>
          <option value="return_to_vendor">Return to Vendor</option>
          <option value="manual_adjustment">Manual Adjustment</option>
        </select>
      </div>

      {/* Main View Mode: Table vs Timeline */}
      {viewMode === "table" ? (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div className="table-responsive">
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", fontSize: 12, textTransform: "uppercase", color: "#4B5563" }}>
                  <th style={{ padding: "12px 16px" }}>Timestamp</th>
                  <th style={{ padding: "12px 16px" }}>Vendor / Location</th>
                  <th style={{ padding: "12px 16px" }}>Product / SKU</th>
                  <th style={{ padding: "12px 16px" }}>Prev Qty &rarr; New Qty</th>
                  <th style={{ padding: "12px 16px" }}>Adjustment</th>
                  <th style={{ padding: "12px 16px" }}>Reason Code</th>
                  <th style={{ padding: "12px 16px" }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#6B7280" }}>
                      No audit records match the selected date range or filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((sa) => {
                    const prod = productMap[sa.product_id] || { name: "Unknown Product", sku: "N/A", cost: 0 };
                    const badge = getReasonBadge(sa.reason_code);
                    const change = sa.change_qty;
                    return (
                      <tr key={sa.id} style={{ borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
                        <td style={{ padding: "12px 16px", color: "#6B7280", fontSize: 12 }}>
                          {new Date(sa.created_at).toLocaleString()}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#374151" }}>
                          {vendorMap[sa.vendor_id] || "Store"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <strong style={{ color: "#111827" }}>{prod.name}</strong>
                          <div style={{ fontSize: 11, color: "#6B7280" }}>{prod.sku}</div>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#4B5563" }}>
                          {sa.previous_qty} &rarr; <strong>{sa.new_qty}</strong>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: change > 0 ? "#059669" : change < 0 ? "#DC2626" : "#6B7280",
                            }}
                          >
                            {change > 0 ? `+${change}` : change}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ background: badge.bg, color: badge.color, padding: "4px 8px", borderRadius: 4, fontWeight: 600, fontSize: 12 }}>
                            {badge.icon} {badge.label}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#6B7280", fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {sa.notes || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* User Activity Timeline View */
        <div style={{ background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 8, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }} data-testid="audit-timeline-container">
          <h3 style={{ margin: "0 0 20px", fontSize: 16, color: "#0F1F3D" }}>⏳ Chronological User Activity Timeline</h3>
          {filteredLogs.length === 0 ? (
            <div style={{ textAlign: "center", color: "#64748B", padding: 32 }}>No audit activity records found for this period.</div>
          ) : (
            <div style={{ position: "relative", paddingLeft: 28, borderLeft: "2px solid #E2E8F0" }}>
              {filteredLogs.map((sa) => {
                const prod = productMap[sa.product_id] || { name: "Unknown Product", sku: "N/A", cost: 0 };
                const badge = getReasonBadge(sa.reason_code);
                const change = sa.change_qty;
                return (
                  <div key={sa.id} style={{ position: "relative", marginBottom: 24 }}>
                    {/* Timeline Node Icon */}
                    <div
                      style={{
                        position: "absolute",
                        left: -38,
                        top: 0,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: badge.bg,
                        border: "2px solid #FFF",
                        boxShadow: "0 0 0 1px #CBD5E1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                      }}
                    >
                      {badge.icon}
                    </div>

                    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>
                            {vendorMap[sa.vendor_id] || "Store Location"}
                          </span>
                          <span style={{ background: badge.bg, color: badge.color, padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontSize: 10 }}>
                            {badge.label}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: "#64748B" }}>
                          {new Date(sa.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div style={{ marginTop: 8, fontSize: 13, color: "#1E293B" }}>
                        Adjusted stock for <strong>{prod.name}</strong> ({prod.sku}) from {sa.previous_qty} to <strong>{sa.new_qty}</strong> units (
                        <span style={{ fontWeight: 700, color: change > 0 ? "#059669" : change < 0 ? "#DC2626" : "#6B7280" }}>
                          {change > 0 ? `+${change}` : change} units
                        </span>
                        ).
                      </div>

                      {sa.notes && (
                        <div style={{ marginTop: 6, fontSize: 12, color: "#475569", background: "#FFF", padding: "6px 10px", borderRadius: 4, border: "1px solid #E2E8F0" }}>
                          💬 Notes: {sa.notes}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
