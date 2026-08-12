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
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAdminV, setIsAdminV] = useState(vendor?.is_admin || false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast("Vendor name is required");
      return;
    }
    if (password && password.length < 6) {
      toast("Password must be at least 6 characters long");
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
        await api.updateVendorWithAuth(vendor.id, payload, password);
        toast("Vendor account updated successfully");
      } else if (isAdmin) {
        await api.createVendorWithAuth({ ...payload, is_admin: isAdminV }, password);
        toast("New vendor store created");
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
      <h3>{vendor ? "Edit Vendor Store Account" : "Add Vendor Location"}</h3>
      <p className="modal-sub">Company or pharmacy vendor store credentials & location settings.</p>
      
      <div className="inline-form-grid">
        <div>
          <label>Vendor / Store Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vendor / company name" />
        </div>
        <div>
          <label>Contact Phone Number</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx-xxxxxxx" />
        </div>
      </div>

      <label>Store Address & Location</label>
      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City, State / Region" />

      <label>Email (Login Username)</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vendor@cureforever.in" />

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ margin: 0 }}>{vendor ? "Update Login Password (Optional)" : "Login Password"}</label>
          <button
            type="button"
            className="link-btn"
            onClick={() => setShowPassword(!showPassword)}
            style={{ fontSize: 11, padding: 0 }}
          >
            {showPassword ? "Hide Password" : "Show Password"}
          </button>
        </div>
        <input
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={vendor ? "Leave blank to keep existing password" : "Assign password (min 6 characters)"}
          style={{ marginTop: 6 }}
        />
      </div>

      {isAdmin && (
        <div className="check-row" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={isAdminV} onChange={(e) => setIsAdminV(e.target.checked)} />
          Administrator account (Full HQ Access)
        </div>
      )}

      <div className="modal-actions" style={{ marginTop: 20 }}>
        <button className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
        <button className="save-btn" onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save Vendor"}
        </button>
      </div>
    </div>
  );
}