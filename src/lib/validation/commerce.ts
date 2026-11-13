import { z } from "zod";

const shortText = z.string().trim().max(200);
export const quoteInputSchema = z.object({
  items: z.array(z.object({
    productId: shortText.optional(),
    slug: shortText.optional(),
    productSlug: shortText.optional(),
    quantity: z.number().int().positive().max(1000000),
    sizeId: shortText.optional(),
    materialId: shortText.optional(),
    customText: z.string().max(5000).optional(),
    artworkUrl: z.string().max(2048).optional(),
    previewUrl: z.string().max(2048).optional(),
  }).refine(item => Boolean(item.productId || item.slug || item.productSlug), "Product is required."))
    .min(1).max(100),
  couponCode: z.string().trim().max(80).optional(),
  shippingMethod: z.enum(["standard", "rush", "express"]).optional(),
});

export const orderInputSchema = quoteInputSchema.extend({
  shippingAddress: z.object({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(10).max(20),
    email: z.string().email().max(254),
    companyName: shortText.optional(),
    addressLine1: z.string().trim().min(1).max(300),
    addressLine2: z.string().max(300).optional(),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    pincode: z.string().regex(/^[1-9][0-9]{5}$/),
  }),
  billingAddress: z.object({
    companyName: shortText.optional(), gstin: z.string().max(15).optional(),
    addressLine1: z.string().max(300).optional(), city: shortText.optional(),
    state: shortText.optional(), pincode: z.string().max(6).optional(),
  }).optional(),
  paymentMethod: z.string().max(30).optional(),
  notes: z.string().max(5000).optional(),
  idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(),
  guestPhone: z.string().max(20).optional(),
});
