"use client";

import React from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import { fmtDateTime } from "@/lib/utils";
import type { Announcement } from "@/lib/types";

export default function AdminAnnouncements() {
  const { announcements, openModal, refreshAll, toast } = useApp();

  const handleToggleActive = async (a: Announcement) => {
    const nextState = !a.is_active;
    try {
      await api.toggleAnnouncementActive(a.id, nextState);
      await refreshAll();
      toast(`Announcement ${nextState ? "activated" : "deactivated"}`);
    } catch (err) {
      toast("Failed: " + (err as Error).message);
    }
  };

  const handleDelete = async (a: Announcement) => {
    if (!window.confirm(`⚠️ Are you sure you want to PERMANENTLY DELETE announcement "${a.title}"?`)) return;
    try {
      await api.deleteAnnouncement(a.id);
      await refreshAll();
      toast("Announcement deleted");
    } catch (err) {
      toast("Delete failed: " + (err as Error).message);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Announcements ({announcements.length})</h2>
        <button className="btn-add-vendor" onClick={() => openModal({ type: "announcement", announcement: null })}>
          + New Announcement
        </button>
      </div>
      <div className="panel-body">
        {announcements.length === 0 && <div className="empty">No announcements created yet.</div>}
        {announcements.map((a) => (
          <div
            key={a.id}
            className={`alert-item ${a.is_blocking ? "alert-danger" : ""}`}
            style={{
              borderLeft: a.is_blocking ? "4px solid #DC2626" : "4px solid #B8935A",
              background: a.is_active ? "#FFFFFF" : "#F8FAFC",
              opacity: a.is_active ? 1 : 0.75,
              padding: 16,
              marginBottom: 12,
              borderRadius: 6,
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0F1F3D", display: "flex", alignItems: "center", gap: 8 }}>
                  📢 {a.title}
                  {a.is_blocking && <span className="badge danger">BLOCKING</span>}
                  {a.is_active ? <span className="badge ok">ACTIVE</span> : <span className="badge warn">INACTIVE</span>}
                </div>
                <div style={{ fontSize: 13, color: "#334155", margin: "6px 0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {a.message}
                </div>
                <div style={{ fontSize: 11, color: "#64748B" }}>
                  Published: {fmtDateTime(a.created_at)}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  className="save-btn"
                  onClick={() => openModal({ type: "announcement", announcement: a })}
                  style={{ background: "#1E40AF", color: "#FFFFFF", padding: "5px 12px", fontSize: 12, fontWeight: 600 }}
                >
                  ✏️ Edit
                </button>

                <button
                  className="btn-ghost"
                  onClick={() => void handleToggleActive(a)}
                  style={{
                    padding: "5px 12px",
                    fontSize: 12,
                    color: a.is_active ? "#B45309" : "#047857",
                    borderColor: a.is_active ? "#FCD34D" : "#6EE7B7",
                    background: a.is_active ? "#FFFBEB" : "#ECFDF5",
                  }}
                >
                  {a.is_active ? "⏸️ Deactivate" : "▶️ Activate"}
                </button>

                <button
                  className="btn-ghost"
                  onClick={() => void handleDelete(a)}
                  style={{ padding: "5px 12px", fontSize: 12, color: "#DC2626", borderColor: "#FCA5A5", background: "#FEF2F2" }}
                  title="Permanently delete announcement"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}