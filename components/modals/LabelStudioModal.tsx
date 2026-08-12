"use client";

import React, { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { useApp } from "@/components/AppProvider";
import type { Product, ProductBatch, Currency } from "@/lib/types";
import { cleanText, money, formatPrice } from "@/lib/utils";

interface LabelStudioProps {
  initialProduct?: Product;
  initialBatch?: ProductBatch;
}

export default function LabelStudioModal({ initialProduct, initialBatch }: LabelStudioProps) {
  const { products, productBatches, currency: globalCurrency, closeModal } = useApp();
  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProduct?.id || (products[0]?.id || "")
  );
  const [selectedBatchId, setSelectedBatchId] = useState<string>(initialBatch?.id || "");
  const [barcodeType, setBarcodeType] = useState<"code128" | "qrcode">("code128");
  const [labelSize, setLabelSize] = useState<"sticker" | "sheet" | "tag">("sticker");
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(globalCurrency || "INR");
  const [showPrice, setShowPrice] = useState(true);
  const [showMRP, setShowMRP] = useState(true);
  const [showBatch, setShowBatch] = useState(true);
  const [showCompanyHeader, setShowCompanyHeader] = useState(true);
  const [showCategory, setShowCategory] = useState(true);

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const availableBatches = productBatches.filter((b) => b.product_id === selectedProductId);
  const selectedBatch = availableBatches.find((b) => b.id === selectedBatchId) || availableBatches[0];

  const barcodeValue = selectedProduct?.barcode || selectedProduct?.sku || "123456789";
  const cleanedProductName = cleanText(selectedProduct?.name || "Product Name");

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (barcodeType === "code128" && barcodeSvgRef.current) {
      try {
        JsBarcode(barcodeSvgRef.current, barcodeValue, {
          format: "CODE128",
          width: 2,
          height: 44,
          displayValue: true,
          fontSize: 11,
          margin: 0,
        });
      } catch {
        /* value has characters CODE128 can't encode */
      }
    }
  }, [barcodeType, barcodeValue]);

  useEffect(() => {
    if (barcodeType === "qrcode" && qrCanvasRef.current) {
      void QRCode.toCanvas(qrCanvasRef.current, barcodeValue, { width: 64, margin: 1 });
    }
  }, [barcodeType, barcodeValue]);

  const handlePrint = () => {
    window.print();
  };

  const renderSingleLabel = (isGrid = false) => (
    <div
      style={{
        background: "#FFF",
        border: "1px dashed #CBD5E1",
        padding: isGrid ? 10 : 16,
        borderRadius: 6,
        minWidth: labelSize === "tag" ? 280 : 220,
        maxWidth: isGrid ? 220 : 340,
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        textAlign: "center",
        boxSizing: "border-box",
      }}
    >
      {showCompanyHeader && (
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#64748B", marginBottom: 2 }}>
          CUREFOREVER · ENTERPRISE
        </div>
      )}

      <div style={{ fontWeight: 700, fontSize: isGrid ? 12 : 14, color: "#0F172A", lineHeight: 1.2 }}>{cleanedProductName}</div>

      {showCategory && selectedProduct?.category && (
        <div style={{ fontSize: 10, color: "#475569", marginTop: 2, fontStyle: "italic" }}>
          {selectedProduct.category}
        </div>
      )}

      <div style={{ fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: 600 }}>SKU: {selectedProduct?.sku}</div>

      {/* Visual Barcode Graphic */}
      <div style={{ margin: "8px 0", display: "flex", justifyContent: "center" }}>
        {barcodeType === "code128" ? (
          <svg ref={!isGrid ? barcodeSvgRef : undefined} />
        ) : (
          <div style={{ textAlign: "center", background: "#FFF", padding: 4, border: "1px solid #CBD5E1", borderRadius: 4 }}>
            <canvas ref={!isGrid ? qrCanvasRef : undefined} width={54} height={54} />
            <div style={{ fontSize: 9, fontFamily: "monospace", marginTop: 2 }}>{barcodeValue}</div>
          </div>
        )}
      </div>

      {showPrice && (
        <div style={{ marginTop: 4 }}>
          {showMRP && (
            <div style={{ fontSize: 11, color: "#64748B", textDecoration: "line-through", marginRight: 6, display: "inline-block" }}>
              MRP: {formatPrice((selectedProduct?.selling_price || 0) * 1.25, selectedCurrency)}
            </div>
          )}
          <div style={{ fontWeight: 700, fontSize: 15, color: "#059669", display: "inline-block" }}>
            {formatPrice(selectedProduct?.selling_price || 0, selectedCurrency)}
          </div>
        </div>
      )}

      {showBatch && selectedBatch && (
        <div style={{ fontSize: 10, color: "#64748B", marginTop: 4, borderTop: "1px solid #F1F5F9", paddingTop: 4 }}>
          Batch: #{selectedBatch.batch_number || "N/A"} · Exp: {selectedBatch.expiry_date}
        </div>
      )}
    </div>
  );

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 840, borderRadius: 8, padding: 24 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "#0F1F3D" }}>🏷️ Printable Barcode & QR Label Studio</h2>
          <button className="btn-ghost" onClick={closeModal}>
            ✕ Close
          </button>
        </div>

        {/* Configuration Toolbar */}
        <div className="no-print" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20, background: "#F8FAFC", padding: 16, borderRadius: 6, border: "1px solid #E2E8F0" }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Select Product</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              style={{ width: "100%", padding: "6px 10px", marginTop: 4, borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 13 }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {cleanText(p.name)} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Batch (Optional)</label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              style={{ width: "100%", padding: "6px 10px", marginTop: 4, borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 13 }}
            >
              <option value="">No Batch Selected</option>
              {availableBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  Batch #{b.batch_number || "N/A"} (Exp: {b.expiry_date})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Currency Display</label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value as Currency)}
              style={{ width: "100%", padding: "6px 10px", marginTop: 4, borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 13 }}
            >
              <option value="INR">INR (₹) Indian Rupee</option>
              <option value="USD">USD ($) US Dollar</option>
              <option value="EUR">EUR (€) Euro</option>
              <option value="GBP">GBP (£) British Pound</option>
              <option value="CAD">CAD ($) Canadian Dollar</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Barcode Format</label>
            <select
              value={barcodeType}
              onChange={(e) => setBarcodeType(e.target.value as "code128" | "qrcode")}
              style={{ width: "100%", padding: "6px 10px", marginTop: 4, borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 13 }}
            >
              <option value="code128">Standard Barcode (Code128)</option>
              <option value="qrcode">2D QR Code</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Print Layout Format</label>
            <select
              value={labelSize}
              onChange={(e) => setLabelSize(e.target.value as "sticker" | "sheet" | "tag")}
              style={{ width: "100%", padding: "6px 10px", marginTop: 4, borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 13 }}
            >
              <option value="sticker">Single Product Label (2&quot; x 1.25&quot;)</option>
              <option value="sheet">30-Up Printable Sticker Sheet (A4)</option>
              <option value="tag">Shelf Edge Price Tag (3.5&quot; x 2&quot;)</option>
            </select>
          </div>

          <div style={{ gridColumn: "span 3", display: "flex", flexWrap: "wrap", gap: 16, marginTop: 4 }}>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />
              Show Selling Price
            </label>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={showMRP} onChange={(e) => setShowMRP(e.target.checked)} />
              Show MRP Comparison
            </label>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={showCompanyHeader} onChange={(e) => setShowCompanyHeader(e.target.checked)} />
              Show Company Header
            </label>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={showCategory} onChange={(e) => setShowCategory(e.target.checked)} />
              Show Category Tag
            </label>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={showBatch} onChange={(e) => setShowBatch(e.target.checked)} />
              Show Batch & Expiry
            </label>
          </div>
        </div>

        {/* Printable Preview Area */}
        <div style={{ background: "#F1F5F9", padding: 20, borderRadius: 6, textAlign: "center", maxHeight: 400, overflowY: "auto" }}>
          <h4 className="no-print" style={{ margin: "0 0 12px", fontSize: 13, color: "#64748B" }}>
            Print Preview ({labelSize === "sheet" ? "30-Up A4 Sticker Sheet" : "Single Label"})
          </h4>

          <div id="print-label-area" style={{ display: "inline-block" }}>
            {labelSize === "sheet" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, background: "#FFF", padding: 16, border: "1px solid #CBD5E1", borderRadius: 6 }}>
                {Array.from({ length: 30 }).map((_, i) => (
                  <React.Fragment key={i}>
                    {renderSingleLabel(true)}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              renderSingleLabel(false)
            )}
          </div>
        </div>

        <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
          <button className="btn-ghost" onClick={closeModal}>
            Cancel
          </button>
          <button className="btn-add-vendor" onClick={handlePrint} style={{ padding: "8px 20px", fontWeight: 600 }}>
            🖨️ Print Labels
          </button>
        </div>
      </div>
    </div>
  );
}
