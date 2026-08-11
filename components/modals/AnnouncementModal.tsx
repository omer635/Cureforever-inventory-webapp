"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";

export default function AnnouncementModal() {
  const { closeModal, toast, refreshAll, isAdmin } = useApp();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [blocking, setBlocking] = useState(false);
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
      await api.createAnnouncement({
        title: title.trim(),
        message: message.trim(),
        is_active: true,
        is_blocking: blocking,
        created_at: new Date().toISOString(),
      });
      await refreshAll();
      toast("Announcement published");
      closeModal();
    } catch (err) {
      toast("Publish failed: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button className="modal-close" onClick={closeModal}>
        ×
      </button>
      <h3>New Announcement</h3>
      <p className="modal-sub">Broadcast a notice to all vendors.</p>
      <label>Title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Year-end stock audit" />
      <label>Message</label>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Details…" />
      <div className="check-row">
        <input type="checkbox" checked={blocking} onChange={(e) => setBlocking(e.target.checked)} />
        Blocking announcement (highlighted, requires acknowledgement)
      </div>
      <div className="modal-actions">
        <button className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
        <button className="save-btn" onClick={() => void save()} disabled={busy}>
          {busy ? "Publishing…" : "Publish"}
        </button>
      </div>
    </div>
  );
}