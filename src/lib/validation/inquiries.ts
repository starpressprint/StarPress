import { z } from "zod";
const name = z.string().trim().min(2).max(100);
const phone = z.string().trim().regex(/^\+?[\d ()-]{7,20}$/);
const email = z.string().trim().max(254).email();
const optionalText = (max: number) => z.string().trim().max(max).optional();
export const contactInquirySchema = z.object({
  name, email: z.union([email, z.literal("")]).optional(),
  phone: z.union([phone, z.literal("")]).optional(),
  subject: optionalText(200), message: z.string().trim().min(1).max(5000),
});
export const bulkInquirySchema = z.object({
  name, phone, email: z.union([email, z.literal("")]).optional(),
  company: optionalText(200), productType: optionalText(200), quantity: optionalText(100),
  details: optionalText(5000), swatchKitRequested: z.boolean().optional(),
});
export const customInquirySchema = z.object({
  name, phone, email, productType: z.string().trim().min(1).max(200),
  quantity: optionalText(100), finishDetails: optionalText(2000), details: optionalText(5000),
  fileUrl: z.union([z.string().max(2048).url().refine(v => v.startsWith("https://")), z.literal("")]).optional(),
});
