"use client";

import React from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import { fmtDateTime } from "@/lib/utils";

export default function AlertsModal() {
  const { announcements, announcementReads, vendors, reorderRequests, queueOp, refreshAll, toast, closeModal, isAdmin, vendorRow } = useApp();

  const vendorReads = new Set(
    (announcementReads || [])
      .filter((r) => r.vendor_id === vendorRow?.id)
      .map((r) => r.announcement_id)
  );

  const unread = (announcements || []).filter((a) => a.is_active && !vendorReads.has(a.id));

  const dismiss = async (id: string) => {
    if (!vendorRow) return;
    queueOp({ type: "announcement_read", data: { announcement_id: id, vendor_id: vendorRow.id } });
    await refreshAll();
    toast("Marked as read");
  };

  const pending = (reorderRequests || []).filter((r) => r.status === "pending");

  return (
    <div>
      <button className="modal-close" onClick={closeModal}>
        ×
      </button>
      <h3>Alerts & Notices</h3>
      <p className="modal-sub">
        {unread.length} unread announcement{unread.length === 1 ? "" : "s"}
        {isAdmin ? ` · ${pending.length} pending reorder request${pending.length === 1 ? "" : "s"}` : ""}
      </p>

      {isAdmin && pending.length > 0 && (
        <>
          <h3 style={{ fontSize: 15 }}>Pending Reorder Requests</h3>
          <div className="alert-list">
            {pending.slice(0, 10).map((r) => {
              const vendor = vendors?.find((v) => v.id === r.vendor_id);
              return (
                <div key={r.id} className="alert-item alert-warn">
                  <div className="alert-title">Reorder #{r.id.slice(0, 8)} · {vendor?.name || "Unknown vendor"}</div>
                  <div className="alert-meta">
                    Quantity: {r.quantity} · {fmtDateTime(r.created_at)}
                  </div>
                  <div className="alert-actions">
                    <button className="save-btn" onClick={() => void approve(r.id)}>
                      Approve
                    </button>
                    <button className="btn-danger" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => void reject(r.id)}>
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h3 style={{ fontSize: 15 }}>Announcements</h3>
      <div className="alert-list">
        {announcements?.length === 0 && <div className="empty">No announcements.</div>}
        {announcements?.map((a) => {
          const isUnread = unread.some((u) => u.id === a.id);
          return (
            <div key={a.id} className={`alert-item ${a.is_blocking ? "alert-danger" : isUnread ? "alert-warn" : ""}`}>
              <div className="alert-title">
                {a.title} {a.is_blocking ? "· BLOCKING" : ""}
              </div>
              <div className="alert-meta">{a.message}</div>
              <div className="alert-meta">{fmtDateTime(a.created_at)}</div>
              {isUnread && (
                <div className="alert-actions">
                  <button className="dismiss-btn" onClick={() => void dismiss(a.id)}>
                    Mark as read
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  async function approve(id: string) {
    try {
      await api.updateReorderStatus(id, "approved");
      await refreshAll();
      toast("Reorder approved");
    } catch (err) {
      toast("Failed: " + (err as Error).message);
    }
  }

  async function reject(id: string) {
    try {
      await api.updateReorderStatus(id, "rejected");
      await refreshAll();
      toast("Reorder rejected");
    } catch (err) {
      toast("Failed: " + (err as Error).message);
    }
  }
}