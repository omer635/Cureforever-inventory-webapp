"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "@/components/AppProvider";
import { ADMIN_TAB_LABELS } from "@/lib/constants";
import VendorDashboard from "@/components/VendorDashboard";
import AdminDashboard from "@/components/tabs/AdminDashboard";
import AdminVendors from "@/components/tabs/AdminVendors";
import AdminAllStock from "@/components/tabs/AdminAllStock";
import AdminBatches from "@/components/tabs/AdminBatches";
import AdminFinancials from "@/components/tabs/AdminFinancials";
import AdminProducts from "@/components/tabs/AdminProducts";
import AdminAnnouncements from "@/components/tabs/AdminAnnouncements";
import AdminAnalytics from "@/components/tabs/AdminAnalytics";
import AdminPurchaseOrders from "@/components/tabs/AdminPurchaseOrders";
import AdminTransfers from "@/components/tabs/AdminTransfers";
import AdminAuditLogs from "@/components/tabs/AdminAuditLogs";
import ModalHost from "@/components/ModalHost";

const MODULE_ICON: Record<string, string> = {
  purchase_orders: "📑",
  transfers: "🚚",
  announcements: "📢",
  stock: "📦",
  batches: "🧪",
};

const MODULE_LABEL: Record<string, string> = {
  purchase_orders: "Purchase Orders",
  transfers: "Stock Transfers",
  announcements: "Announcements",
  stock: "Stock",
  batches: "Batches",
};

/** Map notification module to the sidebar tab id */
const MODULE_TO_TAB: Record<string, string> = {
  purchase_orders: "pos",
  transfers: "transfers",
  announcements: "announcements",
  stock: "allstock",
  batches: "batches",
};

function timeAgo(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AppShell() {
  const {
    announcements,
    announcementReads,
    reorderRequests,
    notifications,
    session,
    vendorRow,
    isAdmin,
    isOnline,
    offlineOps,
    logout,
    openModal,
    markNotifRead,
    markAllNotifsRead,
    flushQueue,
    isDemo,
    resetDemoData,
    enableDemoMode,
    exitDemoMode,
  } = useApp();
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [activeRole, setActiveRole] = useState<"admin" | "vendor">("admin");
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const effectiveIsAdmin = isDemo ? activeRole === "admin" : (isAdmin || activeRole === "admin");

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifDropdownOpen(false);
      }
    };
    if (notifDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifDropdownOpen]);

  const vendorReads = useMemo(
    () => new Set((announcementReads || []).filter((r) => r.vendor_id === vendorRow?.id).map((r) => r.announcement_id)),
    [announcementReads, vendorRow]
  );

  const unreadAnnouncementsCount = useMemo(
    () => (announcements || []).filter((a) => a.is_active && !vendorReads.has(a.id)).length,
    [announcements, vendorReads]
  );

  const pendingReordersCount = useMemo(
    () => (reorderRequests || []).filter((r) => r.status === "pending").length,
    [reorderRequests]
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.is_read),
    [notifications]
  );

  // Count unread per module for sidebar badges
  const unreadByModule = useMemo(() => {
    const map: Record<string, number> = {};
    unreadNotifications.forEach((n) => {
      map[n.module] = (map[n.module] || 0) + 1;
    });
    return map;
  }, [unreadNotifications]);

  const alertBadgeCount = effectiveIsAdmin ? unreadAnnouncementsCount + pendingReordersCount : unreadAnnouncementsCount;
  const totalNotifCount = unreadNotifications.length;

  const handleNavigate = (tab: string, vendorId?: string) => {
    setActiveTab(tab);
    if (vendorId) {
      setSelectedVendorId(vendorId);
    }
    setMobileNavOpen(false);
  };

  const handleNotifClick = (notifId: string, module: string) => {
    void markNotifRead(notifId);
    const tabId = MODULE_TO_TAB[module] || "dashboard";
    setActiveTab(tabId);
    setNotifDropdownOpen(false);
  };

  if (!vendorRow) {
    return (
      <div
        style={{
          maxWidth: 560,
          margin: "80px auto",
          padding: 32,
          background: "#fff",
          border: "1px solid #E7E2D6",
          borderRadius: 4,
        }}
      >
        <h2 style={{ color: "#B3261E", marginTop: 0 }}>No vendor profile found</h2>
        <p style={{ color: "#1A1D24", fontSize: 14, lineHeight: 1.6 }}>
          You are signed in as <strong>{session?.user?.email}</strong>, but there is no row in the{" "}
          <code>vendors</code> table linked to this user.
        </p>
        <button className="btn-logout" style={{ background: "#0F1F3D", marginTop: 12 }} onClick={() => void logout()}>
          Sign Out
        </button>
      </div>
    );
  }

  const email = session?.user?.email || "";

  const navGroups = [
    {
      title: "Overview",
      items: [
        { id: "dashboard", label: "Dashboard", icon: "📊" },
        { id: "analytics", label: "Demand Forecast", icon: "📈" },
      ],
    },
    {
      title: "Inventory & Products",
      items: [
        { id: "allstock", label: "All Stock", icon: "📦", module: "stock" },
        { id: "products", label: "Products Catalog", icon: "🏷️" },
        { id: "batches", label: "Batches & Compliance", icon: "🧪", module: "batches" },
      ],
    },
    {
      title: "Logistics & Orders",
      items: [
        { id: "pos", label: "Purchase Orders", icon: "📑", module: "purchase_orders" },
        { id: "transfers", label: "Stock Transfers", icon: "🚚", module: "transfers" },
      ],
    },
    {
      title: "Financials & Audit",
      items: [
        { id: "financials", label: "Financial Valuation", icon: "💰" },
        { id: "auditlogs", label: "Audit Trail", icon: "🛡️" },
      ],
    },
    {
      title: "Administration",
      items: [
        { id: "vendors", label: "Vendor Locations", icon: "🏬" },
        { id: "announcements", label: "Announcements", icon: "📢", module: "announcements" },
      ],
    },
  ];

  const getActiveTabTitle = () => {
    return ADMIN_TAB_LABELS[activeTab as keyof typeof ADMIN_TAB_LABELS] || "Dashboard";
  };

  return (
    <>
      {isDemo && (
        <div style={{ background: "linear-gradient(90deg, #0F1F3D, #1E3A8A)", color: "#FFFFFF", padding: "8px 16px", fontSize: 13, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.2)", zIndex: 1000, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🎮</span>
            <span>
              <strong>DEMO SHOWCASE SANDBOX</strong> — Pre-loaded with example store locations, catalog products, compliance batches, and purchase order threads. <em>(Zero impact on live database)</em>
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => {
                resetDemoData();
              }}
              style={{ background: "#B8935A", color: "#FFFFFF", border: "none", padding: "4px 12px", borderRadius: 4, fontWeight: 700, cursor: "pointer", fontSize: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}
            >
              ↺ Reset Demo Data
            </button>
          </div>
        </div>
      )}

      <div className="app-container">
        {mobileNavOpen && <div className="sidebar-backdrop" onClick={() => setMobileNavOpen(false)} />}
        {/* Sleek Side Navbar */}
        <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
          <div className="sidebar-header" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/logo.png" alt="CureForever Logo" style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #B8935A", background: "#0F1F3D" }} />
            <div>
              <h1 className="sidebar-brand" style={{ fontSize: 21, lineHeight: 1 }}>CureForever</h1>
              <div className="sidebar-sub" style={{ marginTop: 2 }}>Enterprise Portal v2.0</div>
            </div>
          </div>

          {effectiveIsAdmin ? (
            <div className="sidebar-nav">
              {navGroups.map((group) => (
                <div key={group.title}>
                  <div className="nav-section-title">{group.title}</div>
                  {group.items.map((item) => {
                    const moduleCount = (item as { module?: string }).module
                      ? unreadByModule[(item as { module?: string }).module!] || 0
                      : 0;
                    return (
                      <button
                        key={item.id}
                        className={`sidebar-link ${activeTab === item.id ? "active" : ""}`}
                        onClick={() => {
                          setActiveTab(item.id);
                          setMobileNavOpen(false);
                        }}
                      >
                        <span style={{ fontSize: 15 }}>{item.icon}</span>
                        <span>{item.label}</span>
                        {moduleCount > 0 && (
                          <span className="sidebar-notif-badge">{moduleCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="sidebar-nav">
              <div className="nav-section-title">Vendor Portal</div>
              <button className="sidebar-link active">
                <span>🏬</span>
                <span>Vendor Store</span>
              </button>
            </div>
          )}

          {/* Demo Role / View Switcher (Only visible for demo accounts) */}
          {isDemo && (
            <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.15)", margin: "8px 0" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--gold-light)", fontWeight: 700, marginBottom: 8 }}>
                🎮 Switch Showcase View
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveRole("admin");
                    setActiveTab("dashboard");
                  }}
                  style={{
                    padding: "7px 8px",
                    borderRadius: 4,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor: activeRole === "admin" ? "#B8935A" : "rgba(255,255,255,0.2)",
                    background: activeRole === "admin" ? "#B8935A" : "rgba(255,255,255,0.08)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveRole("vendor");
                    setActiveTab("dashboard");
                  }}
                  style={{
                    padding: "7px 8px",
                    borderRadius: 4,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor: activeRole === "vendor" ? "#B8935A" : "rgba(255,255,255,0.2)",
                    background: activeRole === "vendor" ? "#B8935A" : "rgba(255,255,255,0.08)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  🏬 Vendor
                </button>
              </div>
            </div>
          )}

          <div className="sidebar-footer">
            <div style={{ fontSize: 13, fontWeight: 700, color: "#FFF" }}>{vendorRow.name}</div>
            <div style={{ fontSize: 11, color: "var(--gold-light)", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>

            <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className={`net-badge ${isOnline ? "online" : "offline"}`}>
                {isOnline ? "Online" : "Offline"}
              </span>
              <button
                onClick={() => void logout()}
                style={{
                  background: "transparent",
                  color: "#F87171",
                  border: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="app-main-content">
          {/* Top Bar Header */}
          <header className="top-bar">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                className="sidebar-toggle"
                onClick={() => setMobileNavOpen((v) => !v)}
                aria-label="Toggle navigation menu"
              >
                ☰
              </button>
              <h2 style={{ margin: 0, fontSize: 18, color: "#0F1F3D", fontWeight: 700 }}>{getActiveTabTitle()}</h2>
            </div>

            <div className="header-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {offlineOps.length > 0 && (
                <button
                  onClick={() => void flushQueue()}
                  title="Click to sync pending operations now"
                  style={{
                    background: "#FEF3C7",
                    color: "#92400E",
                    padding: "4px 10px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    border: "1px solid #FCD34D",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  ⚡ {offlineOps.length} pending sync (Sync now)
                </button>
              )}

              <button
                className="btn-ghost"
                onClick={() => openModal({ type: "commandPalette" })}
                title="Search & Quick Actions (Ctrl+K)"
                style={{ color: "#0F1F3D", borderColor: "#CBD5E1", background: "#F8FAFC", display: "flex", alignItems: "center", gap: 4 }}
              >
                🔍 <kbd style={{ background: "#E2E8F0", color: "#334155", padding: "1px 5px", borderRadius: 3, fontSize: 10 }}>Ctrl+K</kbd>
              </button>

              <button className="btn-ghost" onClick={() => openModal({ type: "labelStudio" })} style={{ color: "#0F1F3D", borderColor: "#CBD5E1", background: "#F8FAFC" }}>
                🏷️ Labels
              </button>

              {isAdmin && (
                <button className="btn-ghost" onClick={() => openModal({ type: "dataImport" })} style={{ color: "#0F1F3D", borderColor: "#CBD5E1", background: "#F8FAFC" }}>
                  📥 Import
                </button>
              )}

              {/* === NOTIFICATION BELL === */}
              <div ref={notifRef} style={{ position: "relative" }}>
                <button
                  className="btn-ghost notif-bell-btn"
                  onClick={() => setNotifDropdownOpen((prev) => !prev)}
                  title={`${totalNotifCount} unread notification${totalNotifCount === 1 ? "" : "s"}`}
                  style={{
                    color: "#0F1F3D",
                    borderColor: totalNotifCount > 0 ? "#B8935A" : "#CBD5E1",
                    background: totalNotifCount > 0 ? "#FFFBEB" : "#F8FAFC",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 600,
                    position: "relative",
                  }}
                >
                  🔔 Notifications
                  {totalNotifCount > 0 && (
                    <span className="notif-count-badge">
                      {totalNotifCount > 99 ? "99+" : totalNotifCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Panel */}
                {notifDropdownOpen && (
                  <div className="notif-dropdown">
                    <div className="notif-dropdown-header">
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#0F1F3D" }}>
                        Notifications
                      </span>
                      {unreadNotifications.length > 0 && (
                        <button
                          className="notif-mark-all-btn"
                          onClick={() => void markAllNotifsRead()}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="notif-dropdown-body">
                      {notifications.length === 0 ? (
                        <div className="notif-empty">
                          <span style={{ fontSize: 28 }}>🔔</span>
                          <p>No notifications yet</p>
                        </div>
                      ) : (
                        notifications.slice(0, 30).map((n) => (
                          <button
                            key={n.id}
                            className={`notif-item ${!n.is_read ? "notif-unread" : ""}`}
                            onClick={() => handleNotifClick(n.id, n.module)}
                          >
                            <div className="notif-item-icon">
                              {MODULE_ICON[n.module] || "📋"}
                            </div>
                            <div className="notif-item-content">
                              <div className="notif-item-title">{n.title}</div>
                              <div className="notif-item-msg">{n.message}</div>
                              <div className="notif-item-meta">
                                <span className="notif-module-tag">
                                  {MODULE_LABEL[n.module] || n.module}
                                </span>
                                <span>{timeAgo(n.created_at)}</span>
                              </div>
                            </div>
                            {!n.is_read && <div className="notif-unread-dot" />}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                className="btn-ghost"
                onClick={() => openModal({ type: "alerts" })}
                title={`${alertBadgeCount} unread alert${alertBadgeCount === 1 ? "" : "s"}`}
                style={{
                  color: "#0F1F3D",
                  borderColor: alertBadgeCount > 0 ? "#B8935A" : "#CBD5E1",
                  background: alertBadgeCount > 0 ? "#FFFBEB" : "#F8FAFC",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 600,
                }}
              >
                ⚠️ Alerts
                {alertBadgeCount > 0 && (
                  <span
                    style={{
                      background: "#EF4444",
                      color: "#FFFFFF",
                      fontSize: 10,
                      fontWeight: 800,
                      borderRadius: 10,
                      padding: "1px 6px",
                      minWidth: 18,
                      height: 18,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 0 0 2px #FFFFFF",
                    }}
                  >
                    {alertBadgeCount}
                  </span>
                )}
              </button>

              <button className="btn-scan" onClick={() => openModal({ type: "scanner" })}>
                Scan
              </button>

              <button className="btn-ghost" onClick={() => openModal({ type: "profile" })} style={{ color: "#0F1F3D", borderColor: "#CBD5E1", background: "#F8FAFC" }}>
                Profile
              </button>

              {effectiveIsAdmin && (
                <button className="btn-add-vendor" onClick={() => openModal({ type: "addVendor" })}>
                  + Vendor
                </button>
              )}
            </div>
          </header>

          {/* Page Body Viewport */}
          <main className="app-main">
            {effectiveIsAdmin ? (
              <>
                {activeTab === "dashboard" && <AdminDashboard onNavigate={handleNavigate} />}
                {activeTab === "analytics" && <AdminAnalytics />}
                {activeTab === "pos" && <AdminPurchaseOrders />}
                {activeTab === "transfers" && <AdminTransfers />}
                {activeTab === "allstock" && <AdminAllStock />}
                {activeTab === "batches" && <AdminBatches />}
                {activeTab === "auditlogs" && <AdminAuditLogs />}
                {activeTab === "financials" && <AdminFinancials />}
                {activeTab === "products" && <AdminProducts />}
                {activeTab === "vendors" && <AdminVendors selectedVendorId={selectedVendorId} />}
                {activeTab === "announcements" && <AdminAnnouncements />}
              </>
            ) : (
              <VendorDashboard />
            )}
          </main>
        </div>
      </div>

      <ModalHost />
    </>
  );
}