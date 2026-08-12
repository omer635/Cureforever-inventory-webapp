"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { CACHE_KEY, OFFLINE_OPS_KEY } from "@/lib/constants";
import * as api from "@/lib/db";
import type {
  Announcement,
  AnnouncementRead,
  Currency,
  ModalState,
  OfflineOp,
  Product,
  ProductBatch,
  ProductVisibility,
  PurchaseOrder,
  ReorderRequest,
  RestoreCache,
  StockAdjustment,
  StockEntry,
  StockHistory,
  StockTransfer,
  ValuationModel,
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
  purchaseOrders: PurchaseOrder[];
  stockTransfers: StockTransfer[];
  currency: Currency;
  setCurrency: (c: Currency) => void;
  valuationModel: ValuationModel;
  setValuationModel: (v: ValuationModel) => void;
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
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>([]);
  const [currency, setCurrency] = useState<Currency>("INR");
  const [valuationModel, setValuationModel] = useState<ValuationModel>("weighted_avg");
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
    setPurchaseOrders(data.purchaseOrders || []);
    setStockTransfers(data.stockTransfers || []);
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
        } else if (op.type === "purchase_order_create") {
          const d = op.data as { po: Record<string, unknown>; items: Record<string, unknown>[] };
          await api.createPurchaseOrder(d.po, d.items);
        } else if (op.type === "transfer_create") {
          await api.createStockTransfer(op.data);
        } else if (op.type === "transfer_status_update") {
          await api.updateTransferStatus(op.data.transfer, op.data.status);
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

  // Global Ctrl+K / Cmd+K listener for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setModal((prev) => (prev?.type === "commandPalette" ? null : { type: "commandPalette" }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
          setPurchaseOrders(cached.purchaseOrders ?? []);
          setStockTransfers(cached.stockTransfers ?? []);
        }
        try {
          // 1. Try matching by user_id first
          const me = await sb
            .from("vendors")
            .select("*")
            .eq("user_id", s.user.id)
            .limit(1)
            .maybeSingle();

          let vRow = (me.data as Vendor) || null;

          // 2. If not found by user_id, try matching by email
          if (!vRow && s.user.email) {
            const byEmail = await sb
              .from("vendors")
              .select("*")
              .ilike("email", s.user.email.trim())
              .limit(1)
              .maybeSingle();

            if (byEmail.data) {
              vRow = byEmail.data as Vendor;
              // Permanently link user_id in vendors table
              if (!vRow.user_id) {
                void sb.from("vendors").update({ user_id: s.user.id }).eq("id", vRow.id);
                vRow.user_id = s.user.id;
              }
            }
          }

          // 3. Fallback: Create admin vendor row if account has no vendor record
          if (!vRow && s.user.email) {
            const { data: newV } = await sb
              .from("vendors")
              .insert({
                user_id: s.user.id,
                name: s.user.email.split("@")[0] || "HQ Admin",
                email: s.user.email,
                is_admin: true,
                state: "HQ Location",
                address: "HQ Location",
              })
              .select("*")
              .single();

            if (newV) {
              vRow = newV as Vendor;
            }
          }

          setVendorRow(vRow);
        } catch (err) {
          console.error("vendor lookup error:", err);
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
      if (navigator.onLine && document.visibilityState === "visible") {
        void refreshLight();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [refreshLight]);

  // Live Real-Time Stock Synchronization Channel across all vendor stores
  useEffect(() => {
    const sb = getSupabase();
    const channel = sb
      .channel("live-vendor-stock-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_entries" }, () => {
        void refreshLight();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_adjustments" }, () => {
        void refreshLight();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_orders" }, (payload) => {
        void refreshAll();
        if (payload.eventType === "INSERT") {
          const po = payload.new as { po_number?: string; destination_vendor_id?: string };
          toast(`📦 New Purchase Order #${po.po_number || ""} issued by Main Supplier!`);
        } else if (payload.eventType === "UPDATE") {
          const po = payload.new as { po_number?: string; status?: string };
          toast(`📋 Purchase Order #${po.po_number || ""} status changed to ${po.status?.toUpperCase() || ""}`);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_transfers" }, () => {
        void refreshLight();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, (payload) => {
        void refreshAll();
        if (payload.eventType === "INSERT") {
          const title = (payload.new as { title?: string })?.title || "New Alert";
          toast(`📢 New Broadcast: ${title}`);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "announcement_reads" }, () => {
        void refreshAll();
      })
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
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
    purchaseOrders,
    stockTransfers,
    currency,
    setCurrency,
    valuationModel,
    setValuationModel,
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