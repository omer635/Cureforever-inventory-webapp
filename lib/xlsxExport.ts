"use client";

import { Workbook } from "exceljs";
import type { StockRow } from "@/lib/utils";
import { money } from "@/lib/utils";

export async function exportAllStockXLSX(rows: StockRow[]): Promise<void> {
  const wb = new Workbook();
  const ws = wb.addWorksheet("All Stock");
  ws.columns = [
    { header: "Vendor", key: "vendor", width: 22 },
    { header: "Product", key: "product", width: 28 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Category", key: "category", width: 18 },
    { header: "Qty", key: "qty", width: 10 },
    { header: "Rate", key: "rate", width: 14 },
    { header: "Value", key: "value", width: 16 },
    { header: "Status", key: "status", width: 10 },
    { header: "Expiry", key: "expiry", width: 14 },
  ];
  rows.forEach((r) => {
    ws.addRow({
      vendor: r.vendor?.name || "",
      product: r.product.name,
      sku: r.product.sku,
      category: r.product.category || "",
      qty: r.entry.quantity,
      rate: money(r.batch?.rate ?? 0),
      value: money((r.batch?.rate ?? r.product.cost_price ?? 0) * r.entry.quantity),
      status: "active",
      expiry: r.batch?.expiry_date?.slice(0, 10) || "",
    });
  });
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `all-stock-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}