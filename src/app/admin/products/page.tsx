'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  MoreHorizontal,
  Copy,
  Archive,
  Trash2,
  Edit3,
  Eye,
  Package,
  CheckCircle2,
  AlertTriangle,
  FolderTree,
  Grid3X3,
  List,
  X,
  ChevronDown,
  Layers,
  ArrowUpDown,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import StatCard from '@/components/admin/ui/StatCard';
import StatusBadge from '@/components/admin/ui/StatusBadge';
import Pagination from '@/components/admin/ui/Pagination';
import ConfirmDialog from '@/components/admin/ui/ConfirmDialog';
import EmptyState from '@/components/admin/ui/EmptyState';
import { Skeleton, SkeletonCard, SkeletonTableRow } from '@/components/admin/ui/Skeleton';
import { showToast } from '@/components/admin/ui/Toast';
import { productService, categoryService } from '@/lib/admin/services';
import type { AdminProduct, AdminCategory, ProductStatus } from '@/lib/admin/types';

type StatusTab = 'all' | ProductStatus | 'out_of_stock';

export default function ProductsPage() {
  const router = useRouter();

  // Data state
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [catalogStats, setCatalogStats] = useState({
    total: 0,
    published: 0,
    draft: 0,
    lowStock: 0,
  });

  // Filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'created' | 'name' | 'price' | 'stock'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; ids: string[]; loading: boolean }>({
    open: false,
    ids: [],
    loading: false,
  });
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Load products
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const statusFilter = statusTab === 'out_of_stock' ? 'all' : statusTab;
      const stockFilter = statusTab === 'out_of_stock' ? 'out_of_stock' : 'all';

      const result = await productService.getProducts({
        search: debouncedSearch,
        status: statusFilter as ProductStatus | 'all',
        category: selectedCategory,
        stockStatus: stockFilter as 'all' | 'out_of_stock',
        sortBy,
        sortOrder,
        page,
        pageSize: 12,
      });

      setProducts(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);

      // Real-time catalog stats from database
      if ((result as any).stats) {
        setCatalogStats((result as any).stats);
      } else if (result.total > 0) {
        setCatalogStats((prev) => prev.total !== 0 ? prev : ({
          ...prev,
          total: result.total,
          published: result.data.filter((p) => p.status === 'published').length || result.total,
        }));
      }
    } catch (err) {
      console.error('Failed to load products:', err);
      showToast('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusTab, selectedCategory, sortBy, sortOrder, page]);


  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Load categories and initial catalog stats
  useEffect(() => {
    categoryService.getCategories().then(setCategories).catch(() => {});
    // Fetch global product stats
    fetch('/api/admin/products?limit=1')
      .then((r) => r.json())
      .then((res) => {
        if (res.stats) {
          setCatalogStats(res.stats);
        } else if (res.total) {
          setCatalogStats((prev) => ({ ...prev, total: res.total }));
        }
      })
      .catch(() => {});
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusTab, selectedCategory]);

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  // Actions
  const handleDelete = async () => {
    setDeleteDialog((d) => ({ ...d, loading: true }));
    const count = await productService.bulkDelete(deleteDialog.ids);
    setDeleteDialog({ open: false, ids: [], loading: false });
    setSelectedIds(new Set());
    showToast(`${count} product${count !== 1 ? 's' : ''} deleted successfully`);
    loadProducts();
  };

  const handleDuplicate = async (id: string) => {
    const dup = await productService.duplicateProduct(id);
    if (dup) {
      showToast(`"${dup.name}" duplicated as draft`);
      loadProducts();
    }
  };

  const handleBulkStatusChange = async (status: ProductStatus) => {
    const count = await productService.bulkUpdateStatus([...selectedIds], status);
    setSelectedIds(new Set());
    showToast(`${count} product${count !== 1 ? 's' : ''} set to ${status}`);
    loadProducts();
  };

  const handleToggleProductStatus = async (product: AdminProduct) => {
    const newStatus: ProductStatus = product.status === 'published' ? 'draft' : 'published';
    // Optimistic update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, status: newStatus } : p))
    );
    try {
      const res = await productService.updateProduct(product.id, { status: newStatus });
      if (res) {
        showToast(`"${product.name}" is now ${newStatus === 'published' ? 'Active on store' : 'Draft'}`);
      } else {
        throw new Error('Failed to update');
      }
    } catch {
      showToast('Failed to update product status', 'error');
      loadProducts();
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN').format(price);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const STATUS_TABS: { key: StatusTab; label: string }[] = [
    { key: 'all', label: 'All Catalog' },
    { key: 'published', label: 'Active' },
    { key: 'draft', label: 'Drafts' },
    { key: 'out_of_stock', label: 'Out of Stock' },
    { key: 'archived', label: 'Archived' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E5E7EB]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">Products &amp; Inventory</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[#B45309] text-xs font-semibold">
              {total} Total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#667085] mt-1">
            Configure catalog items, base pricing, categories, stock levels, and store visibility.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/admin/categories"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-[#E5E7EB] shadow-xs transition-all"
          >
            <FolderTree size={14} className="text-purple-600" />
            <span>Categories ({categories.length})</span>
          </Link>

          <Link
            href="/admin/products/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#F5A623] hover:bg-[#E09612] text-slate-950 transition-all shadow-sm active:scale-[0.98]"
          >
            <Plus size={15} />
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Row - Real Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <StatCard
          icon={Package}
          title="Catalog Items"
          value={(catalogStats.total || total).toLocaleString()}
          iconColor="text-amber-500"
          period="in database"
        />
        <StatCard
          icon={CheckCircle2}
          title="Active Published"
          value={(catalogStats.published || products.filter((p) => p.status === 'published').length).toLocaleString()}
          iconColor="text-emerald-500"
          period="live on store"
        />
        <StatCard
          icon={AlertTriangle}
          title="Low / Out of Stock"
          value={(catalogStats.lowStock || products.filter((p) => p.stockQuantity <= 10).length).toLocaleString()}
          iconColor="text-rose-500"
          period="needs restocking"
        />
        <StatCard
          icon={FolderTree}
          title="Categories"
          value={categories.length.toLocaleString()}
          iconColor="text-purple-500"
          period="active collections"
        />
      </div>

      {/* Toolbar: Search + Filter + Sort + Status Tabs */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="p-3.5 sm:p-4 border-b border-[#E5E7EB] flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, SKU, or slug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-8 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#F5A623] transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none h-9 pl-3 pr-8 rounded-xl bg-[#F9FAFB] hover:bg-white border border-[#E5E7EB] text-xs font-medium text-slate-700 focus:outline-none focus:border-[#F5A623] transition-colors cursor-pointer shadow-xs"
            >
              <option value="all">
                All Categories
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb as typeof sortBy);
                setSortOrder(so as typeof sortOrder);
              }}
              className="appearance-none h-9 pl-3 pr-8 rounded-xl bg-[#F9FAFB] hover:bg-white border border-[#E5E7EB] text-xs font-medium text-slate-700 focus:outline-none focus:border-[#F5A623] transition-colors cursor-pointer shadow-xs"
            >
              <option value="created-desc">
                Newest First
              </option>
              <option value="created-asc">
                Oldest First
              </option>
              <option value="name-asc">
                Name A–Z
              </option>
              <option value="name-desc">
                Name Z–A
              </option>
              <option value="price-asc">
                Price: Low to High
              </option>
              <option value="price-desc">
                Price: High to Low
              </option>
              <option value="stock-asc">
                Stock: Low to High
              </option>
              <option value="stock-desc">
                Stock: High to Low
              </option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* View Toggle */}
          <div className="flex items-center border border-[#E5E7EB] rounded-xl overflow-hidden ml-auto bg-[#F9FAFB]">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="List view"
            >
              <List size={15} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Grid view"
            >
              <Grid3X3 size={15} />
            </button>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-[#E5E7EB] overflow-x-auto no-scrollbar">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                statusTab === tab.key
                  ? 'bg-[#1E2536] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content: List or Grid */}
        {loading ? (
          <div className="p-4">
            <table className="w-full">
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonTableRow key={i} cols={6} />
                ))}
              </tbody>
            </table>
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products found"
            description={
              search ? `No products match "${search}"` : 'Your catalog currently has no products matching this filter.'
            }
            action={
              <Link
                href="/admin/products/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#F5A623] hover:bg-[#E09612] text-slate-950 transition-colors shadow-sm"
              >
                <Plus size={14} />
                <span>Create Product</span>
              </Link>
            }
          />
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product) => {
              const imgUrl = product.images?.[0]?.url;
              return (
                <div
                  key={product.id}
                  onClick={() => router.push(`/admin/products/${product.id}`)}
                  className="group bg-white border border-[#E5E7EB] hover:border-[#F5A623]/50 rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer flex flex-col"
                >
                  <div className="aspect-[4/3] bg-slate-50 relative overflow-hidden flex items-center justify-center border-b border-[#E5E7EB]">
                    {imgUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imgUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <Package size={32} className="text-slate-300" />
                    )}
                    <div className="absolute top-2.5 right-2.5">
                      <StatusBadge status={product.stockQuantity === 0 ? 'out_of_stock' : product.status} />
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#F5A623]">
                        {product.categoryName}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 mt-1 group-hover:text-[#F5A623] transition-colors line-clamp-1">
                        {product.name}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5">{product.sku}</p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900 font-mono">₹{formatPrice(product.basePrice)}</span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          product.stockQuantity === 0
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : product.stockQuantity <= 10
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {product.stockQuantity} in stock
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="w-10 px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === products.length && products.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-[#F5A623] focus:ring-[#F5A623] cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3.5">
                    Product
                  </th>
                  <th className="px-4 py-3.5">
                    SKU &amp; Date
                  </th>
                  <th className="px-4 py-3.5">
                    Price
                  </th>
                  <th className="px-4 py-3.5">
                    Inventory
                  </th>
                  <th className="px-4 py-3.5">
                    Status
                  </th>
                  <th className="w-12 px-4 py-3.5 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-xs text-slate-700">
                {products.map((product) => {
                  const imgUrl = product.images?.[0]?.url;
                  return (
                    <tr
                      key={product.id}
                      onClick={() => router.push(`/admin/products/${product.id}`)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                        selectedIds.has(product.id) ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={() => toggleSelect(product.id)}
                          className="w-4 h-4 rounded border-slate-300 text-[#F5A623] focus:ring-[#F5A623] cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-[#E5E7EB] flex items-center justify-center text-slate-400 shrink-0 overflow-hidden">
                            {imgUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imgUrl}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                loading="lazy"
                              />
                            ) : (
                              <Package size={16} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-[#F5A623] transition-colors truncate max-w-[280px]">
                              {product.name}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">{product.categoryName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-xs font-mono text-slate-700">{product.sku}</div>
                        <div className="text-[11px] text-slate-500">{formatDate(product.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
                          ₹{formatPrice(product.basePrice)}
                        </div>
                        {product.compareAtPrice && (
                          <div className="text-[11px] text-slate-400 line-through font-mono">
                            ₹{formatPrice(product.compareAtPrice)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                            product.stockQuantity === 0
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : product.stockQuantity <= 10
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              product.stockQuantity === 0
                                ? 'bg-rose-500'
                                : product.stockQuantity <= 10
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                          {product.stockQuantity} in stock
                        </span>
                      </td>
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleProductStatus(product)}
                          title={`Click to switch between Active and Draft`}
                          className="inline-flex items-center gap-1.5 transition-all hover:opacity-80 active:scale-95 cursor-pointer"
                        >
                          <StatusBadge status={product.stockQuantity === 0 ? 'out_of_stock' : product.status} />
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => window.open(`/shop/${product.slug}`, '_blank')}
                            title="Preview on Live Storefront"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <ExternalLink size={14} />
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => setActionMenuId(actionMenuId === product.id ? null : product.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              aria-label="Actions"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                          {actionMenuId === product.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActionMenuId(null)} />
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#E5E7EB] rounded-xl shadow-xl py-1.5 z-20 animate-fadeIn">
                                <button
                                  onClick={() => {
                                    router.push(`/admin/products/${product.id}`);
                                    setActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  <Edit3 size={13} className="text-[#F5A623]" /> Edit Details
                                </button>
                                <button
                                  onClick={() => {
                                    window.open(`/shop/${product.slug}`, '_blank');
                                    setActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  <Eye size={13} className="text-blue-500" /> View Storefront
                                </button>
                                <button
                                  onClick={() => {
                                    handleDuplicate(product.id);
                                    setActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  <Copy size={13} className="text-purple-500" /> Duplicate Item
                                </button>
                                <div className="border-t border-[#E5E7EB] my-1" />
                                <button
                                  onClick={() => {
                                    setDeleteDialog({ open: true, ids: [product.id], loading: false });
                                    setActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                                >
                                  <Trash2 size={13} /> Delete Product
                                </button>
                              </div>
                            </>
                          )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3.5 border-t border-[#E5E7EB] flex items-center justify-between">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={12}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-[#12161F] text-white border border-slate-700 rounded-xl shadow-2xl animate-fadeIn">
          <span className="text-xs font-semibold text-white">
            <strong className="text-[#F5A623] font-bold">{selectedIds.size}</strong> selected
          </span>
          <div className="w-px h-4 bg-slate-700" />
          <button
            onClick={() => handleBulkStatusChange('published')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors"
          >
            <Eye size={13} /> Publish
          </button>
          <button
            onClick={() => handleBulkStatusChange('draft')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/[0.08] transition-colors"
          >
            <Edit3 size={13} /> Set Draft
          </button>
          <button
            onClick={() => handleBulkStatusChange('archived')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/[0.08] transition-colors"
          >
            <Archive size={13} /> Archive
          </button>
          <button
            onClick={() => setDeleteDialog({ open: true, ids: [...selectedIds], loading: false })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 size={13} /> Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
            title="Deselect all"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Selected Products"
        message={`Are you sure you want to delete ${deleteDialog.ids.length} product${
          deleteDialog.ids.length !== 1 ? 's' : ''
        }? This permanently removes them from the StarPress database.`}
        confirmLabel="Confirm Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, ids: [], loading: false })}
        loading={deleteDialog.loading}
      />
    </div>
  );
}
