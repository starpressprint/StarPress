import { z } from "zod";

const sanitizeUrl = (val?: string) => {
  if (!val || val.trim() === "") return undefined;
  let trimmed = val.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
};

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().optional().default("http://localhost:3000"),
  DATABASE_URL: z
    .string()
    .optional()
    .or(z.literal("")),
  NEXTAUTH_SECRET: z.string().optional().default("development-secret-key-32-chars-min"),
  NEXTAUTH_URL: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim() === "") {
        return process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";
      }
      return sanitizeUrl(val) || "http://localhost:3000";
    })
    .default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  NOTIFICATION_EMAIL: z.string().optional().default("starpress.print@gmail.com"),
  OWNER_ALERT_EMAIL: z.string().optional().default("starpress.print@gmail.com"),
  CRON_SECRET: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  ORDER_PAYMENT_WINDOW_MINUTES: z.coerce.number().optional().default(60),
});

const rawValues = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  NOTIFICATION_EMAIL: process.env.NOTIFICATION_EMAIL,
  OWNER_ALERT_EMAIL: process.env.OWNER_ALERT_EMAIL,
  CRON_SECRET: process.env.CRON_SECRET,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
  ORDER_PAYMENT_WINDOW_MINUTES: process.env.ORDER_PAYMENT_WINDOW_MINUTES,
};

const parsed = envSchema.safeParse(rawValues);

if (!parsed.success) {
  console.warn("⚠️ Environment variables validation notice:", parsed.error.format());
}

export const env = parsed.success
  ? parsed.data
  : {
      NODE_ENV: (process.env.NODE_ENV as "development" | "test" | "production") || "development",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      DATABASE_URL: process.env.DATABASE_URL || "",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "development-secret-key-32-chars-min",
      NEXTAUTH_URL:
        sanitizeUrl(process.env.NEXTAUTH_URL) ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      NOTIFICATION_EMAIL: process.env.NOTIFICATION_EMAIL || "starpress.print@gmail.com",
      OWNER_ALERT_EMAIL: process.env.OWNER_ALERT_EMAIL || "starpress.print@gmail.com",
      CRON_SECRET: process.env.CRON_SECRET,
      ORDER_PAYMENT_WINDOW_MINUTES: Number(process.env.ORDER_PAYMENT_WINDOW_MINUTES || 60),
    };
