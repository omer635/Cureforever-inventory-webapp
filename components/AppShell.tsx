"use client";

import React, { useState } from "react";
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

export default function AppShell() {
  const {
    session,
    vendorRow,
    isAdmin,
    isOnline,
    offlineOps,
    logout,
    openModal,
  } = useApp();
  const [activeTab, setActiveTab] = useState<string>("dashboard");

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
        { id: "analytics", label: "AI Analytics & Forecast", icon: "📈" },
      ],
    },
    {
      title: "Inventory & Products",
      items: [
        { id: "allstock", label: "All Stock", icon: "📦" },
        { id: "products", label: "Products Catalog", icon: "🏷️" },
        { id: "batches", label: "Batches & Compliance", icon: "🧪" },
      ],
    },
    {
      title: "Logistics & Orders",
      items: [
        { id: "pos", label: "Purchase Orders", icon: "📑" },
        { id: "transfers", label: "Stock Transfers", icon: "🚚" },
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
        { id: "announcements", label: "Announcements", icon: "📢" },
      ],
    },
  ];

  const getActiveTabTitle = () => {
    return ADMIN_TAB_LABELS[activeTab as keyof typeof ADMIN_TAB_LABELS] || "Dashboard";
  };

  return (
    <>
      <div className="app-container">
        {/* Sleek Side Navbar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h1 className="sidebar-brand">CureForever</h1>
            <div className="sidebar-sub">Enterprise Portal v2.0</div>
          </div>

          {isAdmin ? (
            <div className="sidebar-nav">
              {navGroups.map((group) => (
                <div key={group.title}>
                  <div className="nav-section-title">{group.title}</div>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      className={`sidebar-link ${activeTab === item.id ? "active" : ""}`}
                      onClick={() => setActiveTab(item.id)}
                    >
                      <span style={{ fontSize: 15 }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
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
            <div>
              <h2 style={{ margin: 0, fontSize: 18, color: "#0F1F3D", fontWeight: 700 }}>{getActiveTabTitle()}</h2>
            </div>

            <div className="header-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {offlineOps.length > 0 && (
                <span className="state-tag" style={{ background: "#FEF3C7", color: "#92400E", padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                  {offlineOps.length} pending sync
                </span>
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

              <button className="btn-ghost" onClick={() => openModal({ type: "alerts" })} style={{ color: "#0F1F3D", borderColor: "#CBD5E1", background: "#F8FAFC" }}>
                Alerts
              </button>

              <button className="btn-scan" onClick={() => openModal({ type: "scanner" })}>
                Scan
              </button>

              <button className="btn-ghost" onClick={() => openModal({ type: "profile" })} style={{ color: "#0F1F3D", borderColor: "#CBD5E1", background: "#F8FAFC" }}>
                Profile
              </button>

              {isAdmin && (
                <button className="btn-add-vendor" onClick={() => openModal({ type: "addVendor" })}>
                  + Vendor
                </button>
              )}
            </div>
          </header>

          {/* Page Body Viewport */}
          <main style={{ maxWidth: "100%", width: "100%", padding: 24, flex: 1 }}>
            {isAdmin ? (
              <>
                {activeTab === "dashboard" && <AdminDashboard />}
                {activeTab === "analytics" && <AdminAnalytics />}
                {activeTab === "pos" && <AdminPurchaseOrders />}
                {activeTab === "transfers" && <AdminTransfers />}
                {activeTab === "allstock" && <AdminAllStock />}
                {activeTab === "batches" && <AdminBatches />}
                {activeTab === "auditlogs" && <AdminAuditLogs />}
                {activeTab === "financials" && <AdminFinancials />}
                {activeTab === "products" && <AdminProducts />}
                {activeTab === "vendors" && <AdminVendors />}
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