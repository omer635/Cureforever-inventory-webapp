"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import type { Vendor } from "@/lib/types";

export default function VendorFormModal({ vendor }: { vendor: Vendor | null }) {
  const { closeModal, toast, refreshAll, isAdmin } = useApp();
  const [name, setName] = useState(vendor?.name || "");
  const [phone, setPhone] = useState(vendor?.phone || vendor?.contact_phone || "");
  const [email, setEmail] = useState(vendor?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAdminV, setIsAdminV] = useState(vendor?.is_admin || false);
  const [busy, setBusy] = useState(false);

  // Address sub-fields
  const [streetAddress, setStreetAddress] = useState(vendor?.address || "");
  const [city, setCity] = useState("");
  const [state, setState] = useState(vendor?.state || "");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("India");

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

    // Build comprehensive full address string
    const addressParts = [
      streetAddress.trim(),
      city.trim(),
      state.trim(),
      postalCode.trim() ? `PIN: ${postalCode.trim()}` : "",
      country.trim(),
    ].filter(Boolean);

    const fullAddress = addressParts.join(", ");

    const payload = {
      name: name.trim(),
      state: state.trim() || city.trim() || "HQ",
      contact_phone: phone.trim() || null,
      phone: phone.trim() || null,
      address: fullAddress || null,
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
    <div style={{ maxWidth: 540 }}>
      <button className="modal-close" onClick={closeModal}>
        ×
      </button>
      <h3>{vendor ? "Edit Vendor Store Account" : "Add Vendor Location"}</h3>
      <p className="modal-sub">Company or pharmacy vendor store credentials & location settings.</p>

      <div className="inline-form-grid" style={{ marginBottom: 14 }}>
        <div>
          <label>Vendor / Store Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vendor / store name" />
        </div>
        <div>
          <label>Contact Phone Number</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 9876543210" />
        </div>
      </div>

      {/* Structured Address Block */}
      <div style={{ background: "#F8FAFC", padding: 14, borderRadius: 8, border: "1px solid #E2E8F0", marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#0F1F3D", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10, display: "block" }}>
          📍 Full Store Address &amp; Location Details
        </label>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Street Address / Building / Area</label>
          <input
            value={streetAddress}
            onChange={(e) => setStreetAddress(e.target.value)}
            placeholder="e.g. Shop 12, Retail Complex, Main Road"
            style={{ marginTop: 4, background: "#FFFFFF" }}
          />
        </div>

        <div className="inline-form-grid" style={{ gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>City / Town</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Mumbai / Hyderabad"
              style={{ marginTop: 4, background: "#FFFFFF" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>State / Province</label>
            <input
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="e.g. Maharashtra"
              style={{ marginTop: 4, background: "#FFFFFF" }}
            />
          </div>
        </div>

        <div className="inline-form-grid" style={{ gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>PIN / Postal Code</label>
            <input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="e.g. 400001"
              style={{ marginTop: 4, background: "#FFFFFF" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Country</label>
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. India"
              style={{ marginTop: 4, background: "#FFFFFF" }}
            />
          </div>
        </div>
      </div>

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
          {busy ? "Saving…" : "Save Vendor Location"}
        </button>
      </div>
    </div>
  );
}