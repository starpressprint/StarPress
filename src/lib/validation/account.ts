import { z } from "zod";

const phone = z.string().trim().max(20).regex(/^\+?[\d ()-]{7,20}$/, "Enter a valid phone number");
export const addressSchema = z.object({
  label: z.string().trim().max(80).optional(),
  line1: z.string().trim().min(1).max(250),
  line2: z.string().trim().max(250).nullable().optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit Indian PIN code"),
  phone,
  isDefault: z.boolean().optional(),
});
export const addressUpdateSchema = addressSchema.extend({ id: z.string().min(1).max(128) });
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.union([phone, z.literal(""), z.null()]).optional(),
  currentPassword: z.string().min(1).max(256).optional(),
  newPassword: z.string().min(1).max(72).optional(),
}).refine(value => Object.values(value).some(v => v !== undefined), "No profile changes supplied");
