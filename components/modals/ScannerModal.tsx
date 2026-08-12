"use client";

import React, { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import type { Product } from "@/lib/types";
import { cleanText, money, playNotificationSound } from "@/lib/utils";

export default function ScannerModal() {
  const { products, vendors, stockEntries, vendorRow, isAdmin, closeModal, openModal, toast, refreshAll } = useApp();
  const [manualCode, setManualCode] = useState("");
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [customQtyDelta, setCustomQtyDelta] = useState<number>(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);

  // Auto-focus manual input for hardware USB barcode guns
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Match barcode or SKU
  const handleCodeScan = (codeRaw: string) => {
    const code = codeRaw.trim();
    if (!code) return;
    setError("");
    setMessage(`Scanned: "${code}"`);

    const codeLower = code.toLowerCase();
    const product = products.find(
      (p) =>
        (p.barcode && p.barcode.trim().toLowerCase() === codeLower) ||
        (p.sku && p.sku.trim().toLowerCase() === codeLower) ||
        p.id === code
    );

    if (product) {
      setScannedProduct(product);
      setMessage(`✓ Matched: ${cleanText(product.name)} (${product.sku})`);
      setError("");
      playNotificationSound("chime");
    } else {
      setScannedProduct(null);
      setError(`❌ Barcode/SKU "${code}" not found in catalog (${products.length} products loaded).`);
      playNotificationSound("alert");
    }
  };

  // Camera Barcode Scanner Effect (HTML5-QRCode)
  useEffect(() => {
    let scanner: { stop: () => Promise<void> } | null = null;
    let cancelled = false;

    const start = async () => {
      if (startedRef.current || cancelled) return;
      startedRef.current = true;
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const html5QrCode = new Html5Qrcode("qr-reader");
        scanner = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            if (cancelled) return;
            handleCodeScan(decodedText);
          },
          () => {
            /* Keep scanning */
          }
        );
      } catch (err) {
        setError((err as Error).message || "Camera offline or permission denied. Use manual input below.");
        startedRef.current = false;
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (scanner) {
        void scanner.stop().catch(() => {});
        scanner = null;
      }
      startedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  // Handle Manual Barcode Submit (Keyboard / USB Barcode Gun)
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleCodeScan(manualCode);
    }
  };

  // Calculate current stock totals for matched product
  const productStock = scannedProduct
    ? stockEntries.filter((e) => e.product_id === scannedProduct.id).reduce((acc, e) => acc + (Number(e.quantity) || 0), 0)
    : 0;

  // Quick Stock Adjustment (+/- delta)
  const handleQuickAdjust = async (delta: number) => {
    if (!scannedProduct) return;
    setAdjusting(true);
    try {
      const targetVendorId = isAdmin
        ? vendors[0]?.id || "main_wh"
        : vendorRow?.id || "main_wh";

      await api.adjustStockQuantity(
        targetVendorId,
        scannedProduct.id,
        delta,
        delta > 0 ? "SCAN_RECEIVE" : "SCAN_DISPATCH"
      );

      await refreshAll();
      toast(`Updated stock for ${scannedProduct.name}: ${delta > 0 ? "+" : ""}${delta}`);
    } catch (err) {
      toast("Stock update failed: " + (err as Error).message);
    } finally {
      setAdjusting(false);
    }
  };

  const handleResetScan = () => {
    setScannedProduct(null);
    setManualCode("");
    setMessage("");
    setError("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div style={{ maxWidth: 500, margin: "0 auto" }}>
      <button className="modal-close" onClick={closeModal}>
        ×
      </button>
      <h3 style={{ margin: "0 0 4px", fontSize: 18, color: "#0F1F3D", fontWeight: 700 }}>
        📷 Barcode &amp; SKU Scanner
      </h3>
      <p className="modal-sub" style={{ margin: "0 0 16px", fontSize: 12, color: "#64748B" }}>
        Scan product barcodes with camera or hardware USB scanner.
      </p>

      {/* Manual Input / Hardware USB Scanner Wedge */}
      <form onSubmit={handleManualSubmit} style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#0F1F3D", display: "block", marginBottom: 4 }}>
          ⌨️ USB Hardware Gun / Manual Barcode Input:
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Scan or type barcode / SKU (e.g. 8901234567890)..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            style={{ flex: 1, margin: 0, padding: "9px 12px", borderRadius: 6, fontSize: 13 }}
          />
          <button
            type="submit"
            className="save-btn"
            style={{ background: "#0F1F3D", color: "#FFFFFF", padding: "8px 16px", fontSize: 13 }}
          >
            Lookup
          </button>
        </div>
      </form>

      {/* Camera Live Scanner Box */}
      {!scannedProduct && (
        <div style={{ marginBottom: 14 }}>
          <div
            id="qr-reader"
            style={{
              minHeight: 200,
              borderRadius: 8,
              overflow: "hidden",
              border: "2px dashed #B8935A",
              background: "#0F1F3D",
            }}
          />
        </div>
      )}

      {/* Messages */}
      {message && <p style={{ color: "#00b48a", fontWeight: 700, fontSize: 13, margin: "8px 0" }}>{message}</p>}
      {error && <p style={{ color: "#DC2626", fontWeight: 700, fontSize: 13, margin: "8px 0" }}>{error}</p>}

      {/* Scanned Product Match Card */}
      {scannedProduct && (
        <div
          style={{
            background: "#F8FAFC",
            border: "1px solid #00b48a",
            borderRadius: 8,
            padding: 16,
            marginTop: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 16, color: "#0F1F3D", fontWeight: 700 }}>
                {cleanText(scannedProduct.name)}
              </h4>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                SKU: <strong>{scannedProduct.sku}</strong> · Barcode: {scannedProduct.barcode || "N/A"}
              </div>
            </div>
            <span
              style={{
                background: productStock > (scannedProduct.low_stock_threshold ?? 0) ? "#E6FBF5" : "#FEF3C7",
                color: productStock > (scannedProduct.low_stock_threshold ?? 0) ? "#00b48a" : "#92400E",
                padding: "3px 8px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {productStock > (scannedProduct.low_stock_threshold ?? 0) ? "IN STOCK" : "LOW STOCK"}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, margin: "12px 0", background: "#FFFFFF", padding: 10, borderRadius: 6, border: "1px solid #E2E8F0" }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748B" }}>Category</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F1F3D" }}>{scannedProduct.category || "General"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748B" }}>Selling Price</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F1F3D" }}>{money(scannedProduct.selling_price ?? 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748B" }}>Total Stock</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#00b48a" }}>{productStock} units</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #CBD5E1" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0F1F3D", marginBottom: 8 }}>
              ⚡ Quick Stock Adjustment:
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                className="save-btn"
                onClick={() => void handleQuickAdjust(1)}
                disabled={adjusting}
                style={{ background: "#00b48a", color: "#FFF", padding: "6px 12px", fontSize: 12 }}
              >
                +1 Add Stock
              </button>
              <button
                className="save-btn"
                onClick={() => void handleQuickAdjust(-1)}
                disabled={adjusting || productStock <= 0}
                style={{ background: "#DC2626", color: "#FFF", padding: "6px 12px", fontSize: 12 }}
              >
                -1 Remove Stock
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                <input
                  type="number"
                  min={1}
                  value={customQtyDelta}
                  onChange={(e) => setCustomQtyDelta(Math.max(1, Number(e.target.value)))}
                  style={{ width: 60, margin: 0, padding: "5px 8px", fontSize: 12, borderRadius: 4 }}
                />
                <button
                  className="save-btn"
                  onClick={() => void handleQuickAdjust(customQtyDelta)}
                  disabled={adjusting}
                  style={{ background: "#0F1F3D", color: "#FFF", padding: "6px 10px", fontSize: 12 }}
                >
                  Add Custom
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "space-between" }}>
            <button
              className="btn-ghost"
              onClick={handleResetScan}
              style={{ color: "#0F1F3D", borderColor: "#CBD5E1", fontSize: 12 }}
            >
              🔄 Scan Another Barcode
            </button>
            <button
              className="save-btn"
              onClick={() => {
                closeModal();
                openModal({ type: "product", product: scannedProduct });
              }}
              style={{ background: "#B8935A", color: "#0F1F3D", padding: "6px 14px", fontSize: 12, fontWeight: 700 }}
            >
              ✏️ Full Edit Product
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="modal-actions" style={{ marginTop: 18 }}>
        <button className="btn-secondary" onClick={closeModal}>
          Close
        </button>
      </div>
    </div>
  );
}