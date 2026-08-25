"use client";

import React, { useState } from "react";
import { useApp } from "@/components/AppProvider";

type ActiveSubTab = "webhooks" | "accounting" | "logs";

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  status: "active" | "paused" | "error";
  lastDelivery: string;
  successRate: number;
}

interface AccountingService {
  id: string;
  name: string;
  logo: string;
  status: "connected" | "disconnected";
  lastSync: string;
  syncedRecords: number;
  description: string;
}

interface DeliveryLog {
  id: string;
  eventId: string;
  event: string;
  targetUrl: string;
  statusCode: number;
  durationMs: number;
  timestamp: string;
  payloadSnippet: string;
}

export default function AdminIntegrations() {
  const { stockAdjustments, purchaseOrders, toast } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<ActiveSubTab>("webhooks");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);

  // Webhooks State
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([
    {
      id: "wh-101",
      name: "Shopify OMS Inventory Listener",
      url: "https://api.wtfevryday.com/webhooks/shopify-stock",
      secret: "whsec_9a8b7c6d5e4f3a2b1c",
      events: ["stock.updated", "low_stock.alert"],
      status: "active",
      lastDelivery: new Date().toISOString(),
      successRate: 99.4,
    },
    {
      id: "wh-102",
      name: "QuickBooks Auto-Sync Endpoint",
      url: "https://connect.quickbooks.com/v3/company/913/webhook",
      secret: "whsec_qb_7721839102",
      events: ["po.status_changed", "accounting.sync"],
      status: "active",
      lastDelivery: new Date(Date.now() - 3600000).toISOString(),
      successRate: 100.0,
    },
    {
      id: "wh-103",
      name: "Custom ERP Warehouse Listener",
      url: "https://erp.internal.cureforever.com/api/v1/stock-adjustments",
      secret: "whsec_erp_custom_0019",
      events: ["batch.expired", "stock.updated"],
      status: "active",
      lastDelivery: new Date(Date.now() - 7200000).toISOString(),
      successRate: 98.2,
    },
  ]);

  // Accounting Services State
  const [services, setServices] = useState<AccountingService[]>([
    {
      id: "quickbooks",
      name: "QuickBooks Online",
      logo: "🟢",
      status: "connected",
      lastSync: new Date(Date.now() - 1800000).toLocaleString(),
      syncedRecords: 142,
      description: "Auto-posts Purchase Orders as Accounts Payable Bills & updates inventory asset ledgers.",
    },
    {
      id: "xero",
      name: "Xero Accounting",
      logo: "🔵",
      status: "connected",
      lastSync: new Date(Date.now() - 7200000).toLocaleString(),
      syncedRecords: 89,
      description: "Synchronizes stock valuation, cost-of-goods-sold (COGS), and inventory asset balances.",
    },
    {
      id: "mybillbook",
      name: "myBillBook (GST Invoicing)",
      logo: "📙",
      status: "connected",
      lastSync: new Date(Date.now() - 14400000).toLocaleString(),
      syncedRecords: 310,
      description: "Syncs GST e-invoices, vendor bill receipts, and automated stock reconciliation.",
    },
    {
      id: "tally",
      name: "Tally Prime ERP",
      logo: "⚡",
      status: "disconnected",
      lastSync: "Never",
      syncedRecords: 0,
      description: "Exports Tally XML voucher payload definitions for batch ledger posting.",
    },
  ]);

  // Delivery Logs
  const [logs, setLogs] = useState<DeliveryLog[]>([
    {
      id: "log-901",
      eventId: "evt_99812",
      event: "stock.updated",
      targetUrl: "https://api.wtfevryday.com/webhooks/shopify-stock",
      statusCode: 200,
      durationMs: 142,
      timestamp: new Date().toISOString(),
      payloadSnippet: `{"event": "stock.updated", "product_id": "prod-1", "new_qty": 45, "timestamp": "${new Date().toISOString()}"}`,
    },
    {
      id: "log-902",
      eventId: "evt_99813",
      event: "po.status_changed",
      targetUrl: "https://connect.quickbooks.com/v3/company/913/webhook",
      statusCode: 200,
      durationMs: 210,
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      payloadSnippet: `{"event": "po.status_changed", "po_number": "PO-2026-001", "status": "accepted", "total": 12500}`,
    },
    {
      id: "log-903",
      eventId: "evt_99814",
      event: "low_stock.alert",
      targetUrl: "https://api.wtfevryday.com/webhooks/shopify-stock",
      statusCode: 200,
      durationMs: 118,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      payloadSnippet: `{"event": "low_stock.alert", "product_name": "Amoxicillin 500mg", "current_qty": 4, "threshold": 10}`,
    },
  ]);

  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");

  const handleAddEndpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl || !newName) {
      toast("Please provide both endpoint name and target URL");
      return;
    }
    const newEp: WebhookEndpoint = {
      id: `wh-${Date.now().toString().slice(-4)}`,
      name: newName,
      url: newUrl,
      secret: `whsec_${Math.random().toString(36).substring(2, 12)}`,
      events: ["stock.updated", "po.status_changed"],
      status: "active",
      lastDelivery: new Date().toISOString(),
      successRate: 100.0,
    };
    setEndpoints((prev) => [newEp, ...prev]);
    setNewUrl("");
    setNewName("");
    toast("New Webhook Endpoint registered successfully!");
  };

  const handleTestWebhook = (ep: WebhookEndpoint) => {
    setIsTestingWebhook(true);
    setTimeout(() => {
      setIsTestingWebhook(false);
      const newLog: DeliveryLog = {
        id: `log-${Date.now().toString().slice(-4)}`,
        eventId: `evt_${Math.floor(Math.random() * 90000 + 10000)}`,
        event: "test.ping",
        targetUrl: ep.url,
        statusCode: 200,
        durationMs: Math.floor(Math.random() * 100 + 80),
        timestamp: new Date().toISOString(),
        payloadSnippet: `{"event": "test.ping", "endpoint_id": "${ep.id}", "status": "success", "ping_time": "${new Date().toISOString()}"}`,
      };
      setLogs((prev) => [newLog, ...prev]);
      toast(`Test payload dispatched to ${ep.name} (200 OK)`);
    }, 600);
  };

  const handleSyncAccounting = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      const nowStr = new Date().toLocaleString();
      setServices((prev) =>
        prev.map((s) =>
          s.status === "connected"
            ? { ...s, lastSync: nowStr, syncedRecords: s.syncedRecords + Math.floor(Math.random() * 5 + 1) }
            : s
        )
      );
      toast("Successfully synchronized accounting records with QuickBooks, Xero & myBillBook!");
    }, 1000);
  };

  const toggleServiceConnection = (serviceId: string) => {
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== serviceId) return s;
        const nextStatus = s.status === "connected" ? "disconnected" : "connected";
        toast(`${s.name} integration ${nextStatus === "connected" ? "connected" : "disconnected"}`);
        return { ...s, status: nextStatus, lastSync: nextStatus === "connected" ? new Date().toLocaleString() : s.lastSync };
      })
    );
  };

  return (
    <div className="tab-pane active" style={{ animation: "fadeIn 0.2s ease" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: "#0F1F3D", fontSize: 20 }}>Integrations, Webhooks & ERP Accounting Sync</h2>
          <p style={{ margin: "4px 0 0", color: "#5C6B73", fontSize: 13 }}>
            Connect external Order Management Systems (OMS), dispatch real-time stock event webhooks, and sync accounting with QuickBooks, Xero, myBillBook & Tally.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Sub-Tab Navigation */}
          <div style={{ background: "#F1F5F9", padding: 3, borderRadius: 6, display: "flex", gap: 2 }}>
            <button
              onClick={() => setActiveSubTab("webhooks")}
              style={{
                padding: "5px 12px",
                border: "none",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: activeSubTab === "webhooks" ? "#FFF" : "transparent",
                color: activeSubTab === "webhooks" ? "#0F172A" : "#64748B",
                boxShadow: activeSubTab === "webhooks" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              }}
              data-testid="subtab-webhooks"
            >
              🔌 API Webhooks
            </button>
            <button
              onClick={() => setActiveSubTab("accounting")}
              style={{
                padding: "5px 12px",
                border: "none",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: activeSubTab === "accounting" ? "#FFF" : "transparent",
                color: activeSubTab === "accounting" ? "#0F172A" : "#64748B",
                boxShadow: activeSubTab === "accounting" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              }}
              data-testid="subtab-accounting"
            >
              📊 Accounting & ERP Sync
            </button>
            <button
              onClick={() => setActiveSubTab("logs")}
              style={{
                padding: "5px 12px",
                border: "none",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: activeSubTab === "logs" ? "#FFF" : "transparent",
                color: activeSubTab === "logs" ? "#0F172A" : "#64748B",
                boxShadow: activeSubTab === "logs" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              }}
              data-testid="subtab-logs"
            >
              ⚡ Delivery Event Logs
            </button>
          </div>
        </div>
      </div>

      {/* Main Sub-Tab View Rendering */}
      {activeSubTab === "webhooks" && (
        <>
          {/* Register New Webhook Form */}
          <div style={{ background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 8, padding: 18, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#0F1F3D", fontWeight: 700 }}>
              ➕ Register Outgoing Webhook Endpoint
            </h4>
            <form onSubmit={handleAddEndpoint} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Endpoint Name (e.g. Shopify OMS Webhook)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13 }}
                required
                data-testid="webhook-name-input"
              />
              <input
                type="url"
                placeholder="Target HTTPS URL (e.g. https://api.mybrand.com/webhooks)"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                style={{ flex: 2, minWidth: 260, padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13 }}
                required
                data-testid="webhook-url-input"
              />
              <button
                type="submit"
                style={{ padding: "8px 16px", background: "#0F1F3D", color: "#FFF", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                data-testid="add-webhook-btn"
              >
                Register Webhook
              </button>
            </form>
          </div>

          {/* Active Webhook Endpoints List */}
          <div style={{ background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ padding: "14px 18px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 style={{ margin: 0, fontSize: 14, color: "#0F1F3D", fontWeight: 700 }}>Active Webhook Endpoints ({endpoints.length})</h4>
              <span style={{ fontSize: 12, color: "#166534", background: "#F0FDF4", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>HMAC-SHA256 Signed</span>
            </div>

            <div className="table-responsive">
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#F3F4F6", borderBottom: "1px solid #E5E7EB", fontSize: 12, textTransform: "uppercase", color: "#4B5563" }}>
                    <th style={{ padding: "10px 16px" }}>Webhook Name</th>
                    <th style={{ padding: "10px 16px" }}>Target URL</th>
                    <th style={{ padding: "10px 16px" }}>Subscribed Events</th>
                    <th style={{ padding: "10px 16px" }}>Success Rate</th>
                    <th style={{ padding: "10px 16px" }}>Status</th>
                    <th style={{ padding: "10px 16px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map((ep) => (
                    <tr key={ep.id} style={{ borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
                      <td style={{ padding: "12px 16px" }}>
                        <strong style={{ color: "#0F172A" }}>{ep.name}</strong>
                        <div style={{ fontSize: 11, color: "#64748B", fontFamily: "monospace" }}>Secret: {ep.secret.substring(0, 12)}...</div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#2563EB", fontFamily: "monospace", fontSize: 12 }}>{ep.url}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {ep.events.map((evt) => (
                            <span key={evt} style={{ background: "#EFF6FF", color: "#1E40AF", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                              {evt}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "#15803D" }}>{ep.successRate}%</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ background: "#DCFCE7", color: "#15803D", padding: "2px 8px", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                          🟢 200 OK
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <button
                          onClick={() => handleTestWebhook(ep)}
                          disabled={isTestingWebhook}
                          style={{ padding: "4px 10px", background: "#0F1F3D", color: "#FFF", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                          data-testid="test-webhook-btn"
                        >
                          ⚡ Test Payload
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeSubTab === "accounting" && (
        <>
          {/* Action Bar */}
          <div style={{ background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 8, padding: 16, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 15, color: "#0F1F3D", fontWeight: 700 }}>📊 Accounting & ERP Synchronization Engine</h4>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>
                Auto-sync inventory valuation, Accounts Payable bills for Purchase Orders, and GST invoice records.
              </p>
            </div>
            <button
              onClick={handleSyncAccounting}
              disabled={isSyncing}
              style={{ padding: "8px 16px", background: "#0F1F3D", color: "#FFF", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              data-testid="sync-accounting-btn"
            >
              {isSyncing ? "🔄 Syncing Records..." : "🔄 Sync Accounting Records Now"}
            </button>
          </div>

          {/* Integration Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {services.map((s) => (
              <div key={s.id} style={{ background: "#FFF", border: `1px solid ${s.status === "connected" ? "#BBF7D0" : "#E2E8F0"}`, borderRadius: 8, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 24 }}>{s.logo}</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 15, color: "#0F172A" }}>{s.name}</h4>
                      <span style={{ fontSize: 11, color: s.status === "connected" ? "#166534" : "#64748B", fontWeight: 600 }}>
                        {s.status === "connected" ? "🟢 Connected & Syncing" : "⚪ Disconnected"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleServiceConnection(s.id)}
                    style={{
                      padding: "4px 10px",
                      background: s.status === "connected" ? "#FEF2F2" : "#F0FDF4",
                      color: s.status === "connected" ? "#DC2626" : "#166534",
                      border: `1px solid ${s.status === "connected" ? "#FECACA" : "#BBF7D0"}`,
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {s.status === "connected" ? "Disconnect" : "Connect"}
                  </button>
                </div>

                <p style={{ fontSize: 12, color: "#475569", margin: "0 0 12px", height: 36, overflow: "hidden" }}>{s.description}</p>

                <div style={{ background: "#F8FAFC", padding: 10, borderRadius: 6, border: "1px solid #F1F5F9", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748B" }}>Last Sync: <strong>{s.lastSync}</strong></span>
                  <span style={{ color: "#0F172A", fontWeight: 700 }}>{s.syncedRecords} records</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeSubTab === "logs" && (
        <div style={{ background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "14px 18px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
            <h4 style={{ margin: 0, fontSize: 14, color: "#0F1F3D", fontWeight: 700 }}>⚡ Real-Time Webhook & API Delivery Event Logs</h4>
          </div>
          <div className="table-responsive">
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#F3F4F6", borderBottom: "1px solid #E5E7EB", fontSize: 12, textTransform: "uppercase", color: "#4B5563" }}>
                  <th style={{ padding: "10px 16px" }}>Timestamp</th>
                  <th style={{ padding: "10px 16px" }}>Event Type</th>
                  <th style={{ padding: "10px 16px" }}>Target URL</th>
                  <th style={{ padding: "10px 16px" }}>Status Code</th>
                  <th style={{ padding: "10px 16px" }}>Latency</th>
                  <th style={{ padding: "10px 16px" }}>Payload Preview</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
                    <td style={{ padding: "12px 16px", color: "#64748B", fontSize: 12 }}>{new Date(log.timestamp).toLocaleString()}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ background: "#EEF2FF", color: "#4338CA", padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontSize: 11, fontFamily: "monospace" }}>
                        {log.event}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#2563EB", fontFamily: "monospace", fontSize: 11, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.targetUrl}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ background: "#DCFCE7", color: "#15803D", padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                        {log.statusCode} OK
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#475569" }}>{log.durationMs} ms</td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 11, color: "#334155", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.payloadSnippet}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
