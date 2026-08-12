"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import type { PurchaseOrder } from "@/lib/types";

interface PurchaseOrderModalProps {
  mode: "create" | "view";
  po?: PurchaseOrder;
}

export default function PurchaseOrderModal({ mode, po }: PurchaseOrderModalProps) {
  const { products, vendors, closeModal, toast, refreshAll, isOnline, queueOp } = useApp();

  // Create Mode state
  const [poNumber, setPoNumber] = useState(`PO-${Math.floor(100000 + Math.random() * 900000)}`);
  const [supplier, setSupplier] = useState("");
  const [destinationVendorId, setDestinationVendorId] = useState(vendors[0]?.id || "");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ productId: string; qty: number; unitCost: number }[]>([
    { productId: products[0]?.id || "", qty: 100, unitCost: Number(products[0]?.cost_price || 10) },
  ]);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { productId: products[0]?.id || "", qty: 50, unitCost: Number(products[0]?.cost_price || 0) }]);
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier.trim()) {
      toast("Please enter a supplier name");
      return;
    }
    if (items.length === 0) {
      toast("Please add at least one line item");
      return;
    }

    const poPayload = {
      po_number: poNumber,
      supplier,
      destination_vendor_id: destinationVendorId || null,
      notes: notes || null,
      expected_delivery: expectedDelivery || null,
      status: "sent",
    };

    const itemsPayload = items.map((it) => ({
      product_id: it.productId,
      quantity_ordered: it.qty,
      quantity_received: 0,
      unit_cost: it.unitCost,
    }));

    try {
      if (isOnline) {
        await api.createPurchaseOrder(poPayload, itemsPayload);
        toast(`Purchase Order #${poNumber} created & sent!`);
        await refreshAll();
      } else {
        queueOp({
          type: "purchase_order_create",
          data: { po: poPayload, items: itemsPayload },
        });
        toast("Saved offline: Purchase Order created");
      }
      closeModal();
    } catch (err) {
      toast("Error creating PO: " + (err as Error).message);
    }
  };

  // Receive Mode: per-line-item draft (real quantity received + real expiry, entered from the
  // packing slip — previously this fabricated a fake 1-year expiry and always received the full
  // ordered quantity, which is wrong for partial shipments).
  const [receiveDrafts, setReceiveDrafts] = useState<Record<string, { qty: string; expiry: string; batchNumber: string }>>({});

  const draftFor = (item: { id: string; quantity_ordered: number; quantity_received: number }) =>
    receiveDrafts[item.id] || {
      qty: String(item.quantity_ordered - item.quantity_received),
      expiry: "",
      batchNumber: `PO-RCV-${Math.floor(1000 + Math.random() * 9000)}`,
    };

  const setDraft = (item: { id: string; quantity_ordered: number; quantity_received: number }, patch: Partial<{ qty: string; expiry: string; batchNumber: string }>) => {
    setReceiveDrafts((d) => ({ ...d, [item.id]: { ...draftFor(item), ...patch } }));
  };

  const handleReceivePOItemIntoBatch = async (item: { id: string; product_id: string; quantity_ordered: number; quantity_received: number }) => {
    const prod = products.find((p) => p.id === item.product_id);
    if (!prod) return;
    const draft = draftFor(item);
    const qty = parseInt(draft.qty, 10);
    if (isNaN(qty) || qty <= 0) {
      toast("Enter a valid received quantity");
      return;
    }
    if (!draft.expiry) {
      toast("Enter the batch's expiry date from the packing slip");
      return;
    }

    try {
      const batchPayload = {
        product_id: item.product_id,
        vendor_id: po?.destination_vendor_id || vendors[0]?.id || null,
        batch_number: draft.batchNumber,
        quantity: qty,
        initial_quantity: qty,
        cost_price: prod.cost_price,
        selling_price: prod.selling_price,
        received_date: new Date().toISOString().split("T")[0],
        expiry_date: draft.expiry,
        status: "active",
        supplier: po?.supplier || "PO Supplier",
      };

      if (isOnline) {
        await api.createBatch(batchPayload);
        const newReceived = item.quantity_received + qty;
        await api.updatePOItemReceived(item.id, newReceived);
        if (po) {
          const items = po.items || [];
          const stillPending = items.some((it) => it.id !== item.id && it.quantity_received < it.quantity_ordered);
          const fullyReceived = !stillPending && newReceived >= item.quantity_ordered;
          await api.updatePOStatus(po.id, fullyReceived ? "fulfilled" : "partially_received");
        }
        toast(`Received ${qty} units into inventory batch!`);
        await refreshAll();
      } else {
        toast("Batch receipt will sync when online");
      }
      closeModal();
    } catch (err) {
      toast("Error receiving PO items: " + (err as Error).message);
    }
  };

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, borderRadius: 8, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "#0F1F3D" }}>
            {mode === "create" ? "📋 Create Purchase Order" : `📦 Inspect PO #${po?.po_number}`}
          </h2>
          <button className="btn-ghost" onClick={closeModal}>
            ✕ Close
          </button>
        </div>

        {mode === "create" ? (
          <form onSubmit={handleCreatePO}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>PO Number</label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  required
                  style={{ width: "100%", padding: "6px 10px", marginTop: 4, borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Supplier Name</label>
                <input
                  type="text"
                  placeholder="e.g. Pfizer Pharma Distributors"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  required
                  style={{ width: "100%", padding: "6px 10px", marginTop: 4, borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Destination Location</label>
                <select
                  value={destinationVendorId}
                  onChange={(e) => setDestinationVendorId(e.target.value)}
                  style={{ width: "100%", padding: "6px 10px", marginTop: 4, borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Expected Delivery</label>
                <input
                  type="date"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                  style={{ width: "100%", padding: "6px 10px", marginTop: 4, borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 14, color: "#1F2937" }}>Line Items</h4>
                <button type="button" className="btn-ghost" onClick={handleAddItem} style={{ fontSize: 12, color: "#2563EB" }}>
                  + Add Line Item
                </button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 40px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <select
                    value={item.productId}
                    onChange={(e) => {
                      const val = e.target.value;
                      const prod = products.find((p) => p.id === val);
                      setItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, productId: val, unitCost: Number(prod?.cost_price || 0) } : it))
                      );
                    }}
                    style={{ padding: "6px", borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.qty}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, qty: val } : it)));
                    }}
                    style={{ padding: "6px", borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
                  />

                  <input
                    type="number"
                    step="0.01"
                    placeholder="Unit Cost"
                    value={item.unitCost}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, unitCost: val } : it)));
                    }}
                    style={{ padding: "6px", borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
                  />

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    style={{ background: "transparent", border: "none", color: "#DC2626", cursor: "pointer", fontWeight: 700 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>PO Notes & Instructions</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Include shipping carrier or special handling instructions..."
                style={{ width: "100%", padding: "6px 10px", marginTop: 4, borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13 }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn-ghost" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="btn-add-vendor" style={{ padding: "8px 20px" }}>
                Issue Purchase Order
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div style={{ background: "#F8FAFC", padding: 16, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
              <div>
                <strong>Supplier:</strong> {po?.supplier}
              </div>
              <div style={{ marginTop: 4 }}>
                <strong>Status:</strong> {po?.status?.toUpperCase()}
              </div>
              {po?.notes && <div style={{ marginTop: 4, color: "#475569" }}>Notes: {po.notes}</div>}
            </div>

            <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>PO Items</h4>
            {po?.items && po.items.length > 0 ? (
              po.items.map((it) => {
                const prod = products.find((p) => p.id === it.product_id);
                const remaining = it.quantity_ordered - it.quantity_received;
                const draft = draftFor(it);
                return (
                  <div key={it.id} style={{ padding: 12, borderBottom: "1px solid #E2E8F0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong>{prod?.name || "Product"}</strong>
                        <div style={{ fontSize: 12, color: "#64748B" }}>
                          Ordered: {it.quantity_ordered} units @ ₹{it.unit_cost} — received {it.quantity_received} so far
                        </div>
                      </div>
                    </div>
                    {remaining > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginTop: 8, alignItems: "end" }}>
                        <div>
                          <label style={{ fontSize: 11, color: "#374151" }}>Qty received now</label>
                          <input
                            type="number"
                            min="1"
                            max={remaining}
                            value={draft.qty}
                            onChange={(e) => setDraft(it, { qty: e.target.value })}
                            style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 12 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#374151" }}>Batch expiry date</label>
                          <input
                            type="date"
                            value={draft.expiry}
                            onChange={(e) => setDraft(it, { expiry: e.target.value })}
                            style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 12 }}
                          />
                        </div>
                        <button
                          className="btn-add-vendor"
                          onClick={() => void handleReceivePOItemIntoBatch(it)}
                          style={{ padding: "6px 12px", fontSize: 12 }}
                        >
                          Receive into Inventory Batch
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p style={{ color: "#64748B", fontSize: 13 }}>No line items recorded for this PO.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
