"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import type { StockTransfer } from "@/lib/types";

export default function AdminTransfers() {
  const { stockTransfers, vendors, products, openModal, toast, refreshAll, isOnline, queueOp } = useApp();
  const [filterStatus, setFilterStatus] = useState<string>("all");

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

  const filteredTransfers = stockTransfers.filter(
    (st) => filterStatus === "all" || st.status === filterStatus
  );

  const handleUpdateStatus = async (transfer: StockTransfer, newStatus: string) => {
    try {
      if (isOnline) {
        await api.updateTransferStatus(transfer, newStatus);
        toast(`Transfer status updated to ${newStatus}`);
        await refreshAll();
      } else {
        queueOp({
          type: "transfer_status_update",
          data: { transfer, status: newStatus },
        });
        toast("Saved offline: Transfer status change");
      }
    } catch (err) {
      toast("Could not update transfer: " + (err as Error).message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return { bg: "#D1FAE5", color: "#065F46", label: "Completed" };
      case "in_transit":
        return { bg: "#DBEAFE", color: "#1E40AF", label: "In Transit" };
      case "approved":
        return { bg: "#FEF3C7", color: "#92400E", label: "Approved" };
      case "rejected":
        return { bg: "#FEE2E2", color: "#991B1B", label: "Rejected" };
      default:
        return { bg: "#F3F4F6", color: "#374151", label: "Pending Approval" };
    }
  };

  return (
    <div className="tab-pane active" style={{ animation: "fadeIn 0.2s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "#0F1F3D", fontSize: 20 }}>Multi-Location Stock Transfers</h2>
          <p style={{ margin: "4px 0 0", color: "#5C6B73", fontSize: 13 }}>
            Transfer inventory safely between vendor stores and central warehouses with full chain-of-custody tracking.
          </p>
        </div>
        <button
          className="btn-add-vendor"
          onClick={() => openModal({ type: "createTransfer" })}
          style={{ padding: "8px 16px", fontSize: 14, fontWeight: 600 }}
        >
          + Request Stock Transfer
        </button>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 16 }}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13 }}
        >
          <option value="all">All Transfer Statuses</option>
          <option value="pending">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="in_transit">In Transit</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div className="table-responsive">
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", fontSize: 12, textTransform: "uppercase", color: "#4B5563" }}>
                <th style={{ padding: "12px 16px" }}>Item & SKU</th>
                <th style={{ padding: "12px 16px" }}>Source Location</th>
                <th style={{ padding: "12px 16px" }}>Target Location</th>
                <th style={{ padding: "12px 16px" }}>Transfer Qty</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px" }}>Date</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#6B7280" }}>
                    No stock transfer records found. Click <strong>+ Request Stock Transfer</strong> to move inventory between locations.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((st) => {
                  const prod = productMap[st.product_id] || { name: "Unknown Product", sku: "N/A" };
                  const badge = getStatusBadge(st.status);
                  return (
                    <tr key={st.id} style={{ borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
                      <td style={{ padding: "12px 16px" }}>
                        <strong style={{ color: "#111827" }}>{prod.name}</strong>
                        <div style={{ fontSize: 11, color: "#6B7280" }}>{prod.sku}</div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#374151" }}>{vendorMap[st.source_vendor_id] || "Warehouse"}</td>
                      <td style={{ padding: "12px 16px", color: "#374151" }}>{vendorMap[st.target_vendor_id] || "Warehouse"}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>{st.quantity} units</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ background: badge.bg, color: badge.color, padding: "4px 8px", borderRadius: 4, fontWeight: 600, fontSize: 12 }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#6B7280", fontSize: 12 }}>
                        {new Date(st.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          {st.status === "pending" && (
                            <>
                              <button
                                className="btn-ghost"
                                onClick={() => void handleUpdateStatus(st, "approved")}
                                style={{ padding: "4px 8px", fontSize: 12, color: "#059669" }}
                              >
                                Approve
                              </button>
                              <button
                                className="btn-ghost"
                                onClick={() => void handleUpdateStatus(st, "rejected")}
                                style={{ padding: "4px 8px", fontSize: 12, color: "#DC2626" }}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {st.status === "approved" && (
                            <button
                              className="btn-ghost"
                              onClick={() => void handleUpdateStatus(st, "in_transit")}
                              style={{ padding: "4px 8px", fontSize: 12, color: "#1E40AF" }}
                            >
                              Mark In Transit
                            </button>
                          )}
                          {st.status === "in_transit" && (
                            <button
                              className="btn-ghost"
                              onClick={() => void handleUpdateStatus(st, "completed")}
                              style={{ padding: "4px 8px", fontSize: 12, color: "#059669", fontWeight: 600 }}
                            >
                              Receive Stock
                            </button>
                          )}
                        </div>
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
