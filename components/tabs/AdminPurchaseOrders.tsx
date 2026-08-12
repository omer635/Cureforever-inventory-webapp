"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import type { PurchaseOrder } from "@/lib/types";

export default function AdminPurchaseOrders() {
  const { purchaseOrders, vendors, openModal, toast, refreshAll, isOnline, queueOp } = useApp();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredPOs = purchaseOrders.filter((po) => {
    const matchesStatus = filterStatus === "all" || po.status === filterStatus;
    const matchesSearch =
      po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.supplier.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const vendorMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    vendors.forEach((v) => {
      map[v.id] = v.name;
    });
    return map;
  }, [vendors]);

  const handleStatusChange = async (po: PurchaseOrder, newStatus: string) => {
    try {
      if (isOnline) {
        await api.updatePOStatus(po.id, newStatus);
        toast(`PO #${po.po_number} status updated to ${newStatus}`);
        await refreshAll();
      } else {
        queueOp({
          type: "purchase_order_create",
          data: { id: po.id, status: newStatus },
        });
        toast("Saved offline: PO status change");
      }
    } catch (err) {
      toast("Could not update PO status: " + (err as Error).message);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "accepted":
        return { bg: "#D1FAE5", color: "#065F46", label: "Accepted by Vendor" };
      case "revision_requested":
        return { bg: "#FEF3C7", color: "#92400E", label: "Revision Requested" };
      case "rejected":
        return { bg: "#FEE2E2", color: "#991B1B", label: "Declined by Vendor" };
      case "fulfilled":
      case "completed":
        return { bg: "#ECFDF5", color: "#047857", label: "Completed" };
      case "sent":
        return { bg: "#DBEAFE", color: "#1E40AF", label: "Sent to Vendor" };
      case "partially_received":
        return { bg: "#FEF3C7", color: "#D97706", label: "Partially Received" };
      case "cancelled":
        return { bg: "#FEE2E2", color: "#991B1B", label: "Cancelled" };
      default:
        return { bg: "#F3F4F6", color: "#374151", label: "Draft" };
    }
  };

  return (
    <div className="tab-pane active" style={{ animation: "fadeIn 0.2s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "#0F1F3D", fontSize: 20 }}>Purchase Orders & Vendor Procurement</h2>
          <p style={{ margin: "4px 0 0", color: "#5C6B73", fontSize: 13 }}>
            Issue purchase orders to vendor stores, track vendor acceptance, review revision requests, and receive inventory.
          </p>
        </div>
        <button
          className="btn-add-vendor"
          onClick={() => openModal({ type: "createPO" })}
          style={{ padding: "8px 16px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
        >
          + Create Purchase Order
        </button>
      </div>

      {/* Filters & Search */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search by PO # or Supplier..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: 240, padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13 }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13 }}
        >
          <option value="all">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="revision_requested">Revision Requested</option>
          <option value="rejected">Declined</option>
          <option value="partially_received">Partially Received</option>
          <option value="fulfilled">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* PO Table */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div className="table-responsive">
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", fontSize: 12, textTransform: "uppercase", color: "#4B5563" }}>
                <th style={{ padding: "12px 16px" }}>PO Number</th>
                <th style={{ padding: "12px 16px" }}>Supplier</th>
                <th style={{ padding: "12px 16px" }}>Destination Location</th>
                <th style={{ padding: "12px 16px" }}>Expected Delivery</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#6B7280" }}>
                    No purchase orders found. Click <strong>+ Create Purchase Order</strong> to issue your first order.
                  </td>
                </tr>
              ) : (
                filteredPOs.map((po) => {
                  const badge = getStatusBadgeClass(po.status);
                  return (
                    <tr key={po.id} style={{ borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "#111827" }}>
                        #{po.po_number}
                        <div style={{ fontSize: 11, color: "#6B7280" }}>
                          Created: {new Date(po.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#374151" }}>{po.supplier}</td>
                      <td style={{ padding: "12px 16px", color: "#4B5563" }}>
                        {vendorMap[po.destination_vendor_id] || "Main Warehouse"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#4B5563" }}>
                        {po.expected_delivery ? new Date(po.expected_delivery).toLocaleDateString() : "Flexible"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ background: badge.bg, color: badge.color, padding: "4px 8px", borderRadius: 4, fontWeight: 600, fontSize: 12 }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            className="btn-ghost"
                            onClick={() => openModal({ type: "viewPO", po })}
                            style={{ padding: "4px 8px", fontSize: 12 }}
                          >
                            View & Receive
                          </button>
                          {po.status === "draft" && (
                            <button
                              className="btn-ghost"
                              onClick={() => void handleStatusChange(po, "sent")}
                              style={{ padding: "4px 8px", fontSize: 12, color: "#1E40AF" }}
                            >
                              Mark Sent
                            </button>
                          )}
                          {po.status !== "fulfilled" && po.status !== "cancelled" && (
                            <button
                              className="btn-ghost"
                              onClick={() => void handleStatusChange(po, "cancelled")}
                              style={{ padding: "4px 8px", fontSize: 12, color: "#DC2626" }}
                            >
                              Cancel
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
