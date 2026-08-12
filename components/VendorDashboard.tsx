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
    isOnline,
    queueOp,
    refreshAll,
    toast,
    openModal,
  } = useApp();

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
    const qty = parseInt(drafts[id] ?? "", 10);
    if (isNaN(qty)) {
      toast("Enter a valid quantity");
      return;
    }
    const reason = reasons[id] || "manual_adjustment";
    setSavingKey(id);

    async function finish(wait = true) {
      if (wait) await new Promise((r) => setTimeout(r, 650));
      await refreshAll();
      setDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      setSavingKey(null);
      toast("Stock updated and audit recorded");
    }

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
      await finish(false);
    } catch (err) {
      if ((err as Error).message.includes("fetch") || !navigator.onLine) {
        queueOp({ type: "stock_upsert", id, data: { entryId: id, quantity: qty, reasonCode: reason, notes: notes[id] || "", batchId: row.entry.batch_id } });
        toast("Saved offline — will sync when back online");
        setSavingKey(null);
      } else {
        toast("Save failed: " + (err as Error).message);
        setSavingKey(null);
      }
    }
  };

  const saveDelayed = (row: StockRow, value: string) => {
    setDrafts((d) => ({ ...d, [row.entry.id]: value }));
    if (saveTimer.current[row.entry.id]) clearTimeout(saveTimer.current[row.entry.id]);
    saveTimer.current[row.entry.id] = setTimeout(() => {
      void saveRow({ ...row, entry: { ...row.entry, quantity: parseInt(value, 10) || row.entry.quantity } });
    }, 1000);
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
                      onChange={(e) => saveDelayed(r, e.target.value)}
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
                    />
                  </td>
                  <td>
                    <div className="row-actions">
                      {drafts[r.entry.id] !== undefined && parseInt(drafts[r.entry.id]!, 10) !== r.entry.quantity && (
                        <button className="save-btn" onClick={() => void saveRow(r)} disabled={savingKey === r.entry.id}>
                          {savingKey === r.entry.id ? "Saving…" : "Save"}
                        </button>
                      )}
                      <button className="link-btn" onClick={() => openModal({ type: "reorder", entry: r.entry })}>
                        Reorder
                      </button>
                      <button className="link-btn" onClick={() => openModal({ type: "history", entry: r.entry })}>
                        History
                      </button>
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