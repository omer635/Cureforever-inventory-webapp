"use client";

import React, { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import { computeVendorRows, computeVendorRowsAll, downloadCSV, fmtDateTime, money, stockStatus } from "@/lib/utils";

export default function AdminVendors() {
  const { vendors, products, productBatches, stockEntries, visibilityMap, refreshAll, toast, openModal } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(vendors[0]?.id ?? null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selected = vendors.find((v) => v.id === selectedId) || null;

  const selectedRows = useMemo(() => {
    if (!selected) return [];
    return computeVendorRows(stockEntries, selected.id, visibilityMap, productBatches, products);
  }, [selected, stockEntries, visibilityMap, productBatches, products]);

  const allRows = useMemo(
    () => computeVendorRowsAll(stockEntries, productBatches, products, vendors),
    [stockEntries, productBatches, products, vendors]
  );

  const vendorTotals = useMemo(() => {
    const map: Record<string, { value: number; lines: number }> = {};
    allRows.forEach((r) => {
      const k = r.vendor?.id || "?";
      if (!map[k]) map[k] = { value: 0, lines: 0 };
      map[k].value += (r.batch?.rate ?? r.product.cost_price ?? 0) * r.entry.quantity;
      map[k].lines += 1;
    });
    return map;
  }, [allRows]);

  const remove = async (id: string) => {
    if (!window.confirm("Delete this vendor and its rows from this list?")) return;
    setDeletingId(id);
    try {
      await api.deleteVendorRow(id);
      await refreshAll();
      toast("Vendor removed");
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      toast("Delete failed: " + (err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Vendors ({vendors.length})</h2>
          <button className="btn-add-vendor" onClick={() => openModal({ type: "addVendor" })}>
            + Add Vendor
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Lines</th>
                <th>Stock value</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => {
                const t = vendorTotals[v.id];
                return (
                  <tr key={v.id} style={{ background: selectedId === v.id ? "#FBF7EE" : undefined }}>
                    <td>
                      <strong>{v.name}</strong>
                    </td>
                    <td>{v.email || "—"}</td>
                    <td>{v.phone || "—"}</td>
                    <td>{t?.lines ?? 0}</td>
                    <td>{money(t?.value ?? 0, 0)}</td>
                    <td>
                      {v.is_admin ? <span className="badge purple">ADMIN</span> : <span className="badge info">VENDOR</span>}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="link-btn" onClick={() => setSelectedId(v.id)}>
                          View stock
                        </button>
                        <button className="link-btn" onClick={() => openModal({ type: "editVendor", vendor: v })}>
                          Edit
                        </button>
                        <button className="link-btn danger-link" onClick={() => void remove(v.id)} disabled={deletingId === v.id}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {vendors.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    No vendors yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="panel">
          <div className="panel-head">
            <h2>Stock — {selected.name}</h2>
            <div className="filters">
              <button
                className="export-btn"
                onClick={() => {
                  const header = ["Product", "SKU", "Qty", "Status", "Rate", "Value"];
                  const data = selectedRows.map((r) => [
                    r.product.name,
                    r.product.sku,
                    r.entry.quantity,
                    stockStatus(r.product, r.entry.quantity),
                    money(r.batch?.rate ?? r.product.cost_price ?? 0),
                    money((r.batch?.rate ?? r.product.cost_price ?? 0) * r.entry.quantity),
                  ]);
                  downloadCSV(`vendor-${selected.name.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
                  toast("Exported");
                }}
              >
                Export CSVs
              </button>
              <button className="link-btn danger-link" onClick={() => void remove(selected.id)}>
                Delete vendor
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Expiry</th>
                </tr>
              </thead>
              <tbody>
                {selectedRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      No stock lines for this vendor.
                    </td>
                  </tr>
                )}
                {selectedRows.map((r) => (
                  <tr key={r.entry.id}>
                    <td>{r.product.name}</td>
                    <td className="sku">{r.product.sku}</td>
                    <td>{r.entry.quantity}</td>
                    <td>
                      <span className={stockStatus(r.product, r.entry.quantity) === "out" ? "badge danger" : stockStatus(r.product, r.entry.quantity) === "low" ? "badge warn" : "badge ok"}>
                        {stockStatus(r.product, r.entry.quantity)}
                      </span>
                    </td>
                    <td>{r.batch?.expiry_date ? fmtDateTime(r.batch.expiry_date) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}