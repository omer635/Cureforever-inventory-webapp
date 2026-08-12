"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppProvider";

export default function AdminAuditLogs() {
  const { stockAdjustments, vendors, products } = useApp();
  const [selectedReason, setSelectedReason] = useState<string>("all");
  const [selectedVendor, setSelectedVendor] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const vendorMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    vendors.forEach((v) => {
      map[v.id] = v.name;
    });
    return map;
  }, [vendors]);

  const productMap = React.useMemo(() => {
    const map: Record<string, { name: string; sku: string }> = {};
    products.forEach((p) => {
      map[p.id] = { name: p.name, sku: p.sku };
    });
    return map;
  }, [products]);

  const filteredLogs = stockAdjustments.filter((sa) => {
    const matchesReason = selectedReason === "all" || sa.reason_code === selectedReason;
    const matchesVendor = selectedVendor === "all" || sa.vendor_id === selectedVendor;
    const prod = productMap[sa.product_id];
    const matchesSearch =
      !searchQuery ||
      (prod?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (prod?.sku || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sa.notes || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesReason && matchesVendor && matchesSearch;
  });

  const getReasonBadge = (reason: string | null) => {
    switch (reason) {
      case "damaged_goods":
        return { bg: "#FEE2E2", color: "#991B1B", label: "Damaged Goods" };
      case "expired_disposal":
        return { bg: "#FEF3C7", color: "#92400E", label: "Expired Disposal" };
      case "physical_reconciliation":
        return { bg: "#DBEAFE", color: "#1E40AF", label: "Physical Audit" };
      case "return_to_vendor":
        return { bg: "#EDE9FE", color: "#6D28D9", label: "Vendor Return" };
      case "qc_sample":
        return { bg: "#F3E8FF", color: "#7E22CE", label: "QC Sample" };
      default:
        return { bg: "#F3F4F6", color: "#374151", label: reason || "Manual Adjustment" };
    }
  };

  return (
    <div className="tab-pane active" style={{ animation: "fadeIn 0.2s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "#0F1F3D", fontSize: 20 }}>Audit Trail & Compliance Log</h2>
          <p style={{ margin: "4px 0 0", color: "#5C6B73", fontSize: 13 }}>
            Immutable audit record of all stock adjustments, write-offs, physical reconciliations, and quantity modifications.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Filter by product name, SKU, or notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: 220, padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13 }}
        />
        <select
          value={selectedVendor}
          onChange={(e) => setSelectedVendor(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13 }}
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
          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13 }}
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

      {/* Audit Log Table */}
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
                    No audit records match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((sa) => {
                  const prod = productMap[sa.product_id] || { name: "Unknown Product", sku: "N/A" };
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
                          {badge.label}
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
    </div>
  );
}
