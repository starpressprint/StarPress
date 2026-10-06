import { db } from "../lib/db";
import { calculateProductPrice, PriceBreakdown } from "../lib/pricing";
import { getProductBySlug, CATALOG_PRODUCTS, CatalogProduct } from "../lib/catalog";

export interface QuoteItemInput {
  productId?: string;
  slug?: string;
  productSlug?: string;
  quantity: number;
  sizeId?: string;
  materialId?: string;
  customText?: string;
  artworkUrl?: string;
  previewUrl?: string;
}

export interface QuoteOrderInput {
  items: QuoteItemInput[];
  couponCode?: string;
  shippingMethod?: "standard" | "rush" | "express";
}

export interface QuoteLineSnapshot {
  productId: string | null;
  productName: string;
  productSlug: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  specs: {
    sizeId?: string;
    sizeLabel?: string;
    materialId?: string;
    materialLabel?: string;
    customText?: string;
    artworkUrl?: string;
    previewUrl?: string;
    unitPrice: number;
    subtotal: number;
    discountPercent?: number;
    pricingModel?: "batch" | "unit";
    estimatedTurnaroundDays?: number;
    [key: string]: any;
  };
  customText?: string;
  artworkUrl?: string;
  previewUrl?: string;
  requiresArtwork: boolean;
}

export interface CouponDiscountResult {
  code: string;
  type: string;
  value: number;
  discountAmount: number;
}

export interface QuoteOrderResult {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  gst: number;
  shipping: number;
  standardShippingFee: number;
  rushFee: number;
  grandTotal: number;
  subtotalPaise: number;
  grandTotalPaise: number;
  couponApplied?: CouponDiscountResult;
  lineSnapshots: QuoteLineSnapshot[];
}

export const FREE_SHIPPING_THRESHOLD = 999;
export const STANDARD_SHIPPING_FEE = 99;
export const RUSH_SHIPPING_FEE = 249;
export const GST_RATE = 0.18;

/**
 * Resolves a product configuration from DB (if published) or catalog fallbacks.
 */
export async function resolveProductConfig(
  identifier: {
    productId?: string;
    slug?: string;
  },
  client: typeof db = db
): Promise<{
  productName: string;
  productSlug: string;
  productId: string | null;
  config: CatalogProduct;
  requiresArtwork: boolean;
}> {
  const { productId, slug } = identifier;
  const lookupSlug = slug?.toLowerCase().trim();

  // 1. Try DB first
  let dbProduct: any = null;
  try {
    if (productId || lookupSlug) {
      dbProduct = await client.product.findFirst({
        where: {
          OR: [
            ...(productId ? [{ id: productId }] : []),
            ...(lookupSlug ? [{ slug: lookupSlug }] : []),
          ],
        },
      });
    }
  } catch {
    // DB offline or unreachable, will fall back to static catalog
  }

  if (dbProduct) {
    // If DB product is inactive or unpublished, reject
    const isPublished =
      dbProduct.status === "published" ||
      dbProduct.status === "active" ||
      (dbProduct.isActive && dbProduct.status !== "archived" && dbProduct.status !== "draft");

    if (!isPublished) {
      const err = new Error(`Product "${dbProduct.name}" is currently unavailable or unpublished.`);
      (err as any).statusCode = 400;
      throw err;
    }
  }

  // 2. Resolve catalog definition for pricing parameters (sizeOptions, materialOptions, tiers)
  const targetSlug = dbProduct?.slug || lookupSlug;
  let catalogItem = targetSlug ? getProductBySlug(targetSlug) : undefined;

  if (!catalogItem && productId) {
    catalogItem = CATALOG_PRODUCTS.find((p) => p.id === productId);
  }

  if (!catalogItem && dbProduct) {
    // Build fallback catalog definition from DB product
    catalogItem = {
      id: dbProduct.id,
      slug: dbProduct.slug,
      name: dbProduct.name,
      categorySlug: "custom",
      categoryName: "Custom Printing",
      shortDescription: dbProduct.shortDescription || "",
      description: dbProduct.description || "",
      basePrice: Number(dbProduct.basePrice || 199),
      rating: 5,
      reviewCount: 1,
      images: [],
      tags: [],
      sizeOptions: [{ id: "std", label: "Standard", multiplier: 1, default: true }],
      materialOptions: [{ id: "std", label: "Standard", extraPricePerUnit: 0, default: true }],
      quantityTiers: [{ quantity: 1, discountPercent: 0, default: true }],
      specifications: {},
      features: [],
      pricingModel: "unit",
      baseQuantity: 1,
    };
  }

  if (!catalogItem) {
    const err = new Error(`Product not found for "${productId || slug}".`);
    (err as any).statusCode = 400;
    throw err;
  }

  const requiresArtwork = Boolean(
    catalogItem.customizationRules?.hasFileUpload ||
    catalogItem.categorySlug === "business-printing" ||
    catalogItem.categorySlug === "marketing-materials" ||
    catalogItem.categorySlug === "labels-stickers"
  );

  return {
    productName: dbProduct?.name || catalogItem.name,
    productSlug: catalogItem.slug,
    productId: dbProduct?.id || identifier.productId || catalogItem.id || null,
    config: catalogItem,
    requiresArtwork,
  };
}

/**
 * Validates a coupon code without mutating database state.
 */
export async function validateCouponForQuote(
  code: string,
  subtotal: number
): Promise<CouponDiscountResult | null> {
  const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, "");
  if (!normalizedCode) return null;

  // 1. Check DB first
  try {
    const discount = await db.discount.findUnique({
      where: { code: normalizedCode },
    });

    if (discount) {
      if (!discount.isActive) {
        const err = new Error(`Coupon "${discount.code}" is disabled.`);
        (err as any).statusCode = 400;
        throw err;
      }

      const now = new Date();
      if (discount.startsAt && new Date(discount.startsAt) > now) {
        const err = new Error(`Coupon "${discount.code}" promotion has not started yet.`);
        (err as any).statusCode = 400;
        throw err;
      }

      if (discount.expiresAt && new Date(discount.expiresAt) < now) {
        const err = new Error(`Coupon "${discount.code}" has expired.`);
        (err as any).statusCode = 400;
        throw err;
      }

      if (discount.maxUses && discount.usedCount >= discount.maxUses) {
        const err = new Error(`Coupon "${discount.code}" has reached its maximum usage limit.`);
        (err as any).statusCode = 400;
        throw err;
      }

      const minAmount = discount.minOrderAmount ? Number(discount.minOrderAmount) : 0;
      if (minAmount > 0 && subtotal < minAmount) {
        const err = new Error(`Minimum order amount of ₹${minAmount} required to use coupon "${discount.code}".`);
        (err as any).statusCode = 400;
        throw err;
      }

      const val = Number(discount.value);
      const discountAmount =
        discount.type === "percentage"
          ? Math.round((subtotal * val) / 100)
          : Math.min(val, subtotal);

      return {
        code: discount.code,
        type: discount.type,
        value: val,
        discountAmount,
      };
    }
  } catch (error: any) {
    if (error?.statusCode === 400) throw error;
    // Fall back to built-in coupons if DB is offline
  }

  // 2. Built-in promotional coupons fallback
  if (normalizedCode === "STAR10") {
    const discountAmount = Math.round((subtotal * 10) / 100);
    return {
      code: "STAR10",
      type: "percentage",
      value: 10,
      discountAmount,
    };
  }

  if (normalizedCode === "PRESS20") {
    if (subtotal < 1500) {
      const err = new Error("Code PRESS20 requires a minimum order amount of ₹1,500.");
      (err as any).statusCode = 400;
      throw err;
    }
    const discountAmount = Math.round((subtotal * 20) / 100);
    return {
      code: "PRESS20",
      type: "percentage",
      value: 20,
      discountAmount,
    };
  }

  const err = new Error(`Invalid discount code "${code}".`);
  (err as any).statusCode = 400;
  throw err;
}

/**
 * Authoritative server-side price calculator for orders.
 * Single source of truth for checkout preview and order creation.
 */
export async function quoteOrder(
  input: QuoteOrderInput,
  client: typeof db = db
): Promise<QuoteOrderResult> {
  if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
    const err = new Error("At least one line item is required for a quote.");
    (err as any).statusCode = 400;
    throw err;
  }

  const lineSnapshots: QuoteLineSnapshot[] = [];
  let subtotal = 0;

  for (const item of input.items) {
    const quantity = Math.floor(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      const err = new Error(`Quantity must be a positive integer greater than zero. Received: ${item.quantity}`);
      (err as any).statusCode = 400;
      throw err;
    }

    const { productName, productSlug, productId, config, requiresArtwork } =
      await resolveProductConfig(
        {
          productId: item.productId,
          slug: item.slug || item.productSlug,
        },
        client
      );

    const priceBreakdown: PriceBreakdown = calculateProductPrice(config, {
      sizeId: item.sizeId,
      materialId: item.materialId,
      quantity,
      customText: item.customText,
    });

    const selectedSize = config.sizeOptions.find((s) => s.id === item.sizeId);
    const selectedMaterial = config.materialOptions.find((m) => m.id === item.materialId);

    const lineTotal = priceBreakdown.totalPrice;
    subtotal += lineTotal;

    lineSnapshots.push({
      productId,
      productName,
      productSlug,
      quantity,
      unitPrice: priceBreakdown.unitPrice,
      lineTotal,
      specs: {
        sizeId: item.sizeId || selectedSize?.id,
        sizeLabel: selectedSize?.label || "Standard",
        materialId: item.materialId || selectedMaterial?.id,
        materialLabel: selectedMaterial?.label || "Standard",
        customText: item.customText?.trim() || undefined,
        artworkUrl: item.artworkUrl || undefined,
        previewUrl: item.previewUrl || config.images[0] || undefined,
        unitPrice: priceBreakdown.unitPrice,
        subtotal: priceBreakdown.subtotal,
        discountPercent: priceBreakdown.discountPercent,
        pricingModel: config.pricingModel,
        estimatedTurnaroundDays: priceBreakdown.estimatedTurnaroundDays,
      },
      customText: item.customText?.trim() || undefined,
      artworkUrl: item.artworkUrl || undefined,
      previewUrl: item.previewUrl || config.images[0] || undefined,
      requiresArtwork,
    });
  }

  // Discount calculation
  let couponApplied: CouponDiscountResult | undefined = undefined;
  let discountAmount = 0;

  if (input.couponCode?.trim()) {
    const res = await validateCouponForQuote(input.couponCode, subtotal);
    if (res) {
      couponApplied = res;
      discountAmount = res.discountAmount;
    }
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount);

  // Shipping calculation
  const isFreeStandardShipping = taxableAmount >= FREE_SHIPPING_THRESHOLD;
  const standardShippingFee =
    taxableAmount > 0 && !isFreeStandardShipping ? STANDARD_SHIPPING_FEE : 0;

  const isRush = input.shippingMethod === "rush" || input.shippingMethod === "express";
  const rushFee = isRush ? RUSH_SHIPPING_FEE : 0;
  const shipping = standardShippingFee + rushFee;

  // 18% GST on taxable print goods
  const gst = Math.round(taxableAmount * GST_RATE);
  const grandTotal = taxableAmount + gst + shipping;

  return {
    subtotal,
    discount: discountAmount,
    taxableAmount,
    gst,
    shipping,
    standardShippingFee,
    rushFee,
    grandTotal,
    subtotalPaise: Math.round(subtotal * 100),
    grandTotalPaise: Math.round(grandTotal * 100),
    couponApplied,
    lineSnapshots,
  };
}
