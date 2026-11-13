import { z } from "zod";
const money = z.number().finite().min(0).max(10000000);
const imageUrl = z.string().max(2048).refine(v => v.startsWith("/images/") || /^https:\/\//.test(v), "Use an HTTPS image URL or a local image path");
const fields = {
  name: z.string().trim().min(2).max(200),
  sku: z.string().trim().max(100), slug: z.string().trim().max(200),
  description: z.string().max(30000), shortDescription: z.string().max(2000),
  categoryId: z.string().max(128), status: z.enum(["draft", "published", "archived"]),
  basePrice: money, compareAtPrice: money.nullable(), costPerUnit: money.nullable(),
  discountPercentage: z.number().int().min(0).max(100).nullable(),
  trackInventory: z.boolean(), stockQuantity: z.number().int().min(0).max(10000000),
  lowStockThreshold: z.number().int().min(0).max(10000000), isFeatured: z.boolean(),
  metaTitle: z.string().max(200), metaDescription: z.string().max(1000), metaKeywords: z.string().max(1000),
  imageUrl,
  images: z.array(z.object({ id: z.string().max(128).optional(), url: imageUrl,
    altText: z.string().max(300).optional(), isPrimary: z.boolean().optional(),
    position: z.number().int().min(0).max(100).optional(),
  })).max(50),
};
export const productUpdateSchema = z.object(fields).partial();
export const productCreateSchema = productUpdateSchema.extend({ name: fields.name, basePrice: fields.basePrice });
