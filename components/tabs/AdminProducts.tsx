"use client";

import React, { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import * as api from "@/lib/db";
import { cleanText, downloadCSV, fmtDate, money } from "@/lib/utils";

export default function AdminProducts() {
  const { products, vendors, stockEntries, productBatches, visibilityMap, openModal, toast, refreshAll } = useApp();

  // Filter & Search State
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [stockStatusFilter, setStockStatusFilter] = useState("ALL");
  const [visibilityFilter, setVisibilityFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("name_asc");

  // Pagination State
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Stock totals calculation per product
  const stockTotals = useMemo(() => {
    const map: Record<string, { qty: number; value: number }> = {};
    stockEntries.forEach((e) => {
      const batch = productBatches.find((b) => b.id === e.batch_id);
      if (!map[e.product_id]) map[e.product_id] = { qty: 0, value: 0 };
      map[e.product_id].qty += Number(e.quantity) || 0;
      map[e.product_id].value += (Number(e.quantity) || 0) * (batch?.rate ?? 0);
    });
    return map;
  }, [stockEntries, productBatches]);

  const restrictedCount = (productId: string) => visibilityMap[productId]?.size || 0;

  // Unique categories for dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  // Reset page when any filter changes
  const handleFilterChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, val: T) => {
    setter(val);
    setCurrentPage(1);
  };

  // Filtered & Sorted Rows
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products
      .filter((p) => {
        // 1. Search Query
        if (q) {
          const matchesName = cleanText(p.name).toLowerCase().includes(q);
          const matchesSku = (p.sku || "").toLowerCase().includes(q);
          const matchesCategory = (p.category || "").toLowerCase().includes(q);
          const matchesBarcode = (p.barcode || "").toLowerCase().includes(q);
          if (!matchesName && !matchesSku && !matchesCategory && !matchesBarcode) return false;
        }

        // 2. Category Filter
        if (categoryFilter !== "ALL" && (p.category || "") !== categoryFilter) {
          return false;
        }

        // 3. Stock Status Filter
        const qty = stockTotals[p.id]?.qty ?? 0;
        const threshold = p.low_stock_threshold ?? 0;
        if (stockStatusFilter === "IN_STOCK" && qty <= 0) return false;
        if (stockStatusFilter === "LOW_STOCK" && (qty <= 0 || qty > threshold)) return false;
        if (stockStatusFilter === "OUT_OF_STOCK" && qty > 0) return false;

        // 4. Visibility Filter
        const rc = restrictedCount(p.id);
        if (visibilityFilter === "PUBLIC" && rc > 0) return false;
        if (visibilityFilter === "RESTRICTED" && rc === 0) return false;

        return true;
      })
      .sort((a, b) => {
        const qtyA = stockTotals[a.id]?.qty ?? 0;
        const qtyB = stockTotals[b.id]?.qty ?? 0;

        switch (sortBy) {
          case "name_desc":
            return cleanText(b.name).localeCompare(cleanText(a.name));
          case "sku_asc":
            return (a.sku || "").localeCompare(b.sku || "");
          case "stock_desc":
            return qtyB - qtyA;
          case "stock_asc":
            return qtyA - qtyB;
          case "price_desc":
            return (b.selling_price ?? 0) - (a.selling_price ?? 0);
          case "price_asc":
            return (a.selling_price ?? 0) - (b.selling_price ?? 0);
          case "name_asc":
          default:
            return cleanText(a.name).localeCompare(cleanText(a.name));
        }
      });
  }, [products, search, categoryFilter, stockStatusFilter, visibilityFilter, sortBy, stockTotals, visibilityMap]);

  // Pagination calculation
  const totalItems = filteredRows.length;
  const effectivePageSize = pageSize === 0 ? Math.max(1, totalItems) : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * effectivePageSize;
  const endIndex = pageSize === 0 ? totalItems : Math.min(startIndex + effectivePageSize, totalItems);

  const paginatedRows = useMemo(() => {
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, startIndex, endIndex]);

  // Bulk Selection Handlers
  const isCurrentPageAllSelected = paginatedRows.length > 0 && paginatedRows.every((p) => selectedIds.has(p.id));
  const isSomeCurrentPageSelected = paginatedRows.some((p) => selectedIds.has(p.id));

  const toggleSelectAllCurrentPage = () => {
    const next = new Set(selectedIds);
    if (isCurrentPageAllSelected) {
      paginatedRows.forEach((p) => next.delete(p.id));
    } else {
      paginatedRows.forEach((p) => next.add(p.id));
    }
    setSelectedIds(next);
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Single Item Delete
  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete product "${cleanText(name)}"? This action cannot be undone.`)) {
      try {
        await api.deleteProductRow(id);
        const next = new Set(selectedIds);
        next.delete(id);
        setSelectedIds(next);
        await refreshAll();
        toast("Product deleted successfully");
      } catch (err) {
        toast("Delete failed: " + (err as Error).message);
      }
    }
  };

  // Bulk Delete Selected
  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    if (
      confirm(
        `⚠️ Are you sure you want to BULK DELETE ${count} selected product${count > 1 ? "s" : ""}? All associated visibility rules and stock entries will be permanently removed.`
      )
    ) {
      setIsDeletingBulk(true);
      try {
        await api.deleteProductsBulk(Array.from(selectedIds));
        setSelectedIds(new Set());
        await refreshAll();
        toast(`Successfully deleted ${count} product${count > 1 ? "s" : ""}`);
      } catch (err) {
        toast("Bulk delete failed: " + (err as Error).message);
      } finally {
        setIsDeletingBulk(false);
      }
    }
  };

  // CSV Export (respects current filtered rows)
  const exportCSV = () => {
    const header = ["Name", "SKU", "Category", "Cost", "Selling", "Low threshold", "Reorder threshold", "Barcode", "Total qty", "Stock value"];
    const data = filteredRows.map((p) => [
      p.name,
      p.sku,
      p.category || "",
      money(p.cost_price ?? 0),
      money(p.selling_price ?? 0),
      p.low_stock_threshold,
      p.reorder_threshold ?? "",
      p.barcode || "",
      stockTotals[p.id]?.qty ?? 0,
      money(stockTotals[p.id]?.value ?? 0),
    ]);
    downloadCSV(`products-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...data]);
    toast(`Exported ${filteredRows.length} products`);
  };

  const hasActiveFilters = search || categoryFilter !== "ALL" || stockStatusFilter !== "ALL" || visibilityFilter !== "ALL" || sortBy !== "name_asc";

  return (
    <div className="panel">
      {/* Header Bar */}
      <div className="panel-head">
        <h2>
          Products Catalog ({filteredRows.length}{filteredRows.length !== products.length ? ` of ${products.length}` : ""})
        </h2>
        <div className="filters" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="export-btn" onClick={exportCSV}>
            📥 Export CSV ({filteredRows.length})
          </button>
          <button className="btn-add-vendor" onClick={() => openModal({ type: "product", product: null })}>
            + New Product
          </button>
        </div>
      </div>

      {/* Advanced Filters Toolbar */}
      <div
        style={{
          padding: "14px 20px",
          background: "#F8FAFC",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Search Input */}
        <div style={{ minWidth: 220, flex: 1 }}>
          <input
            className="search-input"
            placeholder="🔍 Search name, SKU, barcode..."
            value={search}
            onChange={(e) => handleFilterChange(setSearch, e.target.value)}
            style={{ width: "100%", margin: 0, padding: "8px 12px", borderRadius: 6 }}
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => handleFilterChange(setCategoryFilter, e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, fontSize: 13, borderColor: "#CBD5E1", background: "#FFF", margin: 0, width: "auto" }}
        >
          <option value="ALL">All Categories ({categories.length})</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Stock Status Filter */}
        <select
          value={stockStatusFilter}
          onChange={(e) => handleFilterChange(setStockStatusFilter, e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, fontSize: 13, borderColor: "#CBD5E1", background: "#FFF", margin: 0, width: "auto" }}
        >
          <option value="ALL">All Stock Statuses</option>
          <option value="IN_STOCK">In Stock (&gt; 0)</option>
          <option value="LOW_STOCK">⚠️ Low Stock (Below Threshold)</option>
          <option value="OUT_OF_STOCK">🚨 Out of Stock (= 0)</option>
        </select>

        {/* Visibility Filter */}
        <select
          value={visibilityFilter}
          onChange={(e) => handleFilterChange(setVisibilityFilter, e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, fontSize: 13, borderColor: "#CBD5E1", background: "#FFF", margin: 0, width: "auto" }}
        >
          <option value="ALL">All Visibility</option>
          <option value="PUBLIC">🌐 Public (All Vendors)</option>
          <option value="RESTRICTED">🔒 Restricted (Specific Vendors)</option>
        </select>

        {/* Sort By Selector */}
        <select
          value={sortBy}
          onChange={(e) => handleFilterChange(setSortBy, e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, fontSize: 13, borderColor: "#CBD5E1", background: "#FFF", margin: 0, width: "auto" }}
        >
          <option value="name_asc">Sort: Name (A to Z)</option>
          <option value="name_desc">Sort: Name (Z to A)</option>
          <option value="sku_asc">Sort: SKU Code</option>
          <option value="stock_desc">Sort: Stock (High to Low)</option>
          <option value="stock_asc">Sort: Stock (Low to High)</option>
          <option value="price_desc">Sort: Price (High to Low)</option>
          <option value="price_asc">Sort: Price (Low to High)</option>
        </select>

        {/* Reset Filters Button */}
        {hasActiveFilters && (
          <button
            className="btn-ghost"
            onClick={() => {
              setSearch("");
              setCategoryFilter("ALL");
              setStockStatusFilter("ALL");
              setVisibilityFilter("ALL");
              setSortBy("name_asc");
              setCurrentPage(1);
            }}
            style={{ color: "#DC2626", borderColor: "#FCA5A5", fontSize: 12, padding: "6px 10px" }}
          >
            ✕ Reset Filters
          </button>
        )}
      </div>

      {/* Floating / Top Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div
          style={{
            background: "#FEF2F2",
            borderBottom: "1px solid #FCA5A5",
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 700, color: "#991B1B", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <span>☑️ {selectedIds.size} product{selectedIds.size > 1 ? "s" : ""} selected</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="save-btn"
              onClick={() => void handleBulkDelete()}
              disabled={isDeletingBulk}
              style={{ background: "#DC2626", color: "#FFFFFF", padding: "6px 14px", fontSize: 12, fontWeight: 700 }}
            >
              {isDeletingBulk ? "Deleting..." : `🗑️ Bulk Delete Selected (${selectedIds.size})`}
            </button>
            <button
              className="btn-ghost"
              onClick={clearSelection}
              style={{ color: "#475569", borderColor: "#CBD5E1", fontSize: 12 }}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={isCurrentPageAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isSomeCurrentPageSelected && !isCurrentPageAllSelected;
                  }}
                  onChange={toggleSelectAllCurrentPage}
                  title="Select all products on this page"
                  style={{ cursor: "pointer", margin: 0, width: 16, height: 16 }}
                />
              </th>
              <th>Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Cost</th>
              <th>Selling</th>
              <th>Threshold</th>
              <th>In stock</th>
              <th>Stock value</th>
              <th>Visibility</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length === 0 && (
              <tr>
                <td colSpan={11} className="empty">
                  No products match the selected search &amp; filter criteria.
                </td>
              </tr>
            )}
            {paginatedRows.map((p) => {
              const rc = restrictedCount(p.id);
              const isSelected = selectedIds.has(p.id);
              return (
                <tr key={p.id} style={{ background: isSelected ? "#FEF2F2" : undefined }}>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectRow(p.id)}
                      style={{ cursor: "pointer", margin: 0, width: 16, height: 16 }}
                    />
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", border: "1px solid #E2E8F0" }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 6, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                          📦
                        </div>
                      )}
                      <div>
                        <strong>{cleanText(p.name)}</strong>
                        {p.description && <div className="sku">{p.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="sku">{p.sku}</td>
                  <td>{p.category || "—"}</td>
                  <td>{money(p.cost_price ?? 0)}</td>
                  <td>{money(p.selling_price ?? 0)}</td>
                  <td>
                    {p.low_stock_threshold}
                    {p.reorder_threshold ? ` / ${p.reorder_threshold}` : ""}
                  </td>
                  <td>{stockTotals[p.id]?.qty ?? 0}</td>
                  <td>{money(stockTotals[p.id]?.value ?? 0)}</td>
                  <td>
                    {rc > 0 ? (
                      <button className="link-btn" onClick={() => openModal({ type: "restrict", productId: p.id })}>
                        {rc} vendor{rc === 1 ? "" : "s"} only
                      </button>
                    ) : (
                      <span className="state-tag">ALL</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                      <button className="link-btn" onClick={() => openModal({ type: "product", product: p })}>
                        Edit
                      </button>
                      <button className="link-btn" onClick={() => openModal({ type: "restrict", productId: p.id })}>
                        Restrict
                      </button>
                      <button className="link-btn" style={{ color: "#B3261E" }} onClick={() => void handleDelete(p.id, p.name)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Synchronized Pagination & Status Footer */}
      <div
        style={{
          padding: "14px 20px",
          borderTop: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          background: "#FAF9F5",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "#475569" }}>
          <span>
            Showing {totalItems === 0 ? 0 : startIndex + 1} to {endIndex} of {totalItems} product{totalItems === 1 ? "" : "s"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 12, margin: 0, color: "#64748B" }}>Per page:</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{ padding: "4px 8px", borderRadius: 4, fontSize: 12, border: "1px solid #CBD5E1", margin: 0, width: "auto" }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>All ({totalItems})</option>
            </select>
          </div>
        </div>

        {/* Page Navigation Buttons */}
        {pageSize > 0 && totalPages > 1 && (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button
              className="btn-ghost"
              disabled={activePage === 1}
              onClick={() => setCurrentPage(1)}
              style={{ padding: "5px 10px", fontSize: 12, color: "#0F1F3D", borderColor: "#CBD5E1" }}
            >
              « First
            </button>
            <button
              className="btn-ghost"
              disabled={activePage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{ padding: "5px 10px", fontSize: 12, color: "#0F1F3D", borderColor: "#CBD5E1" }}
            >
              ‹ Prev
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0F1F3D", padding: "0 8px" }}>
              Page {activePage} of {totalPages}
            </span>
            <button
              className="btn-ghost"
              disabled={activePage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{ padding: "5px 10px", fontSize: 12, color: "#0F1F3D", borderColor: "#CBD5E1" }}
            >
              Next ›
            </button>
            <button
              className="btn-ghost"
              disabled={activePage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              style={{ padding: "5px 10px", fontSize: 12, color: "#0F1F3D", borderColor: "#CBD5E1" }}
            >
              Last »
            </button>
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: "#6B7280", padding: "6px 20px 12px" }}>
        Vendors in system: {vendors.filter((v) => !v.is_admin).length} · {fmtDate(new Date().toISOString())}
      </div>
    </div>
  );
}