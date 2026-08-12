"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";

export default function DataImportModal() {
  const { closeModal, toast, refreshAll, isOnline } = useApp();
  const importType = "products" as const;
  const [rawText, setRawText] = useState("");
  const [validatedRows, setValidatedRows] = useState<Record<string, unknown>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const handleValidate = () => {
    setErrors([]);
    setValidatedRows([]);

    if (!rawText.trim()) {
      setErrors(["Please paste CSV or JSON content to import."]);
      return;
    }

    try {
      let parsed: Record<string, unknown>[] = [];
      const trimmed = rawText.trim();

      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        const json = JSON.parse(trimmed);
        parsed = Array.isArray(json) ? json : [json];
      } else {
        // Parse CSV lines
        const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          setErrors(["CSV must contain a header row and at least 1 data row."]);
          return;
        }

        const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
        parsed = lines.slice(1).map((line) => {
          const cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
          const row: Record<string, unknown> = {};
          headers.forEach((h, idx) => {
            row[h] = cols[idx] || "";
          });
          return row;
        });
      }

      const rowErrors: string[] = [];
      const valid: Record<string, unknown>[] = [];

      parsed.forEach((row, index) => {
        if (importType === "products") {
          const name = String(row.name || row.Name || "");
          const sku = String(row.sku || row.SKU || `SKU-IMP-${Math.floor(1000 + Math.random() * 9000)}`);
          const costPrice = parseFloat(String(row.cost_price || row.cost || 0));
          const sellingPrice = parseFloat(String(row.selling_price || row.price || 0));

          if (!name) {
            rowErrors.push(`Row ${index + 1}: Missing product name`);
          } else {
            valid.push({
              name,
              sku,
              category: String(row.category || "General"),
              cost_price: isNaN(costPrice) ? 0 : costPrice,
              selling_price: isNaN(sellingPrice) ? 0 : sellingPrice,
              low_stock_threshold: parseInt(String(row.low_stock_threshold || 10)) || 10,
              barcode: String(row.barcode || ""),
            });
          }
        }
      });

      setErrors(rowErrors);
      setValidatedRows(valid);
      if (valid.length > 0 && rowErrors.length === 0) {
        toast(`Validation successful! ${valid.length} valid rows ready to import.`);
      }
    } catch (err) {
      setErrors([`JSON/CSV Parsing Error: ${(err as Error).message}`]);
    }
  };

  const handleExecuteImport = async () => {
    if (validatedRows.length === 0) return;
    if (!isOnline) {
      toast("Data import requires an active online connection.");
      return;
    }

    try {
      let count = 0;
      for (const row of validatedRows) {
        if (importType === "products") {
          await api.createProduct(row);
          count++;
        }
      }
      toast(`Successfully imported ${count} ${importType}!`);
      await refreshAll();
      closeModal();
    } catch (err) {
      toast("Import execution failed: " + (err as Error).message);
    }
  };

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, borderRadius: 8, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "#0F1F3D" }}>📥 Bulk Data Import Wizard</h2>
          <button className="btn-ghost" onClick={closeModal}>
            ✕ Close
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Import Target</label>
          <select
            value={importType}
            disabled
            style={{ width: "100%", padding: "8px", marginTop: 4, borderRadius: 4, border: "1px solid #D1D5DB", fontSize: 13, color: "#374151" }}
          >
            <option value="products">Products Master Catalog (CSV / JSON)</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Paste CSV or JSON Data</label>
          <textarea
            rows={8}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`Example CSV Format:\nname,sku,category,cost_price,selling_price,barcode\n"Omega-3 Fish Oil","CF-OMG-100","Supplements",12.50,24.99,"8901234567890"`}
            style={{ width: "100%", padding: "8px", marginTop: 4, borderRadius: 4, border: "1px solid #D1D5DB", fontFamily: "monospace", fontSize: 12 }}
          />
        </div>

        {errors.length > 0 && (
          <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#991B1B", padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 12 }}>
            <strong>Validation Errors Found:</strong>
            <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
              {errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {validatedRows.length > 0 && errors.length === 0 && (
          <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#065F46", padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
            ✓ Ready to import <strong>{validatedRows.length}</strong> validated rows.
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn-ghost" onClick={handleValidate}>
            Validate Data
          </button>
          <button
            className="btn-add-vendor"
            onClick={() => void handleExecuteImport()}
            disabled={validatedRows.length === 0 || errors.length > 0}
            style={{ padding: "8px 16px", opacity: validatedRows.length > 0 && errors.length === 0 ? 1 : 0.5 }}
          >
            Execute Import
          </button>
        </div>
      </div>
    </div>
  );
}
