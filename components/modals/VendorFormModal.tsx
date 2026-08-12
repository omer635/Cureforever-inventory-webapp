"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import type { Vendor } from "@/lib/types";

export default function VendorFormModal({ vendor }: { vendor: Vendor | null }) {
  const { closeModal, toast, refreshAll, isAdmin } = useApp();
  const [name, setName] = useState(vendor?.name || "");
  const [phone, setPhone] = useState(vendor?.phone || "");
  const [address, setAddress] = useState(vendor?.address || "");
  const [email, setEmail] = useState(vendor?.email || "");
  const [isAdminV, setIsAdminV] = useState(vendor?.is_admin || false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast("Vendor name is required");
      return;
    }
    setBusy(true);
    const payload = {
      name: name.trim(),
      state: address.trim() || "HQ",
      contact_phone: phone.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      email: email.trim() || null,
    };
    try {
      if (vendor) {
        await api.updateVendor(vendor.id, payload);
      } else if (isAdmin) {
        await api.createVendor({ ...payload, is_admin: isAdminV });
      }
      await refreshAll();
      toast(vendor ? "Vendor updated" : "Vendor added");
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
      <h3>{vendor ? "Edit Vendor" : "Add Vendor"}</h3>
      <p className="modal-sub">Company or pharmacy vendor account.</p>
      <label>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vendor / company name" />
      <label>Phone</label>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx-xxxxxxx" />
      <label>Address</label>
      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" />
      <label>Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="login email (optional)" />
      {!vendor && isAdmin && (
        <div className="check-row">
          <input type="checkbox" checked={isAdminV} onChange={(e) => setIsAdminV(e.target.checked)} />
          Administrator account
        </div>
      )}
      <div className="modal-actions">
        <button className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
        <button className="save-btn" onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}