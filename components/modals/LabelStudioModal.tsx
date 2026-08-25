"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { useApp } from "@/components/AppProvider";
import type { Product, ProductBatch, Currency } from "@/lib/types";
import { cleanText, formatPrice } from "@/lib/utils";

interface LabelStudioProps {
  initialProduct?: Product;
  initialBatch?: ProductBatch;
}

type TemplateType = "sticker" | "sheet" | "tag" | "pharma" | "shipping";
type QrPayloadType = "sku" | "barcode" | "url" | "batch";

interface LabelItemProps {
  product: Product;
  batch?: ProductBatch;
  template: TemplateType;
  barcodeType: "code128" | "qrcode";
  qrPayloadType: QrPayloadType;
  selectedCurrency: Currency;
  companyHeader: string;
  borderStyle: "dashed" | "solid" | "none";
  showPrice: boolean;
  showMRP: boolean;
  showBatch: boolean;
  showCompanyHeader: boolean;
  showCategory: boolean;
  isGrid?: boolean;
}

function RenderedLabelItem({
  product,
  batch,
  template,
  barcodeType,
  qrPayloadType,
  selectedCurrency,
  companyHeader,
  borderStyle,
  showPrice,
  showMRP,
  showBatch,
  showCompanyHeader,
  showCategory,
  isGrid = false,
}: LabelItemProps) {
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const barcodeValue = product?.barcode || product?.sku || "123456789";
  const cleanedProductName = cleanText(product?.name || "Product Name");

  const qrPayload = useMemo(() => {
    if (qrPayloadType === "url") {
      return `https://partners.wtfevryday.com/vendor?sku=${encodeURIComponent(product?.sku || "")}`;
    }
    if (qrPayloadType === "batch" && batch) {
      return JSON.stringify({ sku: product?.sku, batch: batch.batch_number, exp: batch.expiry_date });
    }
    if (qrPayloadType === "sku") {
      return product?.sku || barcodeValue;
    }
    return barcodeValue;
  }, [qrPayloadType, product, batch, barcodeValue]);

  useEffect(() => {
    if (barcodeType === "code128" && barcodeSvgRef.current) {
      try {
        JsBarcode(barcodeSvgRef.current, barcodeValue, {
          format: "CODE128",
          width: template === "pharma" ? 1.4 : template === "shipping" ? 2.2 : 1.8,
          height: template === "pharma" ? 28 : template === "shipping" ? 56 : 38,
          displayValue: template !== "pharma",
          fontSize: 10,
          margin: 0,
        });
      } catch {
        /* invalid character fallback */
      }
    }
  }, [barcodeType, barcodeValue, template]);

  useEffect(() => {
    if (barcodeType === "qrcode" && qrCanvasRef.current) {
      const qrWidth = template === "pharma" ? 44 : template === "shipping" ? 96 : 64;
      void QRCode.toCanvas(qrCanvasRef.current, qrPayload, { width: qrWidth, margin: 1 });
    }
  }, [barcodeType, qrPayload, template]);

  // Dimension & template styling maps
  const getContainerStyle = (): React.CSSProperties => {
    const borderCss =
      borderStyle === "dashed"
        ? "1px dashed #CBD5E1"
        : borderStyle === "solid"
        ? "1px solid #94A3B8"
        : "1px solid transparent";

    if (template === "pharma") {
      return {
        background: "#FFF",
        border: borderCss,
        padding: 6,
        borderRadius: 4,
        width: 170,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        textAlign: "center",
        boxSizing: "border-box",
        pageBreakInside: "avoid",
      };
    }

    if (template === "tag") {
      return {
        background: "#FFF",
        border: borderCss,
        padding: 14,
        borderRadius: 6,
        width: isGrid ? 220 : 300,
        boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
        textAlign: "left",
        boxSizing: "border-box",
        pageBreakInside: "avoid",
      };
    }

    if (template === "shipping") {
      return {
        background: "#FFF",
        border: "2px solid #0F172A",
        padding: 18,
        borderRadius: 8,
        width: isGrid ? 280 : 380,
        boxShadow: "0 3px 6px rgba(0,0,0,0.08)",
        textAlign: "left",
        boxSizing: "border-box",
        pageBreakInside: "avoid",
      };
    }

    // Default sticker & 30-up sheet
    return {
      background: "#FFF",
      border: borderCss,
      padding: isGrid ? 8 : 14,
      borderRadius: 6,
      width: isGrid ? "100%" : 240,
      maxWidth: isGrid ? 220 : 320,
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      textAlign: "center",
      boxSizing: "border-box",
      pageBreakInside: "avoid",
    };
  };

  return (
    <div style={getContainerStyle()} className="printable-label-item">
      {showCompanyHeader && companyHeader && (
        <div
          style={{
            fontSize: template === "pharma" ? 8 : 9,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: "#64748B",
            marginBottom: 2,
            textAlign: template === "tag" || template === "shipping" ? "left" : "center",
          }}
        >
          {companyHeader}
        </div>
      )}

      <div
        style={{
          fontWeight: 700,
          fontSize: template === "pharma" ? 11 : template === "shipping" ? 16 : isGrid ? 12 : 14,
          color: "#0F172A",
          lineHeight: 1.2,
        }}
      >
        {cleanedProductName}
      </div>

      {showCategory && product?.category && template !== "pharma" && (
        <div style={{ fontSize: 10, color: "#475569", marginTop: 2, fontStyle: "italic" }}>
          {product.category}
        </div>
      )}

      <div style={{ fontSize: template === "pharma" ? 9 : 11, color: "#64748B", marginTop: 2, fontWeight: 600 }}>
        SKU: {product?.sku}
      </div>

      {/* Visual Barcode / QR Graphic */}
      <div
        style={{
          margin: template === "pharma" ? "4px 0" : "8px 0",
          display: "flex",
          justifyContent: template === "shipping" ? "flex-start" : "center",
          alignItems: "center",
        }}
      >
        {barcodeType === "code128" ? (
          <svg ref={barcodeSvgRef} />
        ) : (
          <div style={{ textAlign: "center", background: "#FFF", padding: 4, border: "1px solid #CBD5E1", borderRadius: 4 }}>
            <canvas ref={qrCanvasRef} />
            <div style={{ fontSize: 8, fontFamily: "monospace", marginTop: 2 }}>{barcodeValue}</div>
          </div>
        )}
      </div>

      {showPrice && (
        <div style={{ marginTop: 4, textAlign: template === "tag" ? "left" : "center" }}>
          {showMRP && (
            <div style={{ fontSize: 10, color: "#64748B", textDecoration: "line-through", marginRight: 6, display: "inline-block" }}>
              MRP: {formatPrice((product?.selling_price || 0) * 1.25, selectedCurrency)}
            </div>
          )}
          <div style={{ fontWeight: 700, fontSize: template === "tag" ? 16 : 14, color: "#059669", display: "inline-block" }}>
            {formatPrice(product?.selling_price || 0, selectedCurrency)}
          </div>
        </div>
      )}

      {showBatch && batch && (
        <div style={{ fontSize: 9, color: "#64748B", marginTop: 4, borderTop: "1px solid #F1F5F9", paddingTop: 4 }}>
          Batch #{batch.batch_number || "N/A"} · Exp: {batch.expiry_date}
        </div>
      )}
    </div>
  );
}

export default function LabelStudioModal({ initialProduct, initialBatch }: LabelStudioProps) {
  const { products, productBatches, currency: globalCurrency, closeModal } = useApp();

  // Mode state: 'editor' vs 'preview'
  const [viewMode, setViewMode] = useState<"editor" | "preview">("editor");
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // Multi-item Batch selection state
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() => {
    if (initialProduct) return [initialProduct.id];
    return products.length > 0 ? [products[0].id] : [];
  });

  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    products.forEach((p) => {
      init[p.id] = p.id === initialProduct?.id ? 1 : 1;
    });
    return init;
  });

  const [batchMap, setBatchMap] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (initialProduct && initialBatch) {
      init[initialProduct.id] = initialBatch.id;
    }
    return init;
  });

  // Customization controls
  const [template, setTemplate] = useState<TemplateType>("sticker");
  const [barcodeType, setBarcodeType] = useState<"code128" | "qrcode">("code128");
  const [qrPayloadType, setQrPayloadType] = useState<QrPayloadType>("sku");
  const [borderStyle, setBorderStyle] = useState<"dashed" | "solid" | "none">("dashed");
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(globalCurrency || "INR");
  const [companyHeader, setCompanyHeader] = useState("CUREFOREVER · ENTERPRISE PORTAL");

  const [showPrice, setShowPrice] = useState(true);
  const [showMRP, setShowMRP] = useState(true);
  const [showBatch, setShowBatch] = useState(true);
  const [showCompanyHeader, setShowCompanyHeader] = useState(true);
  const [showCategory, setShowCategory] = useState(true);

  // Compute selected items list for batch rendering
  const selectedItemsList = useMemo(() => {
    const list: { product: Product; batch?: ProductBatch; count: number }[] = [];
    selectedProductIds.forEach((pid) => {
      const p = products.find((x) => x.id === pid);
      if (!p) return;
      const count = Math.max(1, quantities[pid] || 1);
      const bId = batchMap[pid];
      const batch = productBatches.find((b) => b.id === bId);
      list.push({ product: p, batch, count });
    });
    return list;
  }, [selectedProductIds, quantities, batchMap, products, productBatches]);

  // Total label items expanded across quantities
  const expandedLabelList = useMemo(() => {
    const expanded: { product: Product; batch?: ProductBatch; key: string }[] = [];
    selectedItemsList.forEach((item) => {
      for (let i = 0; i < item.count; i++) {
        expanded.push({
          product: item.product,
          batch: item.batch,
          key: `${item.product.id}-${i}`,
        });
      }
    });
    return expanded;
  }, [selectedItemsList]);

  // Page count calculation for printing
  const totalLabels = expandedLabelList.length;
  const labelsPerPage = template === "sheet" ? 30 : template === "pharma" ? 24 : 1;
  const totalPages = Math.ceil(totalLabels / labelsPerPage);

  const toggleSelectAll = () => {
    if (selectedProductIds.length === products.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map((p) => p.id));
    }
  };

  const handleProductToggle = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: viewMode === "preview" ? 1100 : 960,
          width: "95%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 12,
          padding: 24,
          background: "#FFF",
        }}
      >
        {/* Modal Header & View Mode Switcher */}
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: "#0F1F3D", fontWeight: 700 }}>
              🏷️ Barcode & QR Label Studio
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>
              Batch print selection, custom templates, & high-fidelity print preview.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ background: "#F1F5F9", padding: 3, borderRadius: 6, display: "flex", gap: 2 }}>
              <button
                type="button"
                onClick={() => setViewMode("editor")}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  background: viewMode === "editor" ? "#FFF" : "transparent",
                  color: viewMode === "editor" ? "#0F172A" : "#64748B",
                  boxShadow: viewMode === "editor" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
                data-testid="mode-editor-btn"
              >
                ⚙️ Design & Selection
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                style={{
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  background: viewMode === "preview" ? "#FFF" : "transparent",
                  color: viewMode === "preview" ? "#0F172A" : "#64748B",
                  boxShadow: viewMode === "preview" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
                data-testid="mode-preview-btn"
              >
                👁️ Print Preview ({totalLabels})
              </button>
            </div>
            <button className="btn-ghost" onClick={closeModal}>
              ✕ Close
            </button>
          </div>
        </div>

        {/* EDITOR MODE VIEW */}
        {viewMode === "editor" && (
          <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
              {/* Left Side: Multi-select Product Batch Selector */}
              <div style={{ background: "#F8FAFC", padding: 16, borderRadius: 8, border: "1px solid #E2E8F0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 14, color: "#0F172A" }}>
                    1. Select Products for Batch Printing ({selectedProductIds.length} of {products.length})
                  </h3>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    style={{ background: "transparent", border: "none", color: "#2563EB", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    data-testid="select-all-btn"
                  >
                    {selectedProductIds.length === products.length ? "Deselect All" : "Select All Products"}
                  </button>
                </div>

                <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: 6, background: "#FFF" }}>
                  {products.map((p) => {
                    const isSelected = selectedProductIds.includes(p.id);
                    const pBatches = productBatches.filter((b) => b.product_id === p.id);
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderBottom: "1px solid #F1F5F9",
                          background: isSelected ? "#EFF6FF" : "#FFF",
                        }}
                      >
                        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1, margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleProductToggle(p.id)}
                            data-testid={`checkbox-product-${p.id}`}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{cleanText(p.name)}</div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>SKU: {p.sku} · Selling: ₹{p.selling_price}</div>
                          </div>
                        </label>

                        {isSelected && (
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {pBatches.length > 0 && (
                              <select
                                value={batchMap[p.id] || ""}
                                onChange={(e) => setBatchMap((m) => ({ ...m, [p.id]: e.target.value }))}
                                style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "1px solid #CBD5E1" }}
                              >
                                <option value="">No batch</option>
                                {pBatches.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    #{b.batch_number} ({b.expiry_date})
                                  </option>
                                ))}
                              </select>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 11, color: "#64748B" }}>Copies:</span>
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={quantities[p.id] || 1}
                                onChange={(e) => setQuantities((q) => ({ ...q, [p.id]: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                                style={{ width: 50, padding: "2px 6px", fontSize: 12, borderRadius: 4, border: "1px solid #CBD5E1" }}
                                data-testid={`qty-input-${p.id}`}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Side: Template Customization Controls */}
              <div style={{ background: "#F8FAFC", padding: 16, borderRadius: 8, border: "1px solid #E2E8F0" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, color: "#0F172A" }}>2. Customize Label Template</h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Print Template Format</label>
                    <select
                      value={template}
                      onChange={(e) => setTemplate(e.target.value as TemplateType)}
                      style={{ width: "100%", padding: "6px 10px", marginTop: 2, borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 12, fontWeight: 600 }}
                      data-testid="template-select"
                    >
                      <option value="sticker">🏷️ Standard Retail Sticker (2" x 1.25")</option>
                      <option value="sheet">📄 30-Up A4 Sticker Sheet (Grid)</option>
                      <option value="tag">🔖 Shelf Edge Price Tag (3.5" x 2")</option>
                      <option value="pharma">💊 Compact Pharma Tag (1.5" x 0.75")</option>
                      <option value="shipping">📦 Warehouse Shipping Label (4" x 6")</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Barcode Graphic Type</label>
                    <select
                      value={barcodeType}
                      onChange={(e) => setBarcodeType(e.target.value as "code128" | "qrcode")}
                      style={{ width: "100%", padding: "6px 10px", marginTop: 2, borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 12 }}
                      data-testid="barcode-type-select"
                    >
                      <option value="code128">Standard 1D Barcode (Code128)</option>
                      <option value="qrcode">2D QR Code Matrix</option>
                    </select>
                  </div>

                  {barcodeType === "qrcode" && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>QR Code Data Payload</label>
                      <select
                        value={qrPayloadType}
                        onChange={(e) => setQrPayloadType(e.target.value as QrPayloadType)}
                        style={{ width: "100%", padding: "6px 10px", marginTop: 2, borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 12 }}
                      >
                        <option value="sku">Product SKU Only</option>
                        <option value="barcode">Raw Barcode String</option>
                        <option value="url">Product Catalog Web URL</option>
                        <option value="batch">Batch & Expiry JSON Payload</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Company Header Text</label>
                    <input
                      type="text"
                      value={companyHeader}
                      onChange={(e) => setCompanyHeader(e.target.value)}
                      placeholder="e.g. CUREFOREVER HQ"
                      style={{ width: "100%", padding: "6px 10px", marginTop: 2, borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 12 }}
                      data-testid="company-header-input"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Border Style</label>
                    <select
                      value={borderStyle}
                      onChange={(e) => setBorderStyle(e.target.value as "dashed" | "solid" | "none")}
                      style={{ width: "100%", padding: "6px 10px", marginTop: 2, borderRadius: 4, border: "1px solid #CBD5E1", fontSize: 12 }}
                    >
                      <option value="dashed">Dashed Guide Line</option>
                      <option value="solid">Solid Frame Line</option>
                      <option value="none">Clean Borderless</option>
                    </select>
                  </div>

                  {/* Toggle Options */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
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
              </div>
            </div>
          </div>
        )}

        {/* PRINT PREVIEW MODE VIEW */}
        {viewMode === "preview" && (
          <div style={{ overflowY: "auto", flex: 1, background: "#F1F5F9", padding: 20, borderRadius: 8 }}>
            <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, background: "#FFF", padding: "10px 16px", borderRadius: 6, border: "1px solid #CBD5E1" }}>
              <div style={{ fontSize: 13, color: "#334155" }}>
                <strong>Print Summary:</strong> {totalLabels} Label(s) · {totalPages} Page(s) ({labelsPerPage} labels/page) · Format: <strong>{template.toUpperCase()}</strong>
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#64748B" }}>Zoom:</span>
                {[50, 75, 100, 125].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setPreviewZoom(z)}
                    style={{
                      padding: "3px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 4,
                      border: "1px solid #CBD5E1",
                      background: previewZoom === z ? "#0F172A" : "#FFF",
                      color: previewZoom === z ? "#FFF" : "#334155",
                      cursor: "pointer",
                    }}
                  >
                    {z}%
                  </button>
                ))}
              </div>
            </div>

            {/* High-Fidelity Printable Canvas Container */}
            <div
              id="printable-label-canvas"
              style={{
                transform: `scale(${previewZoom / 100})`,
                transformOrigin: "top center",
                transition: "transform 0.15s ease",
              }}
            >
              {template === "sheet" || template === "pharma" ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: template === "sheet" ? "repeat(3, 1fr)" : "repeat(4, 1fr)",
                    gap: 12,
                    background: "#FFF",
                    padding: 24,
                    border: "1px solid #CBD5E1",
                    borderRadius: 8,
                    minHeight: 600,
                  }}
                >
                  {expandedLabelList.map((item) => (
                    <RenderedLabelItem
                      key={item.key}
                      product={item.product}
                      batch={item.batch}
                      template={template}
                      barcodeType={barcodeType}
                      qrPayloadType={qrPayloadType}
                      selectedCurrency={selectedCurrency}
                      companyHeader={companyHeader}
                      borderStyle={borderStyle}
                      showPrice={showPrice}
                      showMRP={showMRP}
                      showBatch={showBatch}
                      showCompanyHeader={showCompanyHeader}
                      showCategory={showCategory}
                      isGrid={true}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
                  {expandedLabelList.map((item) => (
                    <RenderedLabelItem
                      key={item.key}
                      product={item.product}
                      batch={item.batch}
                      template={template}
                      barcodeType={barcodeType}
                      qrPayloadType={qrPayloadType}
                      selectedCurrency={selectedCurrency}
                      companyHeader={companyHeader}
                      borderStyle={borderStyle}
                      showPrice={showPrice}
                      showMRP={showMRP}
                      showBatch={showBatch}
                      showCompanyHeader={showCompanyHeader}
                      showCategory={showCategory}
                      isGrid={false}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Action Footer */}
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 12, borderTop: "1px solid #E2E8F0" }}>
          <div style={{ fontSize: 12, color: "#64748B" }}>
            {selectedProductIds.length} Product(s) selected · {totalLabels} Total Labels ready
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn-ghost" onClick={closeModal}>
              Cancel
            </button>

            {viewMode === "editor" ? (
              <button
                className="btn-primary"
                onClick={() => setViewMode("preview")}
                style={{ padding: "8px 20px", fontWeight: 600, background: "#0F172A", color: "#FFF", borderRadius: 6 }}
                data-testid="go-preview-btn"
              >
                👁️ Go to Print Preview ({totalLabels}) →
              </button>
            ) : (
              <button
                className="btn-add-vendor"
                onClick={handlePrint}
                style={{ padding: "8px 24px", fontWeight: 700, background: "#059669", color: "#FFF", borderRadius: 6 }}
                data-testid="confirm-print-btn"
              >
                🖨️ Launch Printer Dialog
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
