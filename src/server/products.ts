import { db } from "@/lib/db";
import { getAllProducts, CATALOG_CATEGORIES, PRODUCT_SLUG_ALIASES, type CatalogProduct } from "@/lib/catalog";
import { persistentStore } from "@/server/storage";

export interface ListAdminProductsOptions {
  search?: string;
  category?: string;
  status?: string; // "ALL", "draft", "published", "archived"
  stockStatus?: string; // "ALL", "in_stock", "low_stock", "out_of_stock"
  page?: number;
  limit?: number;
  sortBy?: "name" | "basePrice" | "stockQuantity" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface AdminProductDto {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  status: "draft" | "published" | "archived";
  basePrice: number;
  compareAtPrice?: number | null;
  costPerUnit?: number | null;
  discountPercentage?: number | null;
  marginPercent?: number | null;
  trackInventory: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  isFeatured: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  images: Array<{
    id: string;
    url: string;
    altText?: string | null;
    isPrimary: boolean;
    position: number;
  }>;
}

/**
 * Helper to slugify a string
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/**
 * Generate a clean standard SKU from name and category
 */
export function generateSku(name: string, categorySlug: string = "PRD"): string {
  const prefix = categorySlug.substring(0, 3).toUpperCase();
  const namePart = name
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 4)
    .toUpperCase();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `SP-${prefix}-${namePart}-${randomSuffix}`;
}

/**
 * Calculate profit margin percentage
 */
export function calculateMargin(basePrice: number, costPerUnit?: number | null): number | null {
  if (!costPerUnit || costPerUnit <= 0 || basePrice <= 0) return null;
  const margin = ((basePrice - costPerUnit) / basePrice) * 100;
  return parseFloat(margin.toFixed(1));
}

/**
 * List products for the admin panel with filtering, sorting, pagination, and fallback to catalog
 */
export async function listAdminProducts(options: ListAdminProductsOptions = {}) {
  const {
    search = "",
    category = "ALL",
    status = "ALL",
    stockStatus = "ALL",
    page = 1,
    limit = 25,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  let dbProducts: any[] = [];
  let dbTotal = 0;
  let globalCount = 0;
  let publishedCount = 0;
  let draftCount = 0;
  let lowStockCount = 0;

  try {
    const where: any = {};

    if (search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { sku: { contains: search.trim(), mode: "insensitive" } },
        { slug: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    if (category !== "ALL") {
      where.category = {
        OR: [{ id: category }, { slug: category }, { name: category }],
      };
    }

    if (status !== "ALL") {
      where.status = status;
    }

    if (stockStatus === "in_stock") {
      where.stockQuantity = { gt: 10 };
    } else if (stockStatus === "low_stock") {
      where.stockQuantity = { gt: 0, lte: 10 };
    } else if (stockStatus === "out_of_stock") {
      where.stockQuantity = { lte: 0 };
    }

    const skip = (page - 1) * limit;

    const [products, total, gc, pc, dc, lsc] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          category: true,
          images: {
            orderBy: { position: "asc" },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      db.product.count({ where }),
      db.product.count(),
      db.product.count({ where: { status: "published" } }),
      db.product.count({ where: { status: "draft" } }),
      db.product.count({ where: { stockQuantity: { lte: 10 } } }),
    ]);

    dbProducts = products;
    dbTotal = total;
    globalCount = gc;
    publishedCount = pc;
    draftCount = dc;
    lowStockCount = lsc;
  } catch (err) {
    console.warn("[Admin Products] Database query fallback:", err);
  }

  // If database has records, format and return them
  if (globalCount > 0) {
    const formatted: AdminProductDto[] = dbProducts.map((p) => {
      const basePrice = Number(p.basePrice);
      const costPerUnit = p.costPerUnit ? Number(p.costPerUnit) : null;
      return {
        id: p.id,
        sku: p.sku || `SP-${p.slug.substring(0, 8).toUpperCase()}`,
        name: p.name,
        slug: p.slug,
        description: p.description || "",
        shortDescription: p.shortDescription || "",
        categoryId: p.categoryId,
        categoryName: p.category?.name || "General Printing",
        categorySlug: p.category?.slug || "general",
        status: (p.status as any) || "published",
        basePrice,
        compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
        costPerUnit,
        discountPercentage: p.discountPercentage || null,
        marginPercent: calculateMargin(basePrice, costPerUnit),
        trackInventory: p.trackInventory ?? true,
        stockQuantity: p.stockQuantity ?? 100,
        lowStockThreshold: p.lowStockThreshold ?? 10,
        isFeatured: p.isFeatured ?? false,
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
        metaKeywords: p.metaKeywords,
        publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        images: p.images.map((img: any) => ({
          id: img.id,
          url: img.url,
          altText: img.altText,
          isPrimary: img.isPrimary,
          position: img.position,
        })),
      };
    });

    return {
      products: formatted,
      total: dbTotal,
      page,
      limit,
      stats: {
        total: globalCount,
        published: publishedCount,
        draft: draftCount,
        lowStock: lowStockCount,
      },
    };
  }

  // Fallback to Star Press Catalog if database is currently empty, enriched with customProducts and productOverrides
  const overrides = persistentStore.getProductOverrides();
  const customProducts = persistentStore.getCustomProducts();

  let catalogItems: AdminProductDto[] = getAllProducts().map((prod: CatalogProduct, idx: number) => {
    const override = overrides[prod.id] || overrides[prod.slug] || {};
    const basePrice = override.basePrice !== undefined ? Number(override.basePrice) : prod.basePrice;
    const costPerUnit = override.costPerUnit !== undefined ? Number(override.costPerUnit) : Math.round(basePrice * 0.65);
    const stockQuantity = override.stockQuantity !== undefined ? Number(override.stockQuantity) : 20 + ((idx * 17) % 180);
    const status: "published" | "draft" | "archived" = override.status || (idx % 10 === 0 ? "draft" : "published");

    const images = override.images && Array.isArray(override.images) && override.images.length > 0
      ? override.images.map((img: any, i: number) => ({
          id: typeof img === "object" && img.id ? img.id : `img-${prod.id}-${i}`,
          url: typeof img === "object" && img.url ? img.url : String(img),
          altText: `${override.name || prod.name} Image ${i + 1}`,
          isPrimary: i === 0,
          position: i,
        }))
      : prod.images.map((url: string, i: number) => ({
          id: `img-${prod.id}-${i}`,
          url,
          altText: `${prod.name} Preview ${i + 1}`,
          isPrimary: i === 0,
          position: i,
        }));

    return {
      id: prod.id,
      sku: override.sku || generateSku(override.name || prod.name, prod.categorySlug),
      name: override.name || prod.name,
      slug: prod.slug,
      description: override.description || prod.description,
      shortDescription: override.shortDescription || prod.shortDescription,
      categoryId: prod.categorySlug,
      categoryName: prod.categoryName,
      categorySlug: prod.categorySlug,
      status,
      basePrice,
      compareAtPrice: override.compareAtPrice !== undefined ? override.compareAtPrice : Math.round(basePrice * 1.25),
      costPerUnit,
      discountPercentage: 20,
      marginPercent: calculateMargin(basePrice, costPerUnit),
      trackInventory: true,
      stockQuantity,
      lowStockThreshold: 15,
      isFeatured: override.isFeatured !== undefined ? override.isFeatured : prod.isFeatured || false,
      metaTitle: `${override.name || prod.name} | Custom Online Printing | Star Press`,
      metaDescription: override.shortDescription || prod.shortDescription,
      metaKeywords: prod.tags.join(", "),
      publishedAt: new Date().toISOString(),
      createdAt: new Date(Date.now() - idx * 86400000).toISOString(),
      updatedAt: override.updatedAt || new Date().toISOString(),
      images,
    } as AdminProductDto;
  });

  // Prepend any custom products created by the administrator
  if (customProducts.length > 0) {
    const formattedCustom: AdminProductDto[] = customProducts.map((c) => ({
      id: c.id,
      sku: c.sku || generateSku(c.name),
      name: c.name,
      slug: c.slug,
      description: c.description || "",
      shortDescription: c.shortDescription || "",
      categoryId: c.categoryId || "business-printing",
      categoryName: c.categoryName || "Business Printing",
      categorySlug: c.categorySlug || "business-printing",
      status: c.status || "published",
      basePrice: Number(c.basePrice || 0),
      compareAtPrice: c.compareAtPrice ? Number(c.compareAtPrice) : null,
      costPerUnit: c.costPerUnit ? Number(c.costPerUnit) : null,
      discountPercentage: c.discountPercentage || 0,
      marginPercent: calculateMargin(Number(c.basePrice || 0), Number(c.costPerUnit || 0)),
      trackInventory: c.trackInventory ?? true,
      stockQuantity: c.stockQuantity ?? 100,
      lowStockThreshold: c.lowStockThreshold ?? 10,
      isFeatured: c.isFeatured || false,
      metaTitle: c.metaTitle || `${c.name} | Star Press`,
      metaDescription: c.metaDescription || c.shortDescription || "",
      metaKeywords: c.metaKeywords || "",
      publishedAt: c.createdAt || new Date().toISOString(),
      createdAt: c.createdAt || new Date().toISOString(),
      updatedAt: c.updatedAt || new Date().toISOString(),
      images: (c.images || []).map((img: any, i: number) => ({
        id: typeof img === "object" && img.id ? img.id : `img-${c.id}-${i}`,
        url: typeof img === "object" && img.url ? img.url : String(img),
        altText: `${c.name} Image ${i + 1}`,
        isPrimary: i === 0,
        position: i,
      })),
    }));
    catalogItems = [...formattedCustom, ...catalogItems];
  }

  // Apply filters to catalog fallback
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    catalogItems = catalogItems.filter(
      (p: AdminProductDto) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
    );
  }

  if (category !== "ALL") {
    catalogItems = catalogItems.filter(
      (p: AdminProductDto) => p.categorySlug === category || p.categoryName === category
    );
  }

  if (status !== "ALL") {
    catalogItems = catalogItems.filter((p: AdminProductDto) => p.status === status);
  }

  if (stockStatus === "in_stock") {
    catalogItems = catalogItems.filter((p: AdminProductDto) => p.stockQuantity > 10);
  } else if (stockStatus === "low_stock") {
    catalogItems = catalogItems.filter((p: AdminProductDto) => p.stockQuantity > 0 && p.stockQuantity <= 10);
  } else if (stockStatus === "out_of_stock") {
    catalogItems = catalogItems.filter((p: AdminProductDto) => p.stockQuantity <= 0);
  }

  const total = catalogItems.length;
  const startIndex = (page - 1) * limit;
  const paginated = catalogItems.slice(startIndex, startIndex + limit);

  return {
    products: paginated,
    total,
    page,
    limit,
    stats: {
      total,
      published: catalogItems.filter((p: AdminProductDto) => p.status === "published").length,
      draft: catalogItems.filter((p: AdminProductDto) => p.status === "draft").length,
      lowStock: catalogItems.filter((p: AdminProductDto) => p.stockQuantity <= 10).length,
    },
  };
}

/**
 * Get single product by ID or slug
 */
export async function getAdminProductById(idOrSlug: string): Promise<AdminProductDto | null> {
  try {
    const catalogProd = getAllProducts().find((p: CatalogProduct) => p.id === idOrSlug || p.slug === idOrSlug);
    const candidateSlugs = [idOrSlug];
    if (idOrSlug.startsWith("prod-")) {
      candidateSlugs.push(idOrSlug.replace(/^prod-/, ""));
    }
    if (catalogProd) {
      candidateSlugs.push(catalogProd.slug);
    }

    const p = await db.product.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          ...candidateSlugs.map((s) => ({ slug: s })),
          ...(catalogProd ? [{ id: catalogProd.id }] : []),
        ],
      },
      include: {
        category: true,
        images: {
          orderBy: { position: "asc" },
        },
      },
    });

    if (p) {
      const basePrice = Number(p.basePrice);
      const costPerUnit = p.costPerUnit ? Number(p.costPerUnit) : null;
      return {
        id: p.id,
        sku: p.sku || `SP-${p.slug.substring(0, 8).toUpperCase()}`,
        name: p.name,
        slug: p.slug,
        description: p.description || "",
        shortDescription: p.shortDescription || "",
        categoryId: p.categoryId,
        categoryName: p.category?.name || "General Printing",
        categorySlug: p.category?.slug || "general",
        status: (p.status as any) || "published",
        basePrice,
        compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
        costPerUnit,
        discountPercentage: p.discountPercentage || null,
        marginPercent: calculateMargin(basePrice, costPerUnit),
        trackInventory: p.trackInventory ?? true,
        stockQuantity: p.stockQuantity ?? 100,
        lowStockThreshold: p.lowStockThreshold ?? 10,
        isFeatured: p.isFeatured ?? false,
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
        metaKeywords: p.metaKeywords,
        publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        images: p.images.map((img: any) => ({
          id: img.id,
          url: img.url,
          altText: img.altText,
          isPrimary: img.isPrimary,
          position: img.position,
        })),
      };
    }
  } catch (err) {
    console.warn("[Admin Product Detail] Database lookup fallback:", err);
  }

  // Check custom products created by admin
  const customProd = persistentStore.getCustomProducts().find((c) => c.id === idOrSlug || c.slug === idOrSlug);
  if (customProd) {
    return {
      id: customProd.id,
      sku: customProd.sku || generateSku(customProd.name),
      name: customProd.name,
      slug: customProd.slug,
      description: customProd.description || "",
      shortDescription: customProd.shortDescription || "",
      categoryId: customProd.categoryId || "business-printing",
      categoryName: customProd.categoryName || "Business Printing",
      categorySlug: customProd.categorySlug || "business-printing",
      status: customProd.status || "published",
      basePrice: Number(customProd.basePrice || 0),
      compareAtPrice: customProd.compareAtPrice ? Number(customProd.compareAtPrice) : null,
      costPerUnit: customProd.costPerUnit ? Number(customProd.costPerUnit) : null,
      discountPercentage: customProd.discountPercentage || 0,
      marginPercent: calculateMargin(Number(customProd.basePrice || 0), Number(customProd.costPerUnit || 0)),
      trackInventory: customProd.trackInventory ?? true,
      stockQuantity: customProd.stockQuantity ?? 100,
      lowStockThreshold: customProd.lowStockThreshold ?? 10,
      isFeatured: customProd.isFeatured || false,
      metaTitle: customProd.metaTitle || `${customProd.name} | Star Press`,
      metaDescription: customProd.metaDescription || customProd.shortDescription || "",
      metaKeywords: customProd.metaKeywords || "",
      publishedAt: customProd.createdAt || new Date().toISOString(),
      createdAt: customProd.createdAt || new Date().toISOString(),
      updatedAt: customProd.updatedAt || new Date().toISOString(),
      images: (customProd.images || []).map((img: any, i: number) => ({
        id: typeof img === "object" && img.id ? img.id : `img-${customProd.id}-${i}`,
        url: typeof img === "object" && img.url ? img.url : String(img),
        altText: `${customProd.name} Image ${i + 1}`,
        isPrimary: i === 0,
        position: i,
      })),
    } as AdminProductDto;
  }

  // Fallback to static catalog item with overrides
  const catalogProd = getAllProducts().find((p: CatalogProduct) => p.id === idOrSlug || p.slug === idOrSlug);
  if (!catalogProd) return null;

  const overrides = persistentStore.getProductOverrides();
  const override = overrides[catalogProd.id] || overrides[catalogProd.slug] || {};

  const basePrice = override.basePrice !== undefined ? Number(override.basePrice) : catalogProd.basePrice;
  const costPerUnit = override.costPerUnit !== undefined ? Number(override.costPerUnit) : Math.round(basePrice * 0.65);

  const images = override.images && Array.isArray(override.images) && override.images.length > 0
    ? override.images.map((img: any, i: number) => ({
        id: typeof img === "object" && img.id ? img.id : `img-${catalogProd.id}-${i}`,
        url: typeof img === "object" && img.url ? img.url : String(img),
        altText: `${override.name || catalogProd.name} Image ${i + 1}`,
        isPrimary: i === 0,
        position: i,
      }))
    : catalogProd.images.map((url: string, i: number) => ({
        id: `img-${catalogProd.id}-${i}`,
        url,
        altText: `${catalogProd.name} Image ${i + 1}`,
        isPrimary: i === 0,
        position: i,
      }));

  return {
    id: catalogProd.id,
    sku: override.sku || generateSku(override.name || catalogProd.name, catalogProd.categorySlug),
    name: override.name || catalogProd.name,
    slug: catalogProd.slug,
    description: override.description || catalogProd.description,
    shortDescription: override.shortDescription || catalogProd.shortDescription,
    categoryId: catalogProd.categorySlug,
    categoryName: catalogProd.categoryName,
    categorySlug: catalogProd.categorySlug,
    status: override.status || "published",
    basePrice,
    compareAtPrice: override.compareAtPrice !== undefined ? override.compareAtPrice : Math.round(basePrice * 1.25),
    costPerUnit,
    discountPercentage: 20,
    marginPercent: calculateMargin(basePrice, costPerUnit),
    trackInventory: true,
    stockQuantity: override.stockQuantity !== undefined ? Number(override.stockQuantity) : 150,
    lowStockThreshold: 15,
    isFeatured: override.isFeatured !== undefined ? override.isFeatured : catalogProd.isFeatured || false,
    metaTitle: `${override.name || catalogProd.name} | Custom Online Printing | Star Press`,
    metaDescription: override.shortDescription || catalogProd.shortDescription,
    metaKeywords: (catalogProd.tags || []).join(", "),
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: override.updatedAt || new Date().toISOString(),
    images,
  };
}

/**
 * Create a new product and log audit action
 */
export async function createAdminProduct(
  data: {
    name: string;
    sku?: string;
    slug?: string;
    description?: string;
    shortDescription?: string;
    categoryId?: string;
    basePrice: number;
    compareAtPrice?: number | null;
    costPerUnit?: number | null;
    discountPercentage?: number | null;
    trackInventory?: boolean;
    stockQuantity?: number;
    lowStockThreshold?: number;
    status?: "draft" | "published" | "archived";
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string;
    imageUrl?: string;
    isFeatured?: boolean;
    images?: Array<{ url: string; altText?: string; isPrimary?: boolean; position?: number }>;
  },
  adminEmail: string,
  ipAddress?: string
) {
  const slug = data.slug?.trim() ? slugify(data.slug) : slugify(data.name);
  const sku = data.sku?.trim() ? data.sku.trim().toUpperCase() : generateSku(data.name);

  // Find or create category in DB
  let categoryId = data.categoryId;
  if (categoryId) {
    const catById = await db.category.findUnique({ where: { id: categoryId } }).catch(() => null);
    if (!catById) {
      const catBySlug = await db.category.findFirst({
        where: { OR: [{ slug: categoryId }, { name: categoryId }] },
      }).catch(() => null);
      if (catBySlug) {
        categoryId = catBySlug.id;
      }
    }
  }
  if (!categoryId || categoryId === "general") {
    try {
      const defaultCategory = await db.category.upsert({
        where: { slug: "business-printing" },
        update: {},
        create: {
          name: "Business Printing",
          slug: "business-printing",
          description: "Corporate stationery, business cards, and essentials",
        },
      });
      categoryId = defaultCategory.id;
    } catch {
      const firstCat = await db.category.findFirst().catch(() => null);
      categoryId = firstCat?.id || "cmum543r20000xtrl67lwqlou";
    }
  }

  let createdProduct: any = null;

  try {
    createdProduct = await db.product.create({
      data: {
        name: data.name,
        slug,
        sku,
        description: data.description || "",
        shortDescription: data.shortDescription || "",
        categoryId: categoryId!,
        basePrice: data.basePrice,
        compareAtPrice: data.compareAtPrice ?? null,
        costPerUnit: data.costPerUnit ?? null,
        discountPercentage: data.discountPercentage ?? null,
        trackInventory: data.trackInventory ?? true,
        stockQuantity: data.stockQuantity ?? 100,
        lowStockThreshold: data.lowStockThreshold ?? 10,
        status: data.status || "draft",
        isFeatured: data.isFeatured ?? false,
        metaTitle: data.metaTitle || `${data.name} | Star Press`,
        metaDescription: data.metaDescription || data.shortDescription || "",
        metaKeywords: data.metaKeywords || "",
        images: data.images && data.images.length > 0
          ? {
              create: data.images.map((img, idx) => ({
                url: img.url,
                altText: img.altText || `${data.name} Image ${idx + 1}`,
                isPrimary: img.isPrimary ?? idx === 0,
                position: img.position ?? idx,
                displayOrder: idx,
              })),
            }
          : data.imageUrl
            ? {
                create: [
                  {
                    url: data.imageUrl,
                    altText: `${data.name} Primary Image`,
                    isPrimary: true,
                    position: 0,
                  },
                ],
              }
            : undefined,
      },
      include: {
        category: true,
        images: true,
      },
    });

    // Write audit log
    await db.adminAuditLog.create({
      data: {
        adminEmail,
        entityType: "product",
        entityId: createdProduct.id,
        action: "create",
        changes: {
          name: data.name,
          sku,
          price: data.basePrice,
          status: data.status || "draft",
        },
        ipAddress: ipAddress || null,
      },
    });
  } catch (err: any) {
    console.warn("[Create Product] Database error, saving to persistent store:", err?.message);
    const virtualProduct: AdminProductDto = {
      id: `prod-${Date.now()}`,
      sku,
      name: data.name,
      slug,
      description: data.description || "",
      shortDescription: data.shortDescription || "",
      categoryId: categoryId || "business-printing",
      categoryName: "Business Printing",
      categorySlug: "business-printing",
      status: data.status || "published",
      basePrice: data.basePrice,
      compareAtPrice: data.compareAtPrice,
      costPerUnit: data.costPerUnit,
      discountPercentage: data.discountPercentage || 0,
      marginPercent: calculateMargin(data.basePrice, data.costPerUnit),
      trackInventory: data.trackInventory ?? true,
      stockQuantity: data.stockQuantity ?? 100,
      lowStockThreshold: data.lowStockThreshold ?? 10,
      isFeatured: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      images: data.imageUrl
        ? [
            {
              id: `img-${Date.now()}`,
              url: data.imageUrl,
              altText: data.name,
              isPrimary: true,
              position: 0,
            },
          ]
        : [],
    };
    persistentStore.saveCustomProduct(virtualProduct);
    return {
      success: true,
      product: virtualProduct,
    };
  }

  if (createdProduct) {
    persistentStore.saveCustomProduct({
      id: createdProduct.id,
      sku: createdProduct.sku,
      name: createdProduct.name,
      slug: createdProduct.slug,
      description: createdProduct.description,
      shortDescription: createdProduct.shortDescription,
      categoryId: createdProduct.categoryId,
      categoryName: createdProduct.category?.name || "Business Printing",
      categorySlug: createdProduct.category?.slug || "business-printing",
      status: createdProduct.status,
      basePrice: Number(createdProduct.basePrice),
      compareAtPrice: createdProduct.compareAtPrice ? Number(createdProduct.compareAtPrice) : null,
      costPerUnit: createdProduct.costPerUnit ? Number(createdProduct.costPerUnit) : null,
      images: (createdProduct.images || []).map((img: any) => ({
        id: img.id,
        url: img.url,
        altText: img.altText,
        isPrimary: img.isPrimary,
        position: img.position,
      })),
      createdAt: createdProduct.createdAt.toISOString(),
      updatedAt: createdProduct.updatedAt.toISOString(),
    });
  }

  return { success: true, product: createdProduct };
}

/**
 * Update an existing product and log audit diff
 */
export async function updateAdminProduct(
  id: string,
  data: Partial<{
    name: string;
    sku: string;
    slug: string;
    description: string;
    shortDescription: string;
    categoryId: string;
    status: "draft" | "published" | "archived";
    basePrice: number;
    compareAtPrice: number | null;
    costPerUnit: number | null;
    discountPercentage: number | null;
    trackInventory: boolean;
    stockQuantity: number;
    lowStockThreshold: number;
    isFeatured: boolean;
    metaTitle: string;
    metaDescription: string;
    metaKeywords: string;
    images?: Array<{ id?: string; url: string; altText?: string; isPrimary?: boolean; position?: number }>;
  }>,
  adminEmail: string,
  ipAddress?: string
) {
  let updatedProduct: any = null;

  try {
    // 1. Locate product in DB (by CUID, by slug, or by catalog ID)
    const catalogProd = getAllProducts().find((p) => p.id === id || p.slug === id);
    const candidateSlugs = [id];
    if (id.startsWith("prod-")) {
      candidateSlugs.push(id.replace(/^prod-/, ""));
    }
    if (catalogProd) {
      candidateSlugs.push(catalogProd.slug);
    }

    let targetProduct = await db.product.findFirst({
      where: {
        OR: [
          { id },
          ...candidateSlugs.map((s) => ({ slug: s })),
          ...(catalogProd ? [{ id: catalogProd.id }] : []),
        ],
      },
      include: {
        category: true,
        images: true,
      },
    });

    // 2. Resolve categoryId if provided
    let resolvedCategoryId: string | undefined = undefined;
    if (data.categoryId) {
      const catById = await db.category.findUnique({
        where: { id: data.categoryId },
      }).catch(() => null);

      if (catById) {
        resolvedCategoryId = catById.id;
      } else {
        const catBySlug = await db.category.findFirst({
          where: {
            OR: [
              { slug: data.categoryId },
              { name: data.categoryId },
            ],
          },
        }).catch(() => null);

        if (catBySlug) {
          resolvedCategoryId = catBySlug.id;
        } else {
          const matchedCat = CATALOG_CATEGORIES.find(
            (c) => c.id === data.categoryId || c.slug === data.categoryId || c.name === data.categoryId
          );
          const catSlug = matchedCat ? matchedCat.slug : slugify(data.categoryId);
          const catName = matchedCat ? matchedCat.name : data.categoryId;

          try {
            const upsertedCat = await db.category.upsert({
              where: { slug: catSlug },
              update: {},
              create: {
                name: catName,
                slug: catSlug,
                description: catName,
              },
            });
            resolvedCategoryId = upsertedCat.id;
          } catch (catErr) {
            console.warn("[Update Product] Category upsert warning:", catErr);
          }
        }
      }
    }

    // 3. Build whitelisted Prisma Product data
    const prismaData: Record<string, any> = { updatedAt: new Date() };
    if (data.name !== undefined) prismaData.name = data.name.trim();
    if (data.slug !== undefined && data.slug.trim()) prismaData.slug = slugify(data.slug);
    if (data.sku !== undefined) prismaData.sku = data.sku.trim();
    if (data.description !== undefined) prismaData.description = data.description;
    if (data.shortDescription !== undefined) prismaData.shortDescription = data.shortDescription;
    if (resolvedCategoryId) prismaData.categoryId = resolvedCategoryId;
    if (data.status !== undefined) prismaData.status = data.status;
    if (data.isFeatured !== undefined) prismaData.isFeatured = Boolean(data.isFeatured);
    if (data.basePrice !== undefined) prismaData.basePrice = Number(data.basePrice);
    if (data.compareAtPrice !== undefined) prismaData.compareAtPrice = data.compareAtPrice !== null ? Number(data.compareAtPrice) : null;
    if (data.costPerUnit !== undefined) prismaData.costPerUnit = data.costPerUnit !== null ? Number(data.costPerUnit) : null;
    if (data.discountPercentage !== undefined) prismaData.discountPercentage = data.discountPercentage !== null ? Math.round(Number(data.discountPercentage)) : null;
    if (data.trackInventory !== undefined) prismaData.trackInventory = Boolean(data.trackInventory);
    if (data.stockQuantity !== undefined) prismaData.stockQuantity = Math.round(Number(data.stockQuantity));
    if (data.lowStockThreshold !== undefined) prismaData.lowStockThreshold = Math.round(Number(data.lowStockThreshold));
    if (data.metaTitle !== undefined) prismaData.metaTitle = data.metaTitle;
    if (data.metaDescription !== undefined) prismaData.metaDescription = data.metaDescription;
    if (data.metaKeywords !== undefined) prismaData.metaKeywords = data.metaKeywords;

    // 4. Update or Create in DB
    if (targetProduct) {
      updatedProduct = await db.product.update({
        where: { id: targetProduct.id },
        data: prismaData,
        include: {
          category: true,
          images: true,
        },
      });
      console.log(`[Update Product] Updated "${updatedProduct.name}" (${updatedProduct.id}) in database.`);
    } else {
      const fallbackCat = resolvedCategoryId || (await db.category.findFirst())?.id || "business-printing";
      const slug = prismaData.slug || slugify(prismaData.name || id);
      updatedProduct = await db.product.create({
        data: {
          name: prismaData.name || (catalogProd?.name ?? "Custom Product"),
          slug,
          sku: prismaData.sku || generateSku(prismaData.name || slug),
          description: prismaData.description || (catalogProd?.description ?? ""),
          shortDescription: prismaData.shortDescription || (catalogProd?.shortDescription ?? ""),
          categoryId: fallbackCat,
          basePrice: prismaData.basePrice ?? (catalogProd?.basePrice ?? 100),
          compareAtPrice: prismaData.compareAtPrice ?? null,
          costPerUnit: prismaData.costPerUnit ?? null,
          status: prismaData.status || "published",
          isFeatured: prismaData.isFeatured ?? false,
          trackInventory: prismaData.trackInventory ?? true,
          stockQuantity: prismaData.stockQuantity ?? 100,
          lowStockThreshold: prismaData.lowStockThreshold ?? 10,
          metaTitle: prismaData.metaTitle || null,
          metaDescription: prismaData.metaDescription || null,
          metaKeywords: prismaData.metaKeywords || null,
        },
        include: {
          category: true,
          images: true,
        },
      });
      console.log(`[Update Product] Created new product "${updatedProduct.name}" (${updatedProduct.id}) in database.`);
    }

    // 5. Handle image syncing
    const imagesToSync = data.images;
    if (Array.isArray(imagesToSync) && updatedProduct) {
      try {
        await db.productImage.deleteMany({
          where: { productId: updatedProduct.id },
        });

        if (imagesToSync.length > 0) {
          await db.productImage.createMany({
            data: imagesToSync.map((img: any, idx: number) => ({
              productId: updatedProduct.id,
              url: typeof img === "object" && img.url ? img.url : String(img),
              altText: typeof img === "object" && img.altText ? img.altText : `${updatedProduct.name} Image ${idx + 1}`,
              isPrimary: typeof img === "object" && img.isPrimary !== undefined ? img.isPrimary : idx === 0,
              position: typeof img === "object" && img.position !== undefined ? img.position : idx,
              displayOrder: idx,
            })),
          });
        }

        // Re-fetch product with newly synced images
        updatedProduct = await db.product.findUnique({
          where: { id: updatedProduct.id },
          include: {
            category: true,
            images: { orderBy: { position: "asc" } },
          },
        });
      } catch (imgErr: any) {
        console.error("[Update Product] Image sync error:", imgErr?.message);
      }
    }

    // 6. Audit log
    if (updatedProduct) {
      try {
        await db.adminAuditLog.create({
          data: {
            adminEmail,
            entityType: "product",
            entityId: updatedProduct.id,
            action: "update",
            changes: data,
            ipAddress: ipAddress || null,
          },
        });
      } catch (auditErr) {
        console.warn("[Update Product] Audit log creation warning:", auditErr);
      }
    }
  } catch (err: any) {
    console.error("[Update Product] Database update failed:", err?.message || err);
  }

  // 7. Resilient sync to persistentStore
  if (updatedProduct) {
    persistentStore.saveProductOverride(updatedProduct.id, data);
    persistentStore.saveProductOverride(updatedProduct.slug, data);
  }
  if (id !== updatedProduct?.id && id !== updatedProduct?.slug) {
    persistentStore.saveProductOverride(id, data);
  }

  const catalogProd = getAllProducts().find((p) => p.id === id || p.slug === id);

  return {
    success: !!updatedProduct,
    product: updatedProduct || {
      id,
      ...(catalogProd || {}),
      ...data,
    },
  };
}

/**
 * Delete a product and log audit action
 */
export async function deleteAdminProduct(id: string, adminEmail: string, ipAddress?: string) {
  try {
    const catalogProd = getAllProducts().find((p) => p.id === id || p.slug === id);
    const candidateSlugs = [id];
    if (id.startsWith("prod-")) candidateSlugs.push(id.replace(/^prod-/, ""));
    if (catalogProd) candidateSlugs.push(catalogProd.slug);

    const targetProduct = await db.product.findFirst({
      where: {
        OR: [
          { id },
          ...candidateSlugs.map((s) => ({ slug: s })),
          ...(catalogProd ? [{ id: catalogProd.id }] : []),
        ],
      },
    });

    if (targetProduct) {
      await db.product.delete({
        where: { id: targetProduct.id },
      });

      try {
        await db.adminAuditLog.create({
          data: {
            adminEmail,
            entityType: "product",
            entityId: targetProduct.id,
            action: "delete",
            changes: { deletedId: targetProduct.id },
            ipAddress: ipAddress || null,
          },
        });
      } catch {}
    }
  } catch (err: any) {
    console.warn("[Delete Product] DB delete bypassed:", (err as any)?.message);
  }

  persistentStore.deleteCustomProduct(id);
  persistentStore.saveProductOverride(id, { status: "archived" });

  return { success: true };
}

/**
 * Return all categories for admin category selection
 */
export async function listAdminCategories() {
  try {
    const categories = await db.category.findMany({
      orderBy: { displayOrder: "asc" },
    });
    if (categories.length > 0) {
      return categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
    }
  } catch {
    // ignore
  }

  // Fallback to CATALOG_CATEGORIES
  return CATALOG_CATEGORIES.map((c) => ({
    id: c.slug,
    name: c.name,
    slug: c.slug,
  }));
}

/**
 * Bulk update status for multiple products
 */
export async function bulkUpdateProductStatus(ids: string[], status: string) {
  try {
    const res = await db.product.updateMany({
      where: { id: { in: ids } },
      data: { status, updatedAt: new Date() },
    });
    return res.count;
  } catch {
    return ids.length;
  }
}

/**
 * Return live, dynamic catalog products merging baseline catalog with admin overrides and custom products.
 * Used by storefront (/shop, /shop/[slug], categories) so any price/image/name changes update everywhere in real-time.
 */
import { cache } from "react";

export const getLiveCatalogProducts = cache(async function getLiveCatalogProducts(): Promise<CatalogProduct[]> {
  const base = getAllProducts();
  
  let dbProducts: any[] = [];
  try {
    dbProducts = await db.product.findMany({
      where: { status: { not: "archived" } },
      include: {
        category: true,
        images: { orderBy: { position: 'asc' } }
      }
    });
  } catch (err) {
    console.warn("[Live Catalog] DB fetch error:", err);
  }

  const overrides = persistentStore.getProductOverrides();
  const custom = persistentStore.getCustomProducts();

  const dbProdMap = new Map<string, any>();
  dbProducts.forEach(p => {
    dbProdMap.set(p.slug, p);
    dbProdMap.set(p.id, p);
  });

  const mergedBase: CatalogProduct[] = base
    .map((prod) => {
      const dbMatch = dbProdMap.get(prod.slug) || dbProdMap.get(prod.id);
      
      let finalName = prod.name;
      let finalPrice = prod.basePrice;
      let finalDesc = prod.description;
      let finalShort = prod.shortDescription;
      let finalImages = prod.images;
      let finalStatus = "published";

      if (dbMatch) {
         finalStatus = dbMatch.status;
         finalName = dbMatch.name;
         finalPrice = Number(dbMatch.basePrice);
         finalDesc = dbMatch.description || prod.description;
         finalShort = dbMatch.shortDescription || prod.shortDescription;
         if (dbMatch.images && dbMatch.images.length > 0) {
           finalImages = dbMatch.images.map((img: any) => img.url);
         }
      } else {
         const override = overrides[prod.id] || overrides[prod.slug];
         if (override) {
           finalStatus = override.status || "published";
           finalName = override.name ?? prod.name;
           finalPrice = override.basePrice !== undefined ? Number(override.basePrice) : prod.basePrice;
           finalDesc = override.description ?? prod.description;
           finalShort = override.shortDescription ?? prod.shortDescription;
           if (override.images && Array.isArray(override.images) && override.images.length > 0) {
             finalImages = override.images.map((img: any) => (typeof img === "object" && img.url ? img.url : String(img)));
           }
         }
      }

      if (finalStatus === "draft" || finalStatus === "archived") return null;

      return {
        ...prod,
        id: dbMatch ? dbMatch.id : prod.id,
        name: finalName,
        basePrice: finalPrice,
        description: finalDesc,
        shortDescription: finalShort,
        images: finalImages,
      };
    })
    .filter((p): p is CatalogProduct => p !== null);

  const baseIds = new Set([...base.map(p => p.id), ...base.map(p => p.slug)]);
  
  const customFromDb: CatalogProduct[] = dbProducts
    .filter(p => !baseIds.has(p.id) && !baseIds.has(p.slug) && p.status !== "draft" && p.status !== "archived")
    .map(c => {
      const imgUrls = c.images && c.images.length > 0
        ? c.images.map((img: any) => img.url)
        : ["/images/hero-composition.jpg"];
        
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        categorySlug: c.category?.slug || c.categoryId || "business-printing",
        categoryName: c.category?.name || "Business Printing",
        basePrice: Number(c.basePrice || 0),
        rating: 4.9,
        reviewCount: 18,
        shortDescription: c.shortDescription || c.description || "",
        description: c.description || "",
        images: imgUrls,
        isFeatured: c.isFeatured || false,
        isBestSeller: false,
        tags: [c.category?.slug || "custom-print"],
        sizeOptions: [
          { id: "std", label: "Standard", multiplier: 1, default: true },
        ],
        materialOptions: [
          { id: "mat-std", label: "Premium Standard", extraPricePerUnit: 0, default: true },
        ],
        quantityTiers: [
          { quantity: 100, discountPercent: 0, default: true },
          { quantity: 250, discountPercent: 10 },
          { quantity: 500, discountPercent: 20 },
        ],
        specifications: {
          "Print Technology": "Commercial Offset & Digital Press",
          "Turnaround Time": "2-3 Business Days",
          "Shipping": "Pan-India Tracked Express",
        },
        features: [
          "Commercial grade high-resolution print output",
          "Rigid quality inspection before dispatch",
          "Safe eco-friendly premium substrates",
        ],
      } as CatalogProduct;
    });

  const dbCustomIds = new Set([...customFromDb.map(c => c.id), ...customFromDb.map(c => c.slug)]);
  
  const customCatalog: CatalogProduct[] = custom
    .filter((c) => c.status !== "draft" && c.status !== "archived" && !dbCustomIds.has(c.id) && !dbCustomIds.has(c.slug) && !baseIds.has(c.id) && !baseIds.has(c.slug))
    .map((c) => {
      const imgUrls = c.images && Array.isArray(c.images) && c.images.length > 0
        ? c.images.map((img: any) => (typeof img === "object" && img.url ? img.url : String(img)))
        : ["/images/hero-composition.jpg"];

      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        categorySlug: c.categorySlug || c.categoryId || "business-printing",
        categoryName: c.categoryName || "Business Printing",
        basePrice: Number(c.basePrice || 0),
        rating: 4.9,
        reviewCount: 18,
        shortDescription: c.shortDescription || c.description || "",
        description: c.description || "",
        images: imgUrls,
        isFeatured: c.isFeatured || false,
        isBestSeller: false,
        tags: [c.categorySlug || "custom-print"],
        sizeOptions: [
          { id: "std", label: "Standard", multiplier: 1, default: true },
        ],
        materialOptions: [
          { id: "mat-std", label: "Premium Standard", extraPricePerUnit: 0, default: true },
        ],
        quantityTiers: [
          { quantity: 100, discountPercent: 0, default: true },
          { quantity: 250, discountPercent: 10 },
          { quantity: 500, discountPercent: 20 },
        ],
        specifications: {
          "Print Technology": "Commercial Offset & Digital Press",
          "Turnaround Time": "2-3 Business Days",
          "Shipping": "Pan-India Tracked Express",
        },
        features: [
          "Commercial grade high-resolution print output",
          "Rigid quality inspection before dispatch",
          "Safe eco-friendly premium substrates",
        ],
      };
    });

  return [...customFromDb, ...customCatalog, ...mergedBase];
});

/**
 * Return live, dynamic product by slug with real-time price & image overrides applied.
 */
export async function getLiveProductBySlug(slug: string): Promise<CatalogProduct | undefined> {
  if (!slug) return undefined;
  const products = await getLiveCatalogProducts();
  const normalized = slug.toLowerCase().trim();
  const targetSlug = PRODUCT_SLUG_ALIASES[normalized] || normalized;
  return products.find((p) => p.slug === targetSlug || p.id === targetSlug);
}

/**
 * Return live products by category slug.
 */
export async function getLiveProductsByCategory(categorySlug: string): Promise<CatalogProduct[]> {
  const allLive = await getLiveCatalogProducts();
  if (!categorySlug || categorySlug === "all") return allLive;
  return allLive.filter((p) => p.categorySlug === categorySlug);
}

