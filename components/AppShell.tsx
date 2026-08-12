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
  const [activeTab, setActiveTab] = useState("dashboard");

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
  const adminTabs: (keyof typeof ADMIN_TAB_LABELS)[] = [
    "dashboard",
    "analytics",
    "pos",
    "transfers",
    "allstock",
    "batches",
    "auditlogs",
    "financials",
    "products",
    "vendors",
    "announcements",
  ];

  return (
    <>
      <header className="top">
        <div>
          <p className="brand" style={{ margin: 0 }}>
            CureForever
          </p>
          <p className="who">
            {vendorRow.name} · {email}
          </p>
        </div>
        <div className="header-actions" style={{ flexWrap: "wrap", gap: 6 }}>
          <span className={`live-dot ${isOnline ? "" : "pulse"}`}>
            {isOnline ? "Live" : "Offline"}
          </span>
          <span className={`net-badge ${isOnline ? "online" : "offline"}`}>
            {isOnline ? "Online" : "Offline"}
          </span>
          {offlineOps.length > 0 && (
            <span className="state-tag">{offlineOps.length} pending sync</span>
          )}

          <button
            className="btn-ghost"
            onClick={() => openModal({ type: "commandPalette" })}
            title="Search & Quick Actions (Ctrl+K)"
            style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
          >
            🔍 <kbd style={{ background: "rgba(255,255,255,0.2)", padding: "1px 5px", borderRadius: 3, fontSize: 10 }}>Ctrl+K</kbd>
          </button>

          <button className="btn-ghost" onClick={() => openModal({ type: "labelStudio" })}>
            🏷️ Labels
          </button>

          {isAdmin && (
            <button className="btn-ghost" onClick={() => openModal({ type: "dataImport" })}>
              📥 Import
            </button>
          )}

          <button className="btn-ghost" onClick={() => openModal({ type: "alerts" })}>
            Alerts
          </button>

          <button className="btn-scan" onClick={() => openModal({ type: "scanner" })}>
            Scan
          </button>

          <button className="btn-ghost" onClick={() => openModal({ type: "profile" })}>
            Profile
          </button>

          {isAdmin && (
            <button className="btn-add-vendor" onClick={() => openModal({ type: "addVendor" })}>
              + Vendor
            </button>
          )}

          <button className="btn-logout" onClick={() => void logout()}>
            Logout
          </button>
        </div>
      </header>

      <main>
        {isAdmin ? (
          <>
            <nav className="admin-tabs" style={{ overflowX: "auto", flexWrap: "nowrap" }}>
              {adminTabs.map((key) => (
                <button
                  key={key}
                  className={`tab-btn ${activeTab === key ? "active" : ""}`}
                  onClick={() => setActiveTab(key)}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {ADMIN_TAB_LABELS[key]}
                </button>
              ))}
            </nav>
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

      <ModalHost />
    </>
  );
}