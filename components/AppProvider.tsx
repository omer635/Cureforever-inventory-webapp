"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { CACHE_KEY, OFFLINE_OPS_KEY } from "@/lib/constants";
import * as api from "@/lib/db";
import type {
  Announcement,
  AnnouncementRead,
  ModalState,
  OfflineOp,
  Product,
  ProductBatch,
  ProductVisibility,
  ReorderRequest,
  RestoreCache,
  StockAdjustment,
  StockEntry,
  StockHistory,
  Vendor,
} from "@/lib/types";
import { uid } from "@/lib/utils";

interface ToastMsg {
  id: number;
  text: string;
}

interface AppContextValue {
  session: { user: { email?: string; id?: string } } | null;
  booted: boolean;
  vendorRow: Vendor | null;
  isAdmin: boolean;
  products: Product[];
  productBatches: ProductBatch[];
  vendors: Vendor[];
  stockEntries: StockEntry[];
  stockHistory: StockHistory[];
  stockAdjustments: StockAdjustment[];
  reorderRequests: ReorderRequest[];
  productVisibility: ProductVisibility[];
  visibilityMap: Record<string, Set<string>>;
  announcements: Announcement[];
  announcementReads: AnnouncementRead[];
  isOnline: boolean;
  offlineOps: OfflineOp[];
  modal: ModalState;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
  toast: (text: string) => void;
  refreshAll: () => Promise<void>;
  refreshLight: () => Promise<void>;
  logout: () => Promise<void>;
  queueOp: (op: OfflineOp) => void;
  flushQueue: () => Promise<void>;
  updateVendorRow: (v: Vendor | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function loadCache(): RestoreCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RestoreCache;
    if (!parsed.products) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(data: RestoreCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* storage full — ignore */
  }
}

function loadQueue(): OfflineOp[] {
  try {
    const raw = localStorage.getItem(OFFLINE_OPS_KEY);
    return raw ? (JSON.parse(raw) as OfflineOp[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(ops: OfflineOp[]) {
  try {
    localStorage.setItem(OFFLINE_OPS_KEY, JSON.stringify(ops));
  } catch {
    /* ignore */
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AppContextValue["session"]>(null);
  const [booted, setBooted] = useState(false);
  const [vendorRow, setVendorRow] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productBatches, setProductBatches] = useState<ProductBatch[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([]);
  const [reorderRequests, setReorderRequests] = useState<ReorderRequest[]>([]);
  const [productVisibility, setProductVisibility] = useState<ProductVisibility[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementReads, setAnnouncementReads] = useState<AnnouncementRead[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [offlineOps, setOfflineOps] = useState<OfflineOp[]>(() => loadQueue());
  const offlineOpsRef = useRef<OfflineOp[]>([]);
  useEffect(() => {
    offlineOpsRef.current = offlineOps;
    saveQueue(offlineOps);
  }, [offlineOps]);
  const [modal, setModal] = useState<ModalState>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toastIdRef = useRef(0);

  const visibilityMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    productVisibility.forEach((pv) => {
      if (!map[pv.product_id]) map[pv.product_id] = new Set();
      map[pv.product_id].add(pv.vendor_id);
    });
    return map;
  }, [productVisibility]);

  const toast = useCallback((text: string) => {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const refreshAll = useCallback(async () => {
    const data = await api.fetchAll();
    setProducts(data.products);
    setProductBatches(data.productBatches);
    setVendors(data.vendors);
    setStockEntries(data.stockEntries);
    setStockHistory(data.stockHistory);
    setStockAdjustments(data.stockAdjustments);
    setReorderRequests(data.reorderRequests);
    setProductVisibility(data.productVisibility);
    setAnnouncements(data.announcements);
    setAnnouncementReads(data.announcementReads);
    saveCache({ ...data, savedAt: Date.now() });
  }, []);

  const refreshLight = useCallback(async () => {
    try {
      const sb = getSupabase();
      const [se, pb, rr] = await Promise.all([
        sb.from("stock_entries").select("*").order("updated_at", { ascending: false }),
        sb.from("product_batches").select("*").order("received_date", { ascending: false }),
        sb.from("reorder_requests").select("*").order("created_at", { ascending: false }),
      ]);
      if (!se.error && se.data) setStockEntries(se.data as StockEntry[]);
      if (!pb.error && pb.data) setProductBatches(pb.data as ProductBatch[]);
      if (!rr.error && rr.data) setReorderRequests(rr.data as ReorderRequest[]);
    } catch {
      /* silent refresh failure */
    }
  }, []);

  const flushQueue = useCallback(async () => {
    const ops = offlineOpsRef.current;
    if (ops.length === 0) return;
    const remaining: OfflineOp[] = [];
    for (const op of ops) {
      try {
        if (op.type === "stock_upsert") {
          await api.saveEntry(op.data as unknown as api.SaveEntryInput);
        } else if (op.type === "reorder") {
          await api.createReorder(op.data);
        } else if (op.type === "announcement_read") {
          const d = op.data as { announcement_id: string; vendor_id: string };
          await api.markAnnouncementRead(d.announcement_id, d.vendor_id);
        }
      } catch {
        remaining.push(op);
      }
    }
    setOfflineOps(remaining);
    if (remaining.length === 0) toast("All offline changes synced");
  }, [toast]);

  const queueOp = useCallback((op: OfflineOp) => {
    setOfflineOps((prev) => {
      const next = [...prev, op];
      saveQueue(next);
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await getSupabase().auth.signOut();
    } catch {
      /* ignore */
    }
    setSession(null);
    setVendorRow(null);
  }, []);

  const openModal = useCallback((m: ModalState) => setModal(m), []);
  const closeModal = useCallback(() => setModal(null), []);
  const updateVendorRow = useCallback((v: Vendor | null) => setVendorRow(v), []);

  const boot = useCallback(async () => {
    const reconnect = () => {
      setIsOnline(true);
      toast("Back online — syncing pending changes");
      void flushQueue();
    };
    const disconnect = () => {
      setIsOnline(false);
      toast("Offline mode — showing last synced data");
    };

    window.addEventListener("online", reconnect);
    window.addEventListener("offline", disconnect);

    const storedOps = loadQueue();
    if (storedOps.length > 0 && navigator.onLine) {
      void flushQueue();
    }

    try {
      const sb = getSupabase();
      const { data } = await sb.auth.getSession();
      const s = data.session;
      setSession(s);

      if (s) {
        const cached = loadCache();
        if (cached) {
          setProducts(cached.products);
          setProductBatches(cached.productBatches);
          setVendors(cached.vendors);
          setStockEntries(cached.stockEntries);
          setStockHistory(cached.stockHistory ?? []);
          setStockAdjustments(cached.stockAdjustments ?? []);
          setReorderRequests(cached.reorderRequests ?? []);
          setProductVisibility(cached.productVisibility ?? []);
          setAnnouncements(cached.announcements ?? []);
          setAnnouncementReads(cached.announcementReads ?? []);
        }
        try {
          const me = await sb
            .from("vendors")
            .select("*")
            .or(`user_id.eq.${s.user.id},email.eq.${s.user.email ?? "___"}`)
            .limit(1)
            .maybeSingle();
          setVendorRow((me.data as Vendor) || null);
        } catch {
          /* vendor lookup failed */
        }
        try {
          await refreshAll();
        } catch (err) {
          if (navigator.onLine) toast("Could not load data: " + (err as Error).message);
        }
      }
    } catch (err) {
      console.error("boot failed:", err);
      toast("Failed to initialize: " + (err as Error).message);
    } finally {
      setBooted(true);
    }
  }, [flushQueue, refreshAll, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- onAuthStateChange is an external subscription callback; setSession runs on auth events, not synchronously during this effect
    void boot();

    const sbSub = getSupabase().auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        void refreshAll();
        if (navigator.onLine) void flushQueue();
      }
    });

    return () => {
      sbSub.data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) void refreshLight();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshLight]);

  const value: AppContextValue = {
    session,
    booted,
    vendorRow,
    isAdmin: !!vendorRow?.is_admin,
    products,
    productBatches,
    vendors,
    stockEntries,
    stockHistory,
    stockAdjustments,
    reorderRequests,
    productVisibility,
    visibilityMap,
    announcements,
    announcementReads,
    isOnline,
    offlineOps,
    modal,
    openModal,
    closeModal,
    toast,
    refreshAll,
    refreshLight,
    logout,
    queueOp,
    flushQueue,
    updateVendorRow,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className={`toast ${toasts.length > 0 ? "show" : ""}`}>
        {toasts.length > 0 ? toasts[toasts.length - 1].text : ""}
      </div>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export { uid };