export interface PricingOptions {
  sizeId?: string;
  materialId?: string;
  quantity: number;
  customText?: string;
}

export interface PriceBreakdown {
  basePrice: number;
  unitPrice: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  customizationFee: number;
  totalPrice: number;
  savings: number;
  formattedTotalPrice: string;
  formattedUnitPrice: string;
  estimatedTurnaroundDays: number;
}

export interface CatalogProductPricingConfig {
  basePrice: number;
  pricingModel?: "batch" | "unit";
  baseQuantity?: number;
  sizeOptions: Array<{
    id: string;
    label: string;
    multiplier: number;
    default?: boolean;
  }>;
  materialOptions: Array<{
    id: string;
    label: string;
    extraPricePerUnit: number;
    default?: boolean;
  }>;
  quantityTiers: Array<{
    quantity: number;
    discountPercent: number;
    default?: boolean;
  }>;
  customizationRules?: {
    hasCustomText?: boolean;
    textPricePerChar?: number;
    freeCharLimit?: number;
  };
}

/**
 * Calculates dynamic price based on PRD §6 business rules:
 * - For batch products (cards, flyers, brochures, stickers, stationery): basePrice is for starter batch (default tier qty, e.g. 100 pcs).
 * - For unit products (mugs, t-shirts, canvas prints, banners): basePrice is per individual item.
 */
export function calculateProductPrice(
  config: CatalogProductPricingConfig,
  options: PricingOptions
): PriceBreakdown {
  const {
    basePrice,
    sizeOptions,
    materialOptions,
    quantityTiers,
    customizationRules,
    pricingModel,
    baseQuantity,
  } = config;
  const quantity = Math.max(1, options.quantity);

  // 1. Determine size multiplier
  const selectedSize =
    sizeOptions.find((s) => s.id === options.sizeId) ||
    sizeOptions.find((s) => s.default) ||
    sizeOptions[0] || { multiplier: 1 };
  const sizeMultiplier = selectedSize.multiplier || 1;

  // 2. Determine material extra cost
  const selectedMaterial =
    materialOptions.find((m) => m.id === options.materialId) ||
    materialOptions.find((m) => m.default) ||
    materialOptions[0] || { extraPricePerUnit: 0 };
  const materialExtra = selectedMaterial.extraPricePerUnit || 0;

  // 3. Determine base unit rate and pricing model
  // Default tier quantity for starter pack
  const defaultTier =
    quantityTiers.find((t) => t.default) || quantityTiers[0] || { quantity: 1 };
  const isBatch =
    pricingModel === "batch" ||
    (pricingModel !== "unit" && defaultTier.quantity >= 10);
  const effectiveBaseQty = baseQuantity || (isBatch ? defaultTier.quantity : 1);

  // 4. Quantity evaluation:
  // If batch product and quantity is below effectiveBaseQty (e.g. 1, 2, 3 packs),
  // then quantity represents the number of starter packs/batches ordered.
  const isPackCount = isBatch && quantity < effectiveBaseQty;

  let rawUnitPrice: number;
  let discountedUnitPrice: number;
  let roundedUnitPrice: number;
  let discountPercent = 0;
  let undiscountedSubtotal: number;
  let finalSubtotal: number;

  if (isPackCount) {
    // Each pack consists of effectiveBaseQty units
    const packBasePrice = basePrice * sizeMultiplier + materialExtra * effectiveBaseQty;
    // Check if bulk pack discounts apply based on equivalent pieces
    const equivalentUnits = quantity * effectiveBaseQty;
    const sortedTiers = [...quantityTiers].sort((a, b) => b.quantity - a.quantity);
    const matchedTier = sortedTiers.find((tier) => equivalentUnits >= tier.quantity);
    discountPercent = matchedTier ? matchedTier.discountPercent : 0;

    rawUnitPrice = packBasePrice;
    discountedUnitPrice = rawUnitPrice * (1 - discountPercent / 100);
    roundedUnitPrice = Math.round(discountedUnitPrice * 100) / 100;
    undiscountedSubtotal = Math.round(rawUnitPrice * quantity);
    finalSubtotal = Math.round(discountedUnitPrice * quantity);
  } else {
    // Individual piece / standard unit calculation
    const baseUnitRate = isBatch ? basePrice / effectiveBaseQty : basePrice;
    rawUnitPrice = baseUnitRate * sizeMultiplier + materialExtra;

    const sortedTiers = [...quantityTiers].sort((a, b) => b.quantity - a.quantity);
    const matchedTier = sortedTiers.find((tier) => quantity >= tier.quantity);
    discountPercent = matchedTier ? matchedTier.discountPercent : 0;

    discountedUnitPrice = rawUnitPrice * (1 - discountPercent / 100);
    roundedUnitPrice = Math.round(discountedUnitPrice * 100) / 100;
    undiscountedSubtotal = Math.round(rawUnitPrice * quantity);
    finalSubtotal = Math.round(discountedUnitPrice * quantity);
  }

  // 6. Customization fee for engraved/personalized text length
  let customizationFee = 0;
  if (customizationRules?.hasCustomText && options.customText) {
    const freeChars = customizationRules.freeCharLimit ?? 20;
    const ratePerChar = customizationRules.textPricePerChar ?? 2;
    const billableChars = Math.max(0, options.customText.trim().length - freeChars);
    customizationFee = billableChars * ratePerChar;
  }

  // 7. Subtotal & total
  const discountAmount = Math.max(0, undiscountedSubtotal - finalSubtotal);
  const totalPrice = finalSubtotal + customizationFee;

  // 8. Estimated turnaround based on volume
  let estimatedTurnaroundDays = 2;
  if (quantity >= 5000) {
    estimatedTurnaroundDays = 5;
  } else if (quantity >= 1000) {
    estimatedTurnaroundDays = 3;
  }

  return {
    basePrice,
    unitPrice: roundedUnitPrice,
    subtotal: finalSubtotal,
    discountPercent,
    discountAmount,
    customizationFee,
    totalPrice,
    savings: discountAmount,
    formattedTotalPrice: formatINR(totalPrice),
    formattedUnitPrice: formatINR(roundedUnitPrice),
    estimatedTurnaroundDays,
  };
}

/**
 * Formats a number to Indian Rupee currency standard: e.g. 1299 -> "₹1,299" or 2.99 -> "₹2.99"
 */
export function formatINR(amount: number): string {
  const isFractional = amount > 0 && amount < 10 && Math.floor(amount) !== amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: isFractional ? 2 : 0,
    minimumFractionDigits: isFractional ? 2 : 0,
  }).format(amount);
}
