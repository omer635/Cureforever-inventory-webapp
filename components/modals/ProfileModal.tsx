"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import type { Vendor } from "@/lib/types";

export default function ProfileModal() {
  const { vendorRow, toast, closeModal, updateVendorRow, refreshAll } = useApp();
  const [form, setForm] = useState<Vendor>({
    ...(vendorRow as Vendor),
  });
  const [busy, setBusy] = useState(false);

  if (!vendorRow) return null;

  const save = async () => {
    setBusy(true);
    try {
      await api.updateVendor(form.id, {
        name: form.name,
        phone: form.phone || null,
        address: form.address || null,
        email: form.email || null,
      });
      updateVendorRow({ ...form });
      await refreshAll();
      toast("Profile updated");
      closeModal();
    } catch (err) {
      toast("Update failed: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button className="modal-close" onClick={closeModal}>
        ×
      </button>
      <h3>My Profile</h3>
      <p className="modal-sub">{vendorRow.name} · Vendor account</p>
      <label>Name</label>
      <input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <label>Phone</label>
      <input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <label>Address</label>
      <input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      <label>Email</label>
      <input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <div className="modal-actions">
        <button className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
        <button className="save-btn" onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}