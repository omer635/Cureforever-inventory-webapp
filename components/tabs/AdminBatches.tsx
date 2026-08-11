"use client";

import React, { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { batchDisplayStatus, batchStatusBadge, fmtDate, money, stockStatus } from "@/lib/utils";
import * as api from "@/lib/db";

export default function AdminBatches() {
  const { products, productBatches, vendors, stockEntries, refreshAll, toast, openModal } = useApp();
  const [filter, setFilter] = useState("all");

  const rows = useMemo(() => {
    return productBatches
      .map((b) => ({
        batch: b,
        product: products.find((p) => p.id === b.product_id),
        vendor: vendors.find((v) => v.id === b.vendor_id),
        entry: stockEntries.find((e) => e.batch_id === b.id),
        label: batchDisplayStatus(b),
      }))
      .filter((r) => {
        if (filter === "recalled") return r.label === "Recalled";
        if (filter === "expired") return r.label === "Expired";
        if (filter === "expiring") return r.label === "Expiring Soon";
        return true;
      })
      .sort((a, b) => (b.batch.received_date || "").localeCompare(a.batch.received_date || ""));
  }, [productBatches, products, vendors, stockEntries, filter]);

  const recall = async (id: string, status: "recalled" | "active") => {
    if (status === "recalled" && !window.confirm("Recall this batch? It will be hidden from vendors and marked recalled.")) return;
    try {
      await api.updateBatch(id, { status });
      await refreshAll();
      toast(status === "recalled" ? "Batch recalled" : "Batch reactivated");
    } catch (err) {
      toast("Failed: " + (err as Error).message);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Batches ({rows.length})</h2>
        <div className="filters">
          {[
            ["all", "All"],
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
              <th>Vendor</th>
              <th>Supplier</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Received</th>
              <th>Mfg</th>
              <th>Expiry</th>
              <th>Status</th>
              <th>Stock status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="empty">
                  No batches found.
                </td>
              </tr>
            )}
            {rows.map(({ batch, product, vendor, entry, label }) => {
              const b = batchStatusBadge(label);
              const s = entry ? stockStatus(product || { low_stock_threshold: 10 }, entry.quantity) : "out";
              return (
                <tr key={batch.id}>
                  <td>
                    <strong>{product?.name || "Unknown"}</strong>
                    <div className="sku">{product?.sku || ""}</div>
                  </td>
                  <td>{vendor?.name || "—"}</td>
                  <td>{batch.supplier || "—"}</td>
                  <td>{batch.quantity}</td>
                  <td>{money(batch.rate ?? 0)}</td>
                  <td>{fmtDate(batch.received_date)}</td>
                  <td>{fmtDate(batch.mfg_date)}</td>
                  <td>{fmtDate(batch.expiry_date)}</td>
                  <td>
                    <span className={b.cls}>{b.label}</span>
                  </td>
                  <td>
                    <span className={s === "out" ? "badge danger" : s === "low" ? "badge warn" : "badge ok"}>
                      {s === "out" ? "OUT" : s === "low" ? "LOW" : "IN"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="link-btn" onClick={() => openModal({ type: "manageBatch", batch })}>
                        Manage
                      </button>
                      {label !== "Recalled" ? (
                        <button className="link-btn danger-link" onClick={() => void recall(batch.id, "recalled")}>
                          Recall
                        </button>
                      ) : (
                        <button className="link-btn" onClick={() => void recall(batch.id, "active")}>
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