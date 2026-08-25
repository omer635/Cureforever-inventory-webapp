"use client";

import React, { useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import { REASONS, REASON_LABELS } from "@/lib/constants";
import {
  batchDisplayStatus,
  batchStatusBadge,
  computeVendorRows,
  daysUntil,
  downloadCSV,
  fmtDate,
  money,
  sortRows,
  stockStatus,
} from "@/lib/utils";
import type { StockRow } from "@/lib/utils";

type Filter = "all" | "low" | "expiring" | "expired";

const FILTER_LABELS: Record<Filter, string> = {
  all: "All Stock",
  low: "Low Stock",
  expiring: "Expiring Soon",
  expired: "Expired",
};

function StatusBadge({ row }: { row: StockRow }) {
  const status = stockStatus(row.product, row.entry.quantity);
  const cls = status === "out" ? "badge danger" : status === "low" ? "badge warn" : "badge ok";
  return <span className={cls}>{status === "out" ? "OUT" : status === "low" ? "LOW" : "IN STOCK"}</span>;
}

function BatchBadge({ row }: { row: StockRow }) {
  const label = batchDisplayStatus(row.batch ?? { status: "active" });
  const { label: txt, cls } = batchStatusBadge(label);
  return <span className={cls}>{txt}</span>;
}

export default function VendorDashboard() {
  const {
    vendorRow,
    products,
    productBatches,
    stockEntries,
    visibilityMap,
    stockHistory,
    announcements,
    announcementReads,
    purchaseOrders,
    isOnline,
    queueOp,
    refreshAll,
    toast,
    openModal,
    enableDemoMode,
  } = useApp();

  const vendorReads = useMemo(
    () => new Set((announcementReads || []).filter((r) => r.vendor_id === vendorRow?.id).map((r) => r.announcement_id)),
    [announcementReads, vendorRow]
  );

  const unreadAnnouncements = useMemo(
    () => (announcements || []).filter((a) => a.is_active && !vendorReads.has(a.id)),
    [announcements, vendorReads]
  );

  const vendorPOs = useMemo(
    () => (purchaseOrders || []).filter((po) => po.destination_vendor_id === vendorRow?.id),
    [purchaseOrders, vendorRow]
  );

  const pendingPOActions = useMemo(
    () => vendorPOs.filter((po) => po.status === "sent" || po.status === "revision_requested"),
    [vendorPOs]
  );

  const dismissAnnouncement = async (id: string) => {
    if (!vendorRow) return;
    // Write directly when online so the banner updates now — queueOp alone just appends to
    // the local offline queue and isn't flushed until the next reconnect/boot, so the
    // announcement would still show as unread this session.
    if (isOnline) {
      try {
        await api.markAnnouncementRead(id, vendorRow.id);
        await refreshAll();
      } catch {
        queueOp({ type: "announcement_read", data: { announcement_id: id, vendor_id: vendorRow.id } });
      }
    } else {
      queueOp({ type: "announcement_read", data: { announcement_id: id, vendor_id: vendorRow.id } });
    }
    toast("Marked as read");
  };

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("vendor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const saveTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const rows = useMemo(() => {
    let r = computeVendorRows(stockEntries, vendorRow?.id || "", visibilityMap, productBatches, products);
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((x) => (x.product.name || "").toLowerCase().includes(q) || (x.product.sku || "").toLowerCase().includes(q));
    if (filter === "low") r = r.filter((x) => stockStatus(x.product, x.entry.quantity) !== "in");
    if (filter === "expiring") r = r.filter((x) => { const d = daysUntil(x.batch?.expiry_date); return d !== null && d >= 0 && d <= 30; });
    if (filter === "expired") r = r.filter((x) => { const d = daysUntil(x.batch?.expiry_date); return d !== null && d < 0; });
    return sortRows(r, sortKey, sortDir);
  }, [stockEntries, vendorRow, visibilityMap, productBatches, products, filter, search, sortKey, sortDir]);

  const lowCount = useMemo(
    () => computeVendorRows(stockEntries, vendorRow?.id || "", visibilityMap, productBatches, products).filter((x) => stockStatus(x.product, x.entry.quantity) !== "in").length,
    [stockEntries, vendorRow, visibilityMap, productBatches, products]
  );

  const expiringSoon = useMemo(
    () => computeVendorRows(stockEntries, vendorRow?.id || "", visibilityMap, productBatches, products).filter((x) => { const d = daysUntil(x.batch?.expiry_date); return d !== null && d >= 0 && d <= 30; }).length,
    [stockEntries, vendorRow, visibilityMap, productBatches, products]
  );

  const lastSync = stockHistory && stockHistory.length > 0 ? stockHistory[0].recorded_at : null;

  const setSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const saveRow = async (row: StockRow) => {
    const id = row.entry.id;
    const rawVal = drafts[id];
    const qty = rawVal !== undefined ? parseInt(rawVal, 10) : row.entry.quantity;
    if (isNaN(qty) || qty < 0) {
      toast("Enter a valid non-negative quantity");
      return;
    }
    const reason = reasons[id] || "manual_adjustment";
    setSavingKey(id);

    if (!isOnline) {
      queueOp({ type: "stock_upsert", id, data: { entryId: id, quantity: qty, reasonCode: reason, notes: notes[id] || "", batchId: row.entry.batch_id } });
      setDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      setSavingKey(null);
      toast("Saved offline — will sync when back online");
      return;
    }

    try {
      await api.saveEntry({ entryId: id, quantity: qty, reasonCode: reason, notes: notes[id] || "", batchId: row.entry.batch_id });
      await refreshAll();
      setDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      setSavingKey(null);
      toast("Stock updated successfully");
    } catch (err) {
      if ((err as Error).message.includes("fetch") || !navigator.onLine) {
        queueOp({ type: "stock_upsert", id, data: { entryId: id, quantity: qty, reasonCode: reason, notes: notes[id] || "", batchId: row.entry.batch_id } });
        toast("Saved offline — will sync when back online");
      } else {
        toast("Save failed: " + (err as Error).message);
      }
      setSavingKey(null);
    }
  };

  const cancelRow = (id: string) => {
    setDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    setNotes((n) => {
      const next = { ...n };
      delete next[id];
      return next;
    });
  };

  const exportCSV = () => {
    const header = ["Product", "SKU", "Category", "Batch", "Expiry", "Qty", "Cost", "Value", "Status"];
    const data = rows.map((r) => [
      r.product.name,
      r.product.sku,
      r.product.category || "",
      r.batch?.expiry_date?.slice(0, 10) || "",
      batchDisplayStatus(r.batch ?? { status: "active" }),
      r.entry.quantity,
      money(r.batch?.rate ?? r.product.cost_price ?? 0),
      money((r.batch?.rate ?? r.product.cost_price ?? 0) * r.entry.quantity),
      stockStatus(r.product, r.entry.quantity),
    ]);
    downloadCSV(`cureforever-stock-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
    toast("CSV exported");
  };

  if (!vendorRow) return null;

  return (
    <>
      {/* Real-time Sync Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, background: "#FFF", padding: "12px 16px", borderRadius: 8, border: "1px solid #E5E7EB" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: "#0F1F3D", fontWeight: 700 }}>Store Inventory & Stock Management</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6B7280" }}>
            Live SKU quantities, batch expiry tracking, and instant stock level adjustments for {vendorRow.name}.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#F0FDF4", border: "1px solid #BBF7D0", padding: "4px 10px", borderRadius: 6, fontSize: 11, color: "#166534", fontWeight: 600 }}
            data-testid="vendor-live-sync-indicator"
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", display: "inline-block", boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.2)" }} />
            <span>Live Sync Active</span>
          </div>
          <button
            onClick={() => void refreshAll()}
            style={{ padding: "4px 10px", background: "#FFF", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#0F172A", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
            data-testid="vendor-refresh-btn"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="num">{products.length}</div>
          <div className="lbl">Products in catalog</div>
        </div>
        <div className="stat warn">
          <div className="num">{lowCount}</div>
          <div className="lbl">Low / out of stock lines</div>
        </div>
        <div className="stat">
          <div className="num">{expiringSoon}</div>
          <div className="lbl">Expiring within 30 days</div>
        </div>
        <div className="stat ok">
          <div className="num">{rows.length}</div>
          <div className="lbl">Stock lines for {vendorRow.name}</div>
        </div>
      </div>

      {unreadAnnouncements.length > 0 && (
        <div className="banner" style={{ background: "#FFFBEB", borderLeft: "4px solid #F59E0B", marginBottom: 16 }}>
          <div className="banner-head">
            <h3 style={{ color: "#92400E", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              📢 Broadcast Notice from Main Supplier ({unreadAnnouncements.length} Unread)
            </h3>
            <button
              className="btn-ghost"
              onClick={() => openModal({ type: "alerts" })}
              style={{ background: "#FDE68A", color: "#78350F", fontSize: 11, fontWeight: 700, borderColor: "transparent" }}
            >
              View All Alerts ({unreadAnnouncements.length}) →
            </button>
          </div>
          {unreadAnnouncements.slice(0, 3).map((a) => (
            <div key={a.id} className="banner-item" style={{ background: "#FFFFFF", padding: "10px 14px", borderRadius: 4, marginTop: 8, border: "1px solid #FCD34D", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ color: "#78350F" }}>
                  {a.title} {a.is_blocking ? "• BLOCKING NOTICE" : ""}
                </strong>
                <div style={{ color: "#4B5563", fontSize: 12, marginTop: 2 }}>{a.message}</div>
              </div>
              <button
                className="link-btn"
                style={{ color: "#D97706", fontWeight: 700, fontSize: 11, marginLeft: 12, whiteSpace: "nowrap" }}
                onClick={() => void dismissAnnouncement(a.id)}
              >
                Mark as Read ✓
              </button>
            </div>
          ))}
        </div>
      )}

      {lowCount > 0 && (
        <div className="banner">
          <div className="banner-head">
            <h3>Attention needed — low stock</h3>
            <span style={{ fontSize: 12, color: "#6B7280" }}>Last sync {lastSync ? fmtDate(lastSync) : "—"}</span>
          </div>
          {rows.filter((r) => stockStatus(r.product, r.entry.quantity) !== "in").slice(0, 3).map((r) => (
            <div key={r.entry.id} className="banner-item">
              <span>
                {r.product.name} — {r.entry.quantity} left
              </span>
              <button className="link-btn" onClick={() => openModal({ type: "reorder", entry: r.entry })}>
                Request reorder
              </button>
            </div>
          ))}
        </div>
      )}

      {vendorPOs.length > 0 && (
        <div className="panel" style={{ marginBottom: 24, borderLeft: "4px solid #3B82F6" }}>
          <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 16, color: "#0F1F3D" }}>📦 Incoming Purchase Orders from Main Supplier ({vendorPOs.length})</h2>
            {pendingPOActions.length > 0 && (
              <span className="chip active" style={{ background: "#DBEAFE", color: "#1E40AF", fontWeight: 700, fontSize: 11 }}>
                {pendingPOActions.length} Action Needed
              </span>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>PO #</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Expected Delivery</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendorPOs.map((po) => (
                  <tr key={po.id}>
                    <td>
                      <strong>#{po.po_number}</strong>
                    </td>
                    <td>{po.supplier}</td>
                    <td>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          background:
                            po.status === "accepted"
                              ? "#D1FAE5"
                              : po.status === "revision_requested"
                              ? "#FEF3C7"
                              : po.status === "rejected"
                              ? "#FEE2E2"
                              : "#DBEAFE",
                          color:
                            po.status === "accepted"
                              ? "#065F46"
                              : po.status === "revision_requested"
                              ? "#92400E"
                              : po.status === "rejected"
                              ? "#991B1B"
                              : "#1E40AF",
                        }}
                      >
                        {po.status.replace("_", " ")}
                      </span>
                    </td>
                    <td>{po.items?.length || 0} line items</td>
                    <td>{po.expected_delivery ? fmtDate(po.expected_delivery) : "Standard Shipment"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="save-btn"
                          style={{ background: "#0F1F3D", color: "#FFFFFF", padding: "4px 10px", fontSize: 11, fontWeight: 600 }}
                          onClick={() => openModal({ type: "viewPO", po })}
                        >
                          Inspect & Respond →
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h2>My Stock</h2>
          <div className="filters">
            <input className="search-input" placeholder="Search product or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {(["all", "low", "expiring", "expired"] as Filter[]).map((f) => (
              <button key={f} className={`chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {FILTER_LABELS[f]}
              </button>
            ))}
            <button className="export-btn" onClick={exportCSV}>
              Export CSV
            </button>
            <button className="btn-scan" onClick={() => openModal({ type: "scanner" })}>
              Scan
            </button>
            <button className="btn-add-vendor" onClick={() => openModal({ type: "receiveStock" })}>
              + Receive Stock
            </button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th className={sortKey === "name" ? "asc" : "sortable"} onClick={() => setSort("name")}>
                  Product
                </th>
                <th>SKU</th>
                <th>Qty</th>
                <th>Status</th>
                <th className={sortKey === "expiry" ? "asc" : "sortable"} onClick={() => setSort("expiry")}>
                  Expiry / Batch
                </th>
                <th>Adjust</th>
                <th>Reason</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    No stock lines match — {filter === "low" ? "you're all stocked up" : "try a different filter"}.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.entry.id}>
                  <td>
                    <strong>{r.product.name}</strong>
                    <div className="sku">{r.product.category || "—"}</div>
                  </td>
                  <td>
                    <span className="sku">{r.product.sku}</span>
                  </td>
                  <td>
                    <input
                      className="qty-input"
                      type="number"
                      min={0}
                      value={drafts[r.entry.id] ?? r.entry.quantity}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.entry.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void saveRow(r);
                        }
                      }}
                      data-testid={`qty-input-${r.entry.id}`}
                    />
                  </td>
                  <td>
                    <StatusBadge row={r} />
                  </td>
                  <td>
                    <BatchBadge row={r} />
                    <div className="sku">
                      {r.batch?.expiry_date ? `exp ${fmtDate(r.batch.expiry_date)}` : ""}
                      {r.batch?.received_date ? ` · recv ${fmtDate(r.batch.received_date)}` : ""}
                    </div>
                  </td>
                  <td>
                    <select
                      className="reason-select"
                      value={reasons[r.entry.id] ?? "manual_adjustment"}
                      onChange={(e) => setReasons((m) => ({ ...m, [r.entry.id]: e.target.value }))}
                      data-testid={`reason-select-${r.entry.id}`}
                    >
                      {REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {REASON_LABELS[reason]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="notes-input"
                      placeholder="Note…"
                      value={notes[r.entry.id] ?? ""}
                      onChange={(e) => setNotes((m) => ({ ...m, [r.entry.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void saveRow(r);
                        }
                      }}
                      data-testid={`notes-input-${r.entry.id}`}
                    />
                  </td>
                  <td>
                    <div className="row-actions">
                      {drafts[r.entry.id] !== undefined && parseInt(drafts[r.entry.id]!, 10) !== r.entry.quantity ? (
                        <>
                          <button
                            className="save-btn"
                            onClick={() => void saveRow(r)}
                            disabled={savingKey === r.entry.id}
                            style={{ background: "#2F6B4F", color: "#fff", padding: "4px 8px", fontSize: 11 }}
                            data-testid={`save-stock-btn-${r.entry.id}`}
                          >
                            {savingKey === r.entry.id ? "Saving…" : "✓ Save"}
                          </button>
                          <button
                            className="link-btn"
                            onClick={() => cancelRow(r.entry.id)}
                            style={{ color: "#64748B", fontSize: 11 }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="link-btn" onClick={() => openModal({ type: "reorder", entry: r.entry })}>
                            Reorder
                          </button>
                          <button className="link-btn" onClick={() => openModal({ type: "history", entry: r.entry })}>
                            History
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}