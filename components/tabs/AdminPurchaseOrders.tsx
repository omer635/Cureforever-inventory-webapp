"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import type { PurchaseOrder } from "@/lib/types";

export default function AdminPurchaseOrders() {
  const { purchaseOrders, vendors, notifications, openModal, toast, refreshAll, isOnline, queueOp } = useApp();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);

  const filteredPOs = purchaseOrders.filter((po) => {
    const matchesStatus = filterStatus === "all" || po.status === filterStatus;
    const matchesSearch =
      po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.supplier.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const vendorMap = useMemo(() => {
    const map: Record<string, string> = {};
    vendors.forEach((v) => {
      map[v.id] = v.name;
    });
    return map;
  }, [vendors]);

  // Count unread PO-module notifications for the summary
  const unreadPONotifs = useMemo(
    () => notifications.filter((n) => n.module === "purchase_orders" && !n.is_read).length,
    [notifications]
  );

  const handleStatusChange = async (po: PurchaseOrder, newStatus: string) => {
    try {
      if (isOnline) {
        await api.updatePOStatus(po.id, newStatus);

        // Notify destination vendor
        if (po.destination_vendor_id) {
          await api.createNotification({
            vendor_id: po.destination_vendor_id,
            title: `PO #${po.po_number} Status Updated`,
            message: `Main Supplier set PO #${po.po_number} status to ${newStatus.replace("_", " ").toUpperCase()}`,
            module: "purchase_orders",
            module_ref_id: po.id,
          });
        }

        toast(`PO #${po.po_number} status updated to ${newStatus.replace("_", " ").toUpperCase()}`);
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

  const handleSendReplyToVendor = async (po: PurchaseOrder, targetStatus: "sent" | "accepted") => {
    const message = (replyTextMap[po.id] || "").trim();
    if (targetStatus === "sent" && !message) {
      toast("Please type a message to reply back to the vendor first.");
      return;
    }
    setSubmittingReplyId(po.id);

    try {
      let updatedNotes = po.notes || "";
      if (message) {
        updatedNotes = updatedNotes
          ? `${updatedNotes}\n[HQ Admin]: ${message}`
          : `[HQ Admin]: ${message}`;
      }

      if (isOnline) {
        await api.updatePOStatus(po.id, targetStatus, updatedNotes);

        // Notify vendor store
        if (po.destination_vendor_id) {
          const notifMsg = message
            ? `Main Supplier updated PO #${po.po_number}: "${message}"`
            : `Main Supplier updated PO #${po.po_number} status to ${targetStatus.toUpperCase()}`;

          await api.createNotification({
            vendor_id: po.destination_vendor_id,
            title: `PO #${po.po_number} — ${targetStatus === "sent" ? "Re-issued to Store" : "Accepted by HQ"}`,
            message: notifMsg,
            module: "purchase_orders",
            module_ref_id: po.id,
          });
        }

        toast(`Reply sent & PO #${po.po_number} updated to ${targetStatus.toUpperCase()}`);
        setReplyTextMap((prev) => ({ ...prev, [po.id]: "" }));
        await refreshAll();
      } else {
        toast("Saved offline: Reply queued");
      }
    } catch (err) {
      toast("Failed to send reply: " + (err as Error).message);
    } finally {
      setSubmittingReplyId(null);
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

  /** Extract vendor notes from the combined notes string */
  const extractVendorNotes = (notes: string | null): string[] => {
    if (!notes) return [];
    return notes
      .split("\n")
      .filter((line) => line.includes("[Vendor Note]:"))
      .map((line) => line.replace("[Vendor Note]:", "").trim());
  };

  /** Extract admin notes from the combined notes string */
  const extractAdminNotes = (notes: string | null): string[] => {
    if (!notes) return [];
    return notes
      .split("\n")
      .filter((line) => line.includes("[HQ Admin]:"))
      .map((line) => line.replace("[HQ Admin]:", "").trim());
  };

  return (
    <div className="tab-pane active" style={{ animation: "fadeIn 0.2s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "#0F1F3D", fontSize: 20, display: "flex", alignItems: "center", gap: 8 }}>
            Purchase Orders & Vendor Procurement
            {unreadPONotifs > 0 && (
              <span className="notif-count-badge">{unreadPONotifs}</span>
            )}
          </h2>
          <p style={{ margin: "4px 0 0", color: "#5C6B73", fontSize: 13 }}>
            Issue purchase orders to vendor stores, track vendor acceptance, review revision requests, and reply directly.
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
                  const vendorNotes = extractVendorNotes(po.notes);
                  const adminNotes = extractAdminNotes(po.notes);
                  const hasNotes = !!po.notes;
                  const isExpanded = expandedPO === po.id;
                  const isRevision = po.status === "revision_requested";

                  return (
                    <React.Fragment key={po.id}>
                      <tr
                        style={{
                          borderBottom: isExpanded ? "none" : "1px solid #F3F4F6",
                          fontSize: 13,
                          background: isRevision ? "#FFFBEB" : undefined,
                          cursor: "pointer",
                        }}
                        onClick={() => setExpandedPO(isExpanded ? null : po.id)}
                      >
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "#111827" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            #{po.po_number}
                            {isRevision && (
                              <span style={{ fontSize: 14 }} title="Has vendor revision request">💬</span>
                            )}
                          </div>
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
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                            <button
                              className="btn-ghost"
                              onClick={() => openModal({ type: "viewPO", po })}
                              style={{ padding: "4px 8px", fontSize: 12 }}
                            >
                              Inspect / Receive
                            </button>

                            <button
                              className="btn-ghost"
                              onClick={() => setExpandedPO(isExpanded ? null : po.id)}
                              style={{
                                padding: "4px 8px",
                                fontSize: 12,
                                color: isRevision ? "#92400E" : "#2563EB",
                                background: isRevision ? "#FEF3C7" : undefined,
                                borderColor: isRevision ? "#FCD34D" : undefined,
                                fontWeight: isRevision ? 700 : 500,
                              }}
                            >
                              {isExpanded ? "Hide Notes ▲" : isRevision ? "💬 Reply / View Notes ▼" : "View Notes ▼"}
                            </button>

                            {isRevision && (
                              <button
                                className="save-btn"
                                onClick={() => void handleStatusChange(po, "sent")}
                                style={{ padding: "4px 8px", fontSize: 11, background: "#1E40AF", color: "#fff" }}
                                title="Re-issue PO to Vendor as Sent"
                              >
                                📤 Re-issue PO
                              </button>
                            )}

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

                      {/* Expandable notes & Reply row */}
                      {isExpanded && (
                        <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <div
                              className="po-notes-expand"
                              style={{
                                margin: "0 16px 12px",
                                padding: 16,
                                borderRadius: 8,
                                background: isRevision ? "#FFFBEB" : "#F0F9FF",
                                border: `1px solid ${isRevision ? "#FCD34D" : "#BAE6FD"}`,
                                animation: "slideDown 0.2s ease",
                              }}
                            >
                              {/* Vendor revision messages */}
                              {vendorNotes.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                  <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    marginBottom: 6,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: "#92400E",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                  }}>
                                    💬 Vendor Revision Message{vendorNotes.length > 1 ? "s" : ""}
                                  </div>
                                  {vendorNotes.map((note, idx) => (
                                    <div
                                      key={idx}
                                      style={{
                                        padding: "10px 14px",
                                        background: "#FFFFFF",
                                        borderRadius: 6,
                                        border: "1px solid #FDE68A",
                                        fontSize: 13,
                                        color: "#1F2937",
                                        lineHeight: 1.5,
                                        marginBottom: idx < vendorNotes.length - 1 ? 6 : 0,
                                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                                      }}
                                    >
                                      {note}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* HQ Admin past replies */}
                              {adminNotes.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                  <div style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: "#1E40AF",
                                    marginBottom: 6,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                  }}>
                                    ✉️ HQ Admin Past Replies
                                  </div>
                                  {adminNotes.map((note, idx) => (
                                    <div
                                      key={idx}
                                      style={{
                                        padding: "10px 14px",
                                        background: "#EFF6FF",
                                        borderRadius: 6,
                                        border: "1px solid #BFDBFE",
                                        fontSize: 13,
                                        color: "#1E3A8A",
                                        lineHeight: 1.5,
                                        marginBottom: idx < adminNotes.length - 1 ? 6 : 0,
                                      }}
                                    >
                                      {note}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Interactive Reply Box for Admin */}
                              {po.status !== "fulfilled" && po.status !== "cancelled" && (
                                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #E2E8F0" }}>
                                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0F1F3D", display: "block", marginBottom: 4 }}>
                                    ✍️ Text / Reply Back to Vendor ({vendorMap[po.destination_vendor_id] || "Vendor Store"}):
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={replyTextMap[po.id] || ""}
                                    onChange={(e) => setReplyTextMap((prev) => ({ ...prev, [po.id]: e.target.value }))}
                                    placeholder="e.g. Approved your requested quantity adjustment, re-issuing PO now..."
                                    style={{
                                      width: "100%",
                                      padding: "8px 12px",
                                      borderRadius: 6,
                                      border: "1px solid #CBD5E1",
                                      fontSize: 13,
                                      background: "#FFFFFF",
                                      color: "#0F1F3D",
                                    }}
                                  />
                                  <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                    <button
                                      className="save-btn"
                                      onClick={() => void handleSendReplyToVendor(po, "sent")}
                                      disabled={!replyTextMap[po.id]?.trim() || submittingReplyId === po.id}
                                      style={{ background: "#1E40AF", color: "#FFFFFF", padding: "6px 14px", fontSize: 12, fontWeight: 700 }}
                                    >
                                      {submittingReplyId === po.id ? "Sending…" : "📤 Send Reply & Re-issue PO"}
                                    </button>
                                    <button
                                      className="save-btn"
                                      onClick={() => void handleSendReplyToVendor(po, "accepted")}
                                      disabled={submittingReplyId === po.id}
                                      style={{ background: "#065F46", color: "#FFFFFF", padding: "6px 14px", fontSize: 12, fontWeight: 700 }}
                                    >
                                      ✓ Accept Vendor Request
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Full raw notes log */}
                              {po.notes && (
                                <details style={{ marginTop: 12 }}>
                                  <summary style={{ fontSize: 11, color: "#64748B", cursor: "pointer", fontWeight: 600 }}>
                                    View Full Audit History Log
                                  </summary>
                                  <div style={{
                                    marginTop: 6,
                                    padding: "8px 12px",
                                    background: "#FFFFFF",
                                    borderRadius: 4,
                                    border: "1px solid #E2E8F0",
                                    fontSize: 12,
                                    color: "#475569",
                                    whiteSpace: "pre-wrap",
                                  }}>
                                    {po.notes}
                                  </div>
                                </details>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
