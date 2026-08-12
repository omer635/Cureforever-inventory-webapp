export function cleanText(val: string | null | undefined): string {
  if (!val) return "";
  return String(val)
    .replace(/â€™/g, "'")
    .replace(/â€“/g, "-")
    .replace(/â€”/g, "—")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€/g, '"');
}

export function safeNum(val: unknown, defaultVal = 0): number {
  if (val === null || val === undefined) return defaultVal;
  const s = String(val).replace(/[^0-9.-]/g, "").trim();
  if (!s) return defaultVal;
  const n = parseFloat(s);
  return isNaN(n) ? defaultVal : n;
}

export function safeInt(val: unknown, defaultVal = 10): number {
  if (val === null || val === undefined) return defaultVal;
  const s = String(val).replace(/[^0-9-]/g, "").trim();
  if (!s) return defaultVal;
  const n = parseInt(s, 10);
  return isNaN(n) ? defaultVal : n;
}

export function money(n: number | null | undefined, digits = 2): string {
  const v = safeNum(n);
  return "₹" + v.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPrice(amount: number | null | undefined, currency: import("./types").Currency = "INR"): string {
  const v = safeNum(amount);
  const formatted = v.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  switch (currency) {
    case "INR":
      return `₹${formatted}`;
    case "USD":
      return `$${formatted}`;
    case "EUR":
      return `€${formatted}`;
    case "GBP":
      return `£${formatted}`;
    case "CAD":
      return `CA$${formatted}`;
    default:
      return `₹${formatted}`;
  }
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(iso);
  }
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86400000);
}

export type StockStatus = "out" | "low" | "in";

export function stockStatus(product: { low_stock_threshold?: number }, qty: number): StockStatus {
  if (qty <= 0) return "out";
  if (qty <= safeInt(product.low_stock_threshold, 10)) return "low";
  return "in";
}

export function rankStatus(r: { product: { low_stock_threshold?: number }; entry: { quantity: number } }): number {
  const s = stockStatus(r.product, r.entry.quantity);
  if (s === "out") return 0;
  if (s === "low") return 1;
  return 2;
}

export type DisplayBatchStatus = "Recalled" | "Expired" | "Expiring Soon" | "Active";

export function batchDisplayStatus(b: { status: string; expiry_date?: string | null }): DisplayBatchStatus {
  if (b.status === "recalled") return "Recalled";
  if (b.expiry_date && daysUntil(b.expiry_date) !== null && daysUntil(b.expiry_date)! < 0) return "Expired";
  const diff = b.expiry_date ? daysUntil(b.expiry_date) : null;
  if (diff !== null && diff <= 30) return "Expiring Soon";
  return "Active";
}

export function batchStatusBadge(status: string): {
  label: string;
  cls: string;
} {
  const cls =
    status === "Active"
      ? "badge ok"
      : status === "Expired" || status === "Recalled"
        ? "badge danger"
        : "badge warn";
  return { label: status.toUpperCase(), cls };
}

export function downloadCSV(filename: string, rows: (string | number)[][]): void {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function isProductVisible(
  productId: string,
  vendorId: string,
  visibilityMap: Record<string, Set<string>>
): boolean {
  const set = visibilityMap[productId];
  return !set || set.size === 0 || set.has(vendorId);
}

export interface StockRow {
  entry: import("./types").StockEntry;
  product: import("./types").Product;
  vendor?: import("./types").Vendor;
  batch?: import("./types").ProductBatch;
}

export function computeVendorRows(
  allEntries: import("./types").StockEntry[],
  vendorId: string,
  visibilityMap: Record<string, Set<string>>,
  productBatches: import("./types").ProductBatch[],
  products: import("./types").Product[]
): StockRow[] {
  const rows: StockRow[] = [];
  allEntries.forEach((e) => {
    if (e.vendor_id !== vendorId) return;
    const product = products.find((p) => p.id === e.product_id);
    if (!product) return;
    if (!isProductVisible(product.id, vendorId, visibilityMap)) return;
    const batch = e.batch_id ? productBatches.find((b) => b.id === e.batch_id) : undefined;
    rows.push({ entry: e, product, batch });
  });
  return rows;
}

export function computeVendorRowsAll(
  allEntries: import("./types").StockEntry[],
  productBatches: import("./types").ProductBatch[],
  products: import("./types").Product[],
  vendors: import("./types").Vendor[]
): StockRow[] {
  const rows: StockRow[] = [];
  allEntries.forEach((e) => {
    const product = products.find((p) => p.id === e.product_id);
    const vendor = vendors.find((v) => v.id === e.vendor_id);
    if (!product || !vendor) return;
    const batch = e.batch_id ? productBatches.find((b) => b.id === e.batch_id) : undefined;
    rows.push({ entry: e, product, vendor, batch });
  });
  return rows;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2, 10);
}

export function sortRows(rows: StockRow[], sortKey: string, sortDir: "asc" | "desc"): StockRow[] {
  const dir = sortDir === "asc" ? 1 : -1;
  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name") cmp = (a.product.name || "").localeCompare(b.product.name || "");
    else if (sortKey === "sku") cmp = (a.product.sku || "").localeCompare(b.product.sku || "");
    else if (sortKey === "qty") cmp = a.entry.quantity - b.entry.quantity;
    else if (sortKey === "expiry")
      cmp = (a.batch?.expiry_date || "9999").localeCompare(b.batch?.expiry_date || "9999");
    else if (sortKey === "low") cmp = rankStatus(a) - rankStatus(b);
    return cmp * dir;
  });
  return sorted;
}

/** Web Audio API sound generator for audio alerts and notifications across the app */
export function playNotificationSound(soundType: "chime" | "alert" | "success" = "chime"): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const now = ctx.currentTime;

    if (soundType === "alert") {
      // High-attention triple chime: E5 -> A5 -> C6
      [659.25, 880, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.18, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.25);
      });
    } else if (soundType === "success") {
      // Upward major arpeggio: C5 -> E5 -> G5 -> C6
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.15, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.2);
      });
    } else {
      // Crisp 2-tone notification chime: D5 -> A5
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.14, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.08);
      gain2.gain.setValueAtTime(0.16, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.38);
    }
  } catch {
    /* Ignore audio play failures if audio context is blocked */
  }
}