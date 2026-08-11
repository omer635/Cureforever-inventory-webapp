"use client";

import React from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import { fmtDateTime } from "@/lib/utils";

export default function AdminAnnouncements() {
  const { announcements, openModal, refreshAll, toast } = useApp();

  const revoke = async (id: string) => {
    if (!window.confirm("Deactivate this announcement?")) return;
    try {
      await api.revokeAnnouncement(id);
      await refreshAll();
      toast("Announcement deactivated");
    } catch (err) {
      toast("Failed: " + (err as Error).message);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Announcements ({announcements.length})</h2>
        <button className="btn-add-vendor" onClick={() => openModal({ type: "announcement" })}>
          + New Announcement
        </button>
      </div>
      <div className="panel-body">
        {announcements.length === 0 && <div className="empty">No announcements yet.</div>}
        {announcements.map((a) => (
          <div key={a.id} className={`alert-item ${a.is_blocking ? "alert-danger" : ""}`}>
            <div className="alert-title">
              {a.title} {a.is_blocking && <span className="badge danger">BLOCKING</span>}
              {!a.is_active && <span className="badge">INACTIVE</span>}
            </div>
            <div className="alert-meta">{a.message}</div>
            <div className="alert-meta">Published {fmtDateTime(a.created_at)}</div>
            {a.is_active && (
              <div className="alert-actions">
                <button className="dismiss-btn" onClick={() => void revoke(a.id)}>
                  Deactivate
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}