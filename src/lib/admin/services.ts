// =============================================================================
// StarPress Admin — Production Service Layer
// Communicates with real /api/admin endpoints backed by PostgreSQL & Persistent Storage
// =============================================================================

import type {
  AdminProduct,
  AdminOrder,
  AdminCustomer,
  AdminCategory,
  AdminDiscount,
  PaginatedResult,
  ProductFilters,
  OrderFilters,
  DashboardStats,
  AnalyticsData,
  FinanceSummary,
  FinanceTransaction,
  MarketingCampaign,
  ContentPage,
  ProductStatus,
} from './types';


// Helper to safely fetch from window origin with Supabase Bearer token attached
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  let authHeader: Record<string, string> = {};

  if (typeof window !== 'undefined') {
    try {
      const { supabase } = await import('@/lib/supabase/client');
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        authHeader = { Authorization: `Bearer ${data.session.access_token}` };
      }
    } catch {}
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options?.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}

// =============================================================================
// Product Service
// =============================================================================

export const productService = {
  async getProducts(filters: ProductFilters = {}): Promise<PaginatedResult<AdminProduct> & { stats?: any }> {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.category && filters.category !== 'all') params.set('category', filters.category);
    if (filters.stockStatus && filters.stockStatus !== 'all') params.set('stockStatus', filters.stockStatus);
    if (filters.page) params.set('page', filters.page.toString());
    if (filters.pageSize) params.set('limit', filters.pageSize.toString());
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

    try {
      const res = await apiFetch<{
        success: boolean;
        products: any[];
        total: number;
        page: number;
        limit: number;
        stats?: any;
      }>(`/api/admin/products?${params.toString()}`);

      const formatted: AdminProduct[] = res.products.map((p) => ({
        id: p.id,
        sku: p.sku || `SP-${p.slug?.substring(0, 8)?.toUpperCase() || 'ITEM'}`,
        name: p.name,
        slug: p.slug || p.id,
        shortDescription: p.shortDescription || '',
        description: p.description || '',
        categoryId: p.categoryId || 'cat-1',
        categoryName: p.categoryName || 'Business Printing',
        status: p.status || 'published',
        basePrice: Number(p.basePrice || 0),
        compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
        costPerItem: p.costPerUnit ? Number(p.costPerUnit) : null,
        taxable: true,
        trackInventory: p.trackInventory ?? true,
        stockQuantity: p.stockQuantity ?? 100,
        lowStockThreshold: p.lowStockThreshold ?? 10,
        allowBackorders: false,
        images: (p.images || []).map((img: any, i: number) => ({
          id: img.id || `img_${i}`,
          url: img.url || '',
          altText: img.altText || p.name,
          isPrimary: img.isPrimary ?? i === 0,
          position: img.position ?? i,
        })),
        variantOptions: p.variantOptions || [],
        variants: p.variants || [],
        tags: p.metaKeywords ? p.metaKeywords.split(',').map((s: string) => s.trim()) : [],
        collections: [],
        brand: 'Star Press',
        weight: null,
        weightUnit: 'g',
        dimensions: null,
        requiresShipping: true,
        fragile: false,
        shippingClass: 'standard',
        seo: {
          title: p.metaTitle || p.name,
          description: p.metaDescription || '',
          slug: p.slug || '',
        },
        visibility: { onlineStore: true, pos: false, shop: true },
        featured: p.isFeatured ?? false,
        publishedAt: p.publishedAt || null,
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString(),
      }));

      const totalPages = Math.ceil(res.total / (filters.pageSize || 10)) || 1;
      return {
        data: formatted,
        total: res.total,
        page: res.page || 1,
        pageSize: res.limit || 10,
        totalPages,
        stats: res.stats,
      };

    } catch (err) {
      console.error('[productService.getProducts] error:', err);
      return { data: [], total: 0, page: 1, pageSize: 10, totalPages: 1 };
    }
  },

  async getProduct(id: string): Promise<AdminProduct | null> {
    try {
      const res = await apiFetch<{ success: boolean; product: any }>(`/api/admin/products/${id}`);
      const p = res.product;
      if (!p) return null;

      return {
        id: p.id,
        sku: p.sku || `SP-${p.slug?.substring(0, 8)?.toUpperCase() || 'ITEM'}`,
        name: p.name,
        slug: p.slug || p.id,
        shortDescription: p.shortDescription || '',
        description: p.description || '',
        categoryId: p.categoryId || 'cat-1',
        categoryName: p.categoryName || 'Business Printing',
        status: p.status || 'published',
        basePrice: Number(p.basePrice || 0),
        compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
        costPerItem: p.costPerUnit ? Number(p.costPerUnit) : null,
        taxable: true,
        trackInventory: p.trackInventory ?? true,
        stockQuantity: p.stockQuantity ?? 100,
        lowStockThreshold: p.lowStockThreshold ?? 10,
        allowBackorders: false,
        images: (p.images || []).map((img: any, i: number) => ({
          id: img.id || `img_${i}`,
          url: img.url || '',
          altText: img.altText || p.name,
          isPrimary: img.isPrimary ?? i === 0,
          position: img.position ?? i,
        })),
        variantOptions: p.variantOptions || [],
        variants: p.variants || [],
        tags: p.metaKeywords ? p.metaKeywords.split(',').map((s: string) => s.trim()) : [],
        collections: [],
        brand: 'Star Press',
        weight: null,
        weightUnit: 'g',
        dimensions: null,
        requiresShipping: true,
        fragile: false,
        shippingClass: 'standard',
        seo: {
          title: p.metaTitle || p.name,
          description: p.metaDescription || '',
          slug: p.slug || '',
        },
        visibility: { onlineStore: true, pos: false, shop: true },
        featured: p.isFeatured ?? false,
        publishedAt: p.publishedAt || null,
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },

  async createProduct(data: Partial<AdminProduct>): Promise<AdminProduct> {
    const payload = {
      name: data.name,
      slug: data.slug,
      sku: data.sku,
      description: data.description,
      shortDescription: data.shortDescription,
      categoryId: data.categoryId,
      basePrice: data.basePrice,
      compareAtPrice: data.compareAtPrice,
      costPerUnit: data.costPerItem,
      stockQuantity: data.stockQuantity,
      lowStockThreshold: data.lowStockThreshold,
      status: data.status,
      isFeatured: data.featured,
      metaTitle: data.seo?.title,
      metaDescription: data.seo?.description,
      metaKeywords: data.tags?.join(', '),
      images: (data.images || []).map((img, idx) => ({
        url: img.url,
        altText: img.altText,
        isPrimary: img.isPrimary ?? idx === 0,
        position: idx,
      })),
    };

    const res = await apiFetch<{ success: boolean; product: any }>('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return (await this.getProduct(res.product.id)) || (res.product as any);
  },

  async updateProduct(id: string, data: Partial<AdminProduct>): Promise<AdminProduct | null> {
    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.slug !== undefined) payload.slug = data.slug;
    if (data.sku !== undefined) payload.sku = data.sku;
    if (data.description !== undefined) payload.description = data.description;
    if (data.shortDescription !== undefined) payload.shortDescription = data.shortDescription;
    if (data.categoryId !== undefined) payload.categoryId = data.categoryId;
    if (data.basePrice !== undefined) payload.basePrice = data.basePrice;
    if (data.compareAtPrice !== undefined) payload.compareAtPrice = data.compareAtPrice;
    if (data.costPerItem !== undefined) payload.costPerUnit = data.costPerItem;
    if (data.stockQuantity !== undefined) payload.stockQuantity = data.stockQuantity;
    if (data.lowStockThreshold !== undefined) payload.lowStockThreshold = data.lowStockThreshold;
    if (data.status !== undefined) payload.status = data.status;
    if (data.featured !== undefined) payload.isFeatured = data.featured;
    if (data.seo?.title !== undefined) payload.metaTitle = data.seo.title;
    if (data.seo?.description !== undefined) payload.metaDescription = data.seo.description;
    if (data.tags !== undefined) payload.metaKeywords = data.tags.join(', ');

    // Always send images array so the server can sync them
    if (data.images !== undefined) {
      payload.images = (data.images || []).map((img: any, idx: number) => ({
        url: img.url,
        altText: img.altText || '',
        isPrimary: img.isPrimary ?? idx === 0,
        position: img.position ?? idx,
      }));
    }

    await apiFetch(`/api/admin/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    return this.getProduct(id);
  },

  async deleteProduct(id: string): Promise<boolean> {
    try {
      const res = await apiFetch<{ success: boolean }>(`/api/admin/products/${id}`, {
        method: 'DELETE',
      });
      return !!res.success;
    } catch {
      return false;
    }
  },

  async duplicateProduct(id: string): Promise<AdminProduct | null> {
    const original = await this.getProduct(id);
    if (!original) return null;

    return this.createProduct({
      ...original,
      name: `${original.name} (Copy)`,
      sku: `${original.sku}-COPY`,
      slug: `${original.slug}-copy-${Date.now().toString(36)}`,
      status: 'draft',
    });
  },

  async bulkUpdateStatus(ids: string[], status: ProductStatus): Promise<number> {
    const res = await apiFetch<{ success: boolean; count: number }>('/api/admin/products/bulk', {
      method: 'POST',
      body: JSON.stringify({ action: 'update_status', ids, status }),
    });
    return res.count || ids.length;
  },

  async bulkDelete(ids: string[]): Promise<number> {
    const res = await apiFetch<{ success: boolean; count: number }>('/api/admin/products/bulk', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', ids }),
    });
    return res.count || ids.length;
  },

  getStats() {
    return { total: 0, published: 0, draft: 0, archived: 0, outOfStock: 0, lowStock: 0 };
  },
};

// =============================================================================
// Order Service (REAL API)
// =============================================================================

export const orderService = {
  async getOrders(filters: OrderFilters = {}): Promise<PaginatedResult<AdminOrder> & { stats?: any }> {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.paymentStatus && filters.paymentStatus !== 'all') params.set('paymentStatus', filters.paymentStatus);
    if (filters.page) params.set('page', filters.page.toString());
    if (filters.pageSize) params.set('limit', filters.pageSize.toString());

    try {
      const res = await apiFetch<{
        success: boolean;
        orders: AdminOrder[];
        total: number;
        totalPages: number;
        page: number;
        limit: number;
        stats: any;
      }>(`/api/admin/orders?${params.toString()}`);

      return {
        data: res.orders || [],
        total: res.total || 0,
        page: res.page || 1,
        pageSize: res.limit || 10,
        totalPages: res.totalPages || 1,
        stats: res.stats,
      };
    } catch (err) {
      console.error('[orderService.getOrders] error:', err);
      throw err;
    }
  },

  async getOrder(id: string): Promise<AdminOrder | null> {
    try {
      const res = await apiFetch<{ success: boolean; order: any }>(`/api/admin/orders/${id}`);
      return res.order;
    } catch {
      return null;
    }
  },

  async updateOrderStatus(
    id: string,
    status: string,
    tracking?: { trackingNumber?: string; courierPartner?: string; notes?: string }
  ): Promise<{ success: boolean; order?: any }> {
    return apiFetch(`/api/admin/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...tracking }),
    });
  },

  async markOrderPaid(id: string): Promise<{ success: boolean; message?: string }> {
    return apiFetch(`/api/admin/orders/${id}/mark-paid`, {
      method: 'POST',
    });
  },

  async createOrder(data: any): Promise<{ success: boolean; order?: any; error?: string }> {
    try {
      return await apiFetch<{ success: boolean; order?: any }>('/api/admin/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to create order' };
    }
  },

  getStats() {
    return { total: 0, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, refunded: 0 };
  },
};

// =============================================================================
// Customer Service (REAL API)
// =============================================================================

export const customerService = {
  async getCustomers(
    search?: string,
    page = 1,
    pageSize = 25,
    filter?: string
  ): Promise<PaginatedResult<AdminCustomer> & { stats?: { total: number; withOrders: number; noOrders: number } }> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filter && filter !== 'all') params.set('filter', filter);
    params.set('page', page.toString());
    params.set('limit', pageSize.toString());

    try {
      const res = await apiFetch<{
        success: boolean;
        customers: AdminCustomer[];
        stats?: { total: number; withOrders: number; noOrders: number };
        total: number;
        totalPages: number;
        page: number;
        limit: number;
      }>(`/api/admin/customers?${params.toString()}`);

      return {
        data: res.customers || [],
        total: res.total || 0,
        page: res.page || 1,
        pageSize: res.limit || 25,
        totalPages: res.totalPages || 1,
        stats: res.stats,
      };
    } catch (err) {
      console.error('[customerService.getCustomers] error:', err);
      return { data: [], total: 0, page: 1, pageSize: 25, totalPages: 1 };
    }
  },
};

// =============================================================================
// Category Service (REAL API)
// =============================================================================

export const categoryService = {
  async getCategories(): Promise<AdminCategory[]> {
    try {
      const res = await apiFetch<{ success: boolean; categories: any[] }>('/api/admin/categories');
      return (res.categories || []).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description || '',
        imageUrl: c.imageUrl || null,
        displayOrder: c.displayOrder || 0,
        productCount: c.productCount || 0,
        parentId: null,
      }));
    } catch {
      return [];
    }
  },

  async createCategory(data: {
    name: string;
    slug?: string;
    description?: string;
    imageUrl?: string;
  }): Promise<AdminCategory> {
    const res = await apiFetch<{ success: boolean; category: any }>('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return {
      id: res.category.id,
      name: res.category.name,
      slug: res.category.slug,
      description: res.category.description || '',
      imageUrl: res.category.imageUrl || null,
      displayOrder: res.category.displayOrder || 0,
      productCount: 0,
      parentId: null,
    };
  },

  async updateCategory(
    id: string,
    data: Partial<{ name: string; slug: string; description: string; imageUrl: string | null }>
  ): Promise<AdminCategory> {
    const res = await apiFetch<{ success: boolean; category: any }>(`/api/admin/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return {
      id: res.category.id,
      name: res.category.name,
      slug: res.category.slug,
      description: res.category.description || '',
      imageUrl: res.category.imageUrl || null,
      displayOrder: res.category.displayOrder || 0,
      productCount: res.category.productCount || 0,
      parentId: null,
    };
  },

  async deleteCategory(id: string): Promise<boolean> {
    try {
      const res = await apiFetch<{ success: boolean }>(`/api/admin/categories/${id}`, {
        method: 'DELETE',
      });
      return !!res.success;
    } catch {
      return false;
    }
  },

  async reorderCategories(orders: Array<{ id: string; displayOrder: number }>): Promise<boolean> {
    try {
      // We use the [id] route POST for reorder — any id works, the body has all orders
      const res = await apiFetch<{ success: boolean }>(`/api/admin/categories/${orders[0]?.id || 'reorder'}`, {
        method: 'POST',
        body: JSON.stringify({ orders }),
      });
      return !!res.success;
    } catch {
      return false;
    }
  },
};

// =============================================================================
// Dashboard / Analytics / Finance Services (REAL APIS)
// =============================================================================

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    try {
      const res = await apiFetch<{ success: boolean; stats: DashboardStats }>('/api/admin/dashboard');
      return res.stats;
    } catch (err) {
      console.error('[dashboardService.getStats] error:', err);
      return {
        totalRevenue: 0,
        revenueChange: 0,
        totalOrders: 0,
        ordersChange: 0,
        totalProducts: 0,
        productsChange: 0,
        totalCustomers: 0,
        customersChange: 0,
        averageOrderValue: 0,
        aovChange: 0,
        conversionRate: 0,
        conversionChange: 0,
      };
    }
  },
};

export const analyticsService = {
  async getData(): Promise<AnalyticsData> {
    try {
      const res = await apiFetch<{ success: boolean; analytics: AnalyticsData }>('/api/admin/analytics');
      return res.analytics;
    } catch (err) {
      console.error('[analyticsService.getData] error:', err);
      return {
        revenueByMonth: [],
        topProducts: [],
        topCategories: [],
        customerGrowth: [],
      };
    }
  },
};

export const financeService = {
  async getSummary(): Promise<FinanceSummary> {
    try {
      const res = await apiFetch<{ success: boolean; summary: FinanceSummary }>('/api/admin/finances');
      return res.summary;
    } catch {
      return {
        totalRevenue: 0,
        netSales: 0,
        totalRefunds: 0,
        totalTax: 0,
        totalPayouts: 0,
        pendingPayouts: 0,
      };
    }
  },

  async getTransactions(): Promise<FinanceTransaction[]> {
    try {
      const res = await apiFetch<{ success: boolean; transactions: FinanceTransaction[] }>('/api/admin/finances');
      return res.transactions || [];
    } catch {
      return [];
    }
  },
};

export const discountService = {
  async getDiscounts(): Promise<AdminDiscount[]> {
    try {
      const res = await apiFetch<{ success: boolean; discounts: AdminDiscount[] }>('/api/admin/discounts');
      return res.discounts || [];
    } catch {
      return [];
    }
  },

  async createDiscount(data: {
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    minOrderAmount?: number | null;
    usageLimit?: number | null;
    startDate?: string;
    endDate?: string | null;
    isActive?: boolean;
  }): Promise<AdminDiscount> {
    const res = await apiFetch<{ success: boolean; discount: AdminDiscount }>('/api/admin/discounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.discount;
  },

  async updateDiscount(
    id: string,
    data: Partial<{
      code: string;
      type: 'percentage' | 'fixed';
      value: number;
      minOrderAmount: number | null;
      usageLimit: number | null;
      startDate: string;
      endDate: string | null;
      isActive: boolean;
      status: string;
    }>
  ): Promise<AdminDiscount> {
    const res = await apiFetch<{ success: boolean; discount: AdminDiscount }>(`/api/admin/discounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.discount;
  },

  async deleteDiscount(id: string): Promise<boolean> {
    try {
      const res = await apiFetch<{ success: boolean }>(`/api/admin/discounts/${id}`, {
        method: 'DELETE',
      });
      return Boolean(res.success);
    } catch {
      return false;
    }
  },
};

export const marketingService = {
  async getCampaigns(): Promise<MarketingCampaign[]> {
    try {
      const res = await apiFetch<{ success: boolean; campaigns: MarketingCampaign[] }>('/api/admin/marketing/campaigns');
      return res.campaigns || [];
    } catch (err) {
      console.error('[marketingService.getCampaigns] error:', err);
      return [];
    }
  },

  async createCampaign(data: {
    name: string;
    type: string;
    budget: number;
    reach: number;
    startDate: string;
    endDate?: string | null;
  }): Promise<MarketingCampaign> {
    const res = await apiFetch<{ success: boolean; campaign: MarketingCampaign }>('/api/admin/marketing/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.campaign;
  },

  async toggleCampaignStatus(id: string, status?: string): Promise<MarketingCampaign> {
    const res = await apiFetch<{ success: boolean; campaign: MarketingCampaign }>('/api/admin/marketing/campaigns', {
      method: 'PATCH',
      body: JSON.stringify({ id, status }),
    });
    return res.campaign;
  },

  async deleteCampaign(id: string): Promise<boolean> {
    try {
      const res = await apiFetch<{ success: boolean }>(`/api/admin/marketing/campaigns?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return Boolean(res.success);
    } catch {
      return false;
    }
  },

  async getAnnouncement(): Promise<{ text: string; isActive: boolean; color: 'gold' | 'emerald' | 'navy' | 'crimson' }> {
    try {
      const res = await apiFetch<{ success: boolean; announcement: any }>('/api/admin/marketing/announcement');
      return res.announcement;
    } catch {
      return {
        text: '⚡ Welcome to Star Press: Premier Commercial Printing & Custom Fabrication in Khatima!',
        isActive: true,
        color: 'gold',
      };
    }
  },

  async saveAnnouncement(data: { text: string; isActive: boolean; color: string }): Promise<boolean> {
    try {
      const res = await apiFetch<{ success: boolean }>('/api/admin/marketing/announcement', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return Boolean(res.success);
    } catch {
      return false;
    }
  },
};

export const contentService = {
  async getPages(): Promise<ContentPage[]> {
    try {
      const res = await apiFetch<{ success: boolean; pages: ContentPage[] }>('/api/admin/content');
      return res.pages || [];
    } catch (err) {
      console.error('[contentService.getPages] error:', err);
      return [];
    }
  },
};
