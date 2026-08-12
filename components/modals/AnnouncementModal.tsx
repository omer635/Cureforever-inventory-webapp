"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";

export default function AnnouncementModal() {
  const { modal, closeModal, toast, refreshAll, isAdmin, vendors: allVendors } = useApp();
  const targetAnnouncement = modal?.type === "announcement" ? modal.announcement : null;

  const [title, setTitle] = useState(targetAnnouncement?.title || "");
  const [message, setMessage] = useState(targetAnnouncement?.message || "");
  const [blocking, setBlocking] = useState(targetAnnouncement?.is_blocking || false);
  const [active, setActive] = useState(targetAnnouncement ? targetAnnouncement.is_active : true);
  const [busy, setBusy] = useState(false);

  if (!isAdmin) {
    closeModal();
    return null;
  }

  const save = async () => {
    if (!title.trim() || !message.trim()) {
      toast("Title and message are required");
      return;
    }
    setBusy(true);
    try {
      if (targetAnnouncement) {
        // Update existing announcement
        await api.updateAnnouncement(targetAnnouncement.id, {
          title: title.trim(),
          message: message.trim(),
          is_blocking: blocking,
          is_active: active,
        });
        toast("Announcement updated");
      } else {
        // Create new announcement
        await api.createAnnouncement({
          title: title.trim(),
          message: message.trim(),
          is_active: true,
          is_blocking: blocking,
          created_at: new Date().toISOString(),
        });

        // Notify all vendor stores about the new announcement
        const vendorStores = allVendors.filter((v) => !v.is_admin);
        for (const v of vendorStores) {
          await api.createNotification({
            vendor_id: v.id,
            title: `📢 ${title.trim()}`,
            message: message.trim().slice(0, 200),
            module: "announcements",
          });
        }
        toast("Announcement published");
      }

      await refreshAll();
      closeModal();
    } catch (err) {
      toast("Save failed: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button className="modal-close" onClick={closeModal}>
        ×
      </button>
      <h3>{targetAnnouncement ? "Edit Announcement" : "New Announcement"}</h3>
      <p className="modal-sub">
        {targetAnnouncement ? "Update broadcast notice for vendors." : "Broadcast a notice to all vendors."}
      </p>
      <label>Title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Year-end stock audit" />
      <label>Message</label>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Details…" />
      <div className="check-row">
        <input type="checkbox" checked={blocking} onChange={(e) => setBlocking(e.target.checked)} />
        Blocking announcement (highlighted, requires acknowledgement)
      </div>
      {targetAnnouncement && (
        <div className="check-row">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (Visible to vendors)
        </div>
      )}
      <div className="modal-actions">
        <button className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
        <button className="save-btn" onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : targetAnnouncement ? "Save Changes" : "Publish"}
        </button>
      </div>
    </div>
  );
}