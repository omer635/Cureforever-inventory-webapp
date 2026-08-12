"use client";

import React, { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { batchDisplayStatus, batchStatusBadge, daysUntil, fmtDate, money } from "@/lib/utils";
import * as api from "@/lib/db";

export default function AdminBatches() {
  const { products, productBatches, vendors, stockEntries, refreshAll, toast, openModal } = useApp();
  const [filter, setFilter] = useState("all");
  const [timelineFilter, setTimelineFilter] = useState("all");

  // Identify earliest expiring batch per product for FEFO (First-Expired, First-Out) recommendation
  const fefoMap = useMemo(() => {
    const map: Record<string, string> = {}; // productId -> batchId (earliest expiring active batch)
    const activeBatches = productBatches.filter((b) => b.status === "active" && (daysUntil(b.expiry_date) ?? -1) > 0);
    
    // Group active batches by product
    const grouped: Record<string, typeof activeBatches> = {};
    activeBatches.forEach((b) => {
      if (!grouped[b.product_id]) grouped[b.product_id] = [];
      grouped[b.product_id].push(b);
    });

    Object.entries(grouped).forEach(([prodId, batches]) => {
      const sorted = [...batches].sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
      if (sorted[0]) {
        map[prodId] = sorted[0].id;
      }
    });

    return map;
  }, [productBatches]);

  const rows = useMemo(() => {
    return productBatches
      .map((b) => ({
        batch: b,
        product: products.find((p) => p.id === b.product_id),
        vendor: vendors.find((v) => v.id === b.vendor_id),
        entry: stockEntries.find((e) => e.batch_id === b.id),
        label: batchDisplayStatus(b),
        isFefoRecommended: fefoMap[b.product_id] === b.id,
      }))
      .filter((r) => {
        if (filter === "recalled") return r.label === "Recalled";
        if (filter === "quarantined") return r.batch.status === "quarantined";
        if (filter === "expired") return r.label === "Expired";
        if (filter === "expiring") return r.label === "Expiring Soon";

        if (timelineFilter !== "all") {
          const daysToExpiry = daysUntil(r.batch.expiry_date) ?? 9999;
          if (timelineFilter === "30") return daysToExpiry >= 0 && daysToExpiry <= 30;
          if (timelineFilter === "60") return daysToExpiry > 30 && daysToExpiry <= 60;
          if (timelineFilter === "90") return daysToExpiry > 60 && daysToExpiry <= 90;
          if (timelineFilter === "90plus") return daysToExpiry > 90;
        }

        return true;
      })
      .sort((a, b) => (b.batch.received_date || "").localeCompare(a.batch.received_date || ""));
  }, [productBatches, products, vendors, stockEntries, filter, timelineFilter, fefoMap]);

  const updateBatchStatus = async (id: string, status: "recalled" | "active" | "quarantined") => {
    if (status === "recalled" && !window.confirm("Recall this batch? It will be hidden from vendors and marked recalled.")) return;
    try {
      await api.updateBatch(id, { status });
      await refreshAll();
      toast(`Batch status updated to ${status}`);
    } catch (err) {
      toast("Failed: " + (err as Error).message);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2>Pharmaceutical Batches & Compliance ({rows.length})</h2>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
            First-Expired, First-Out (FEFO) picking engine & expiry timeline management.
          </div>
        </div>
        <div className="filters" style={{ flexWrap: "wrap" }}>
          <select
            value={timelineFilter}
            onChange={(e) => setTimelineFilter(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 12 }}
          >
            <option value="all">All Expiry Timelines</option>
            <option value="30">Expiring in 0-30 Days</option>
            <option value="60">Expiring in 31-60 Days</option>
            <option value="90">Expiring in 61-90 Days</option>
            <option value="90plus">Valid &gt; 90 Days</option>
          </select>

          {[
            ["all", "All"],
            ["quarantined", "Quarantined"],
            ["recalled", "Recalled"],
            ["expiring", "Expiring Soon"],
            ["expired", "Expired"],
          ].map(([k, v]) => (
            <button key={k} className={`chip ${filter === k ? "active" : ""}`} onClick={() => setFilter(k)}>
              {v}
            </button>
          ))}
          <button className="btn-add-vendor" onClick={() => openModal({ type: "createBatch" })}>
            + Create Batch
          </button>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Batch # & FEFO</th>
              <th>Vendor Store</th>
              <th>Supplier</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Received</th>
              <th>Mfg</th>
              <th>Expiry Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="empty">
                  No batches found matching the selected compliance filters.
                </td>
              </tr>
            )}
            {rows.map(({ batch, product, vendor, entry, label, isFefoRecommended }) => {
              const b = batchStatusBadge(label);
              return (
                <tr key={batch.id}>
                  <td>
                    <strong>{product?.name || "Unknown"}</strong>
                    <div className="sku">{product?.sku || ""}</div>
                  </td>
                  <td>
                    <strong style={{ color: "#0F172A" }}>#{batch.batch_number || "N/A"}</strong>
                    {isFefoRecommended && (
                      <div>
                        <span style={{ background: "#EEF2FF", color: "#4338CA", padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontSize: 10 }}>
                          ⚡ FEFO PICK FIRST
                        </span>
                      </div>
                    )}
                  </td>
                  <td>{vendor?.name || "—"}</td>
                  <td>{batch.supplier || "—"}</td>
                  <td>{batch.quantity}</td>
                  <td>{money(batch.rate ?? 0)}</td>
                  <td>{fmtDate(batch.received_date)}</td>
                  <td>{fmtDate(batch.mfg_date)}</td>
                  <td>{fmtDate(batch.expiry_date)}</td>
                  <td>
                    <span className={batch.status === "quarantined" ? "badge warn" : b.cls}>
                      {batch.status === "quarantined" ? "QUARANTINED" : b.label}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions" style={{ flexWrap: "wrap", gap: 4 }}>
                      <button className="link-btn" onClick={() => openModal({ type: "labelStudio", product: product || undefined, batch })}>
                        🏷️ Label
                      </button>
                      <button className="link-btn" onClick={() => openModal({ type: "manageBatch", batch })}>
                        Edit
                      </button>
                      {batch.status !== "quarantined" ? (
                        <button className="link-btn" onClick={() => void updateBatchStatus(batch.id, "quarantined")} style={{ color: "#D97706" }}>
                          Quarantine
                        </button>
                      ) : (
                        <button className="link-btn" onClick={() => void updateBatchStatus(batch.id, "active")} style={{ color: "#059669" }}>
                          Release
                        </button>
                      )}
                      {label !== "Recalled" ? (
                        <button className="link-btn danger-link" onClick={() => void updateBatchStatus(batch.id, "recalled")}>
                          Recall
                        </button>
                      ) : (
                        <button className="link-btn" onClick={() => void updateBatchStatus(batch.id, "active")}>
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}