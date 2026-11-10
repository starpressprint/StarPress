"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense, useId } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { evaluatePassword, PASSWORD_MIN_LENGTH } from "@/lib/validation/auth";
import { supabase } from "@/lib/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";

// ---------------------------------------------------------------------------
// Inline field error — no layout shift (min-h reserves space)
// ---------------------------------------------------------------------------
function FieldError({ id, message }: { id?: string; message: string | null }) {
  return (
    <div id={id} role={message ? "alert" : undefined} aria-live="polite" className="min-h-[14px] mt-0.5">
      {message && (
        <p className="flex items-center gap-1 text-[10px] text-rose-400 font-medium leading-tight">
          <AlertCircle size={10} className="shrink-0" aria-hidden="true" />
          {message}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Authenticated Redirect Screen
// ---------------------------------------------------------------------------
function AuthenticatedRedirectScreen({ session }: { session: any }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-16">
      <div className="w-16 h-16 rounded-full bg-brand-yellow/10 border border-brand-yellow/30 flex items-center justify-center text-brand-yellow mb-6">
        <Loader2 size={32} className="animate-spin" />
      </div>
      <h2 className="font-display font-bold text-2xl text-white mb-2">
        Already Signed In
      </h2>
      <p className="text-sm text-slate-300 mb-1">
        Logged in as <span className="font-semibold text-brand-yellow">{session?.user?.name || session?.user?.email}</span>
      </p>
      <p className="text-xs text-slate-500">
        Redirecting to your account…
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Register Skeleton
// ---------------------------------------------------------------------------
function RegisterSkeleton() {
  return (
    <div className="w-full max-w-[440px] sm:max-w-[460px] rounded-[28px] sm:rounded-[32px] border border-white/10 bg-[#0A0D17]/70 backdrop-blur-xl p-5 sm:p-6 animate-pulse space-y-3">
      <div className="flex justify-between items-center">
        <div className="w-14 h-4 bg-white/10 rounded-md" />
        <div className="w-20 h-6 bg-white/10 rounded-md" />
      </div>
      <div className="w-40 h-6 bg-white/10 rounded-lg mb-1" />
      <div className="w-56 h-3 bg-white/5 rounded-md mb-2" />
      <div className="w-full h-9 bg-white/5 rounded-full" />
      <div className="w-full h-9 bg-white/5 rounded-full" />
      <div className="w-full h-9 bg-white/5 rounded-full" />
      <div className="w-full h-10 bg-brand-yellow/20 rounded-full mt-3" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Register Form (inner — uses useSearchParams, must be inside <Suspense>)
// ---------------------------------------------------------------------------
function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, status, isHydrated } = useAuthSession();
  const callbackUrl = searchParams.get("callbackUrl") || searchParams.get("redirect") || "/";

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated" && session) {
      const redirectUrl = callbackUrl || "/account";
      router.replace(redirectUrl);
    }
  }, [status, session, router, callbackUrl]);

  // Unique IDs for label association
  const nameId = useId();
  const emailId = useId();
  const phoneId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  // Field-level errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({
    name: null,
    email: null,
    phone: null,
    password: null,
    confirmPassword: null,
  });

  // General / server error (shown below CTA)
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmationSent, setIsConfirmationSent] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleResend = async () => {
    if (!formData.email.trim()) return;
    setIsResending(true);
    try {
      await supabase.auth.resend({
        type: "signup",
        email: formData.email.trim(),
        options: {
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}` : undefined,
        },
      });
      setResendSuccess(true);
    } catch {
      // safe fallback
    } finally {
      setIsResending(false);
    }
  };

  // 3D Spatial Parallax Tilt
  const cardRef = useRef<HTMLDivElement>(null);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = (e.clientX - centerX) / (rect.width / 2);
    const y = (e.clientY - centerY) / (rect.height / 2);
    setMouseOffset({
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setMouseOffset({ x: 0, y: 0 });
  }, []);

  const passwordEvaluation = evaluatePassword(formData.password);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field error as user types
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validateField = (name: string, value: string): string | null => {
    switch (name) {
      case "name":
        if (!value.trim()) return "Full name is required.";
        if (value.trim().length < 2) return "Name must be at least 2 characters.";
        return null;
      case "email":
        if (!value.trim()) return "Email address is required.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
          return "Please enter a valid email address.";
        return null;
      case "phone":
        if (!value.trim()) return null; // Optional on initial registration
        if (!/^[6-9]\d{9}$/.test(value.trim()))
          return "Enter a valid 10-digit Indian mobile number.";
        return null;
      case "password":
        if (!value) return "Password is required.";
        if (!evaluatePassword(value).isValid)
          return (
            evaluatePassword(value).errors[0] ||
            `Password must be at least ${PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, number & special character.`
          );
        return null;
      case "confirmPassword":
        if (!value) return "Please confirm your password.";
        if (value !== formData.password) return "Passwords do not match.";
        return null;
      default:
        return null;
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const error = validateField(name, value);
    setFieldErrors((prev) => ({ ...prev, [name]: error }));
  };

  // ── Submit via Supabase Auth ───────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const errors: Record<string, string | null> = {
      name: validateField("name", formData.name),
      email: validateField("email", formData.email),
      phone: validateField("phone", formData.phone),
      password: validateField("password", formData.password),
      confirmPassword: validateField("confirmPassword", formData.confirmPassword),
    };

    setFieldErrors(errors);
    const hasErrors = Object.values(errors).some(Boolean);
    if (hasErrors) return;

    setServerError(null);
    setIsLoading(true);

    try {
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}`
          : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          emailRedirectTo,
          data: {
            full_name: formData.name.trim(),
            name: formData.name.trim(),
            phone: formData.phone.trim() || undefined,
            role: "CUSTOMER",
          },
        },
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("rate limit") || msg.includes("email rate limit")) {
          setServerError(
            "Supabase built-in email rate limit exceeded (free tier permits ~3 confirmation emails/hr). To fix this instantly: open Supabase Dashboard > Authentication > Providers > Email, and toggle off 'Confirm email'."
          );
        } else {
          setServerError(error.message || "Failed to create account. Please try again.");
        }
        setIsLoading(false);
        return;
      }

      // Check if session established (instant login when email confirmation is disabled)
      if (data?.session) {
        window.location.href = callbackUrl;
        return;
      }

      // If user was created, attempt immediate sign-in in case confirm email is not enforced
      if (data?.user) {
        try {
          const { data: signInData } = await supabase.auth.signInWithPassword({
            email: formData.email.trim(),
            password: formData.password,
          });

          if (signInData?.session) {
            window.location.href = callbackUrl;
            return;
          }
        } catch {
          // Fall through to confirmation screen if confirmation is strictly required
        }
      }

      // If session is still null, Supabase requires email verification
      setIsConfirmationSent(true);
      setIsLoading(false);
    } catch {
      setServerError("Unable to connect to authentication service. Please try again.");
      setIsLoading(false);
    }
  };


  // Strength meter styles
  const strengthColors: Record<string, string> = {
    strong: "bg-emerald-400",
    good: "bg-amber-400",
    fair: "bg-yellow-500",
    weak: "bg-rose-500",
  };

  const strengthTextColors: Record<string, string> = {
    strong: "text-emerald-400",
    good: "text-amber-400",
    fair: "text-yellow-500",
    weak: "text-rose-400",
  };

  // ── Shared input className factory ────────────────────────────────────────
  const inputCls = (hasError: boolean) =>
    `w-full bg-bg-surface-alt border rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs text-text-primary
     placeholder:text-text-muted transition-all duration-200 backdrop-blur-md
     focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-yellow
     focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:border-brand-yellow
     hover:border-border-strong
     ${hasError ? "border-rose-500/60 bg-rose-500/[0.04]" : "border-border-subtle"}`;

  if (!isHydrated) {
    return <RegisterSkeleton />;
  }

  if (status === "authenticated") {
    return <AuthenticatedRedirectScreen session={session} />;
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      className="relative w-full max-w-[440px] sm:max-w-[460px] transition-transform duration-200 ease-out will-change-transform"
      style={{
        transform: isHovered
          ? `perspective(1000px) rotateX(${-mouseOffset.y * 3}deg) rotateY(${mouseOffset.x * 3}deg) translateY(-2px)`
          : "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)",
      }}
    >
      {/* Outer Glow Halo reacting to cursor */}
      <div
        className="pointer-events-none absolute -inset-1.5 rounded-[36px] bg-gradient-to-tr from-brand-yellow/25 via-white/10 to-brand-cyan/25 blur-xl opacity-60 transition-opacity duration-500"
        style={{
          transform: `translate(${mouseOffset.x * 6}px, ${mouseOffset.y * 6}px)`,
        }}
      />

      {/* Main Spatial Glassmorphism Window Panel */}
      <div className="relative rounded-[28px] sm:rounded-[32px] border border-border-subtle bg-bg-surface/90 dark:bg-[#090D1A]/70 backdrop-blur-2xl sm:backdrop-blur-3xl p-5 sm:p-6 shadow-2xl overflow-hidden">
        {/* Spatial light rims & glass specular highlights */}
        <div className="pointer-events-none absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/40 dark:via-white/60 to-transparent" />
        <div className="pointer-events-none absolute -left-px top-8 bottom-8 w-px bg-gradient-to-b from-white/20 via-transparent to-transparent" />
        <div className="pointer-events-none absolute -right-px top-8 bottom-8 w-px bg-gradient-to-b from-brand-yellow/30 via-transparent to-transparent" />
        <div className="pointer-events-none absolute top-0 right-0 w-36 h-36 bg-brand-yellow/[0.08] rounded-full blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 w-36 h-36 bg-brand-cyan/[0.08] rounded-full blur-2xl" />

        {/* Top Header Row with Back link & Star Press Hallmark Logo */}
        <div className="flex items-center justify-between mb-2 relative z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-xs font-medium py-1 px-2.5 rounded-lg bg-bg-surface-alt hover:bg-bg-surface border border-border-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
            aria-label="Back to homepage"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            <span>Back</span>
          </Link>
          <div className="relative h-6 w-24">
            <Image
              src="/images/Logo.png"
              alt="Star Press"
              fill
              sizes="96px"
              priority
              className="object-contain drop-shadow-[0_0_12px_rgba(245,186,19,0.35)]"
            />
          </div>
        </div>

        {/* Heading */}
        <div className="mb-2 relative z-10">
          <h1 className="font-display font-black text-xl sm:text-2xl text-text-primary tracking-tight leading-tight mb-0.5">
            Create <span className="text-brand-yellow">Account</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-text-secondary">
            Already have an account?{" "}
            <Link
              href={`/login${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
              className="text-brand-yellow font-semibold hover:underline
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow rounded-sm"
            >
              Sign In
            </Link>
          </p>
        </div>



        {isConfirmationSent ? (
          <div className="text-center py-6 px-2 relative z-10 space-y-3.5">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.35)]">
              <CheckCircle2 size={28} />
            </div>
            <h2 className="font-display font-black text-xl text-text-primary">Check Your Inbox</h2>
            <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
              We&apos;ve sent a verification link to <span className="text-brand-yellow font-semibold">{formData.email}</span>. Click the link in your email to confirm your account and start ordering.
            </p>
            {resendSuccess && (
              <div className="p-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-xs">
                Verification link resent! Please check your spam or inbox.
              </div>
            )}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending || resendSuccess}
                className="py-2.5 px-4 rounded-full bg-bg-surface-alt hover:bg-bg-surface border border-border-subtle text-text-primary text-xs font-semibold transition-all disabled:opacity-50"
              >
                {isResending ? "Resending…" : resendSuccess ? "Link Resent" : "Resend Link"}
              </button>
              <Link
                href={`/login?registered=1&email=${encodeURIComponent(formData.email)}`}
                className="py-2.5 px-4 rounded-full bg-brand-yellow hover:bg-[#FFE04D] text-black text-xs font-bold transition-all text-center"
              >
                Proceed to Sign In
              </Link>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} noValidate className="space-y-1 relative z-10">
            {/* Full Name */}
            <div>
              <label htmlFor={nameId} className="block text-[10px] sm:text-[11px] font-semibold text-text-secondary tracking-wide mb-0.5">
                Full Name
              </label>
            <input
              id={nameId}
              type="text"
              name="name"
              autoComplete="name"
              required
              value={formData.name}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="Rohan Sharma"
              aria-describedby={fieldErrors.name ? `${nameId}-error` : undefined}
              aria-invalid={!!fieldErrors.name}
              className={inputCls(!!fieldErrors.name)}
            />
            <FieldError id={`${nameId}-error`} message={fieldErrors.name} />
          </div>

          {/* Email */}
          <div>
            <label htmlFor={emailId} className="block text-[10px] sm:text-[11px] font-semibold text-text-secondary tracking-wide mb-0.5">
              Email Address
            </label>
            <input
              id={emailId}
              type="email"
              name="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="rohan@company.in"
              aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
              aria-invalid={!!fieldErrors.email}
              className={inputCls(!!fieldErrors.email)}
            />
            <FieldError id={`${emailId}-error`} message={fieldErrors.email} />
          </div>

          {/* Mobile */}
          <div>
            <label htmlFor={phoneId} className="block text-[10px] sm:text-[11px] font-semibold text-text-secondary tracking-wide mb-0.5">
              Mobile Number{" "}
              <span className="text-text-muted font-normal text-[9px]">(WhatsApp proofs &amp; AWB)</span>
            </label>
            <input
              id={phoneId}
              type="tel"
              name="phone"
              autoComplete="tel"
              required
              value={formData.phone}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="9876543210"
              aria-describedby={fieldErrors.phone ? `${phoneId}-error` : undefined}
              aria-invalid={!!fieldErrors.phone}
              className={inputCls(!!fieldErrors.phone)}
            />
            <FieldError id={`${phoneId}-error`} message={fieldErrors.phone} />
          </div>

          {/* Password */}
          <div>
            <label htmlFor={passwordId} className="block text-[10px] sm:text-[11px] font-semibold text-text-secondary tracking-wide mb-0.5">
              Password
            </label>
            <div className="relative">
              <input
                id={passwordId}
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Minimum 12 characters"
                aria-describedby={fieldErrors.password ? `${passwordId}-error` : `${passwordId}-hint`}
                aria-invalid={!!fieldErrors.password}
                className={`${inputCls(!!fieldErrors.password)} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors p-1
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow rounded-full"
              >
                {showPassword ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
              </button>
            </div>

            {/* Password strength meter */}
            {formData.password && (
              <div id={`${passwordId}-hint`} className="pt-1 space-y-1">
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-text-muted">Strength:</span>
                  <span className={`font-semibold capitalize ${strengthTextColors[passwordEvaluation.strength] ?? "text-text-muted"}`}>
                    {passwordEvaluation.strength}
                  </span>
                </div>
                {/* 4-segment bar */}
                <div className="grid grid-cols-4 gap-1 h-1" aria-hidden="true">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`rounded-full transition-all duration-300 ${
                        passwordEvaluation.score >= step
                          ? (strengthColors[passwordEvaluation.strength] ?? "bg-slate-500")
                          : "bg-border-subtle"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
            <FieldError id={`${passwordId}-error`} message={fieldErrors.password} />
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor={confirmPasswordId} className="block text-[10px] sm:text-[11px] font-semibold text-text-secondary tracking-wide mb-0.5">
              Confirm Password
            </label>
            <input
              id={confirmPasswordId}
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
              autoComplete="new-password"
              required
              value={formData.confirmPassword}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="Re-enter password"
              aria-describedby={fieldErrors.confirmPassword ? `${confirmPasswordId}-error` : undefined}
              aria-invalid={!!fieldErrors.confirmPassword}
              className={inputCls(!!fieldErrors.confirmPassword)}
            />
            <FieldError id={`${confirmPasswordId}-error`} message={fieldErrors.confirmPassword} />
          </div>

          {/* Server error */}
          {serverError && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2 p-2 rounded-xl border border-rose-500/30
                bg-rose-500/15 text-rose-300 text-xs mt-1 backdrop-blur-md"
            >
              <AlertCircle size={13} className="shrink-0 mt-0.5 text-rose-400" aria-hidden="true" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Primary CTA */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full !mt-2 relative group overflow-hidden rounded-full py-2 sm:py-2.5 px-6
              font-display font-extrabold text-xs sm:text-sm uppercase tracking-wider text-black
              bg-brand-yellow hover:bg-[#FFE04D]
              shadow-[0_4px_20px_rgba(245,186,19,0.35)] hover:shadow-[0_6px_28px_rgba(245,186,19,0.50)]
              active:translate-y-0.5 active:scale-[0.99] transition-all duration-200
              flex items-center justify-center gap-2 cursor-pointer
              disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow
              focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0C10]"
            aria-busy={isLoading}
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent
                -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none"
            />
            {isLoading ? (
              <span className="flex items-center gap-2 relative z-10">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                <span>Creating Account…</span>
              </span>
            ) : (
              <span className="relative z-10 font-black tracking-wide">Create Star Press Account</span>
            )}
          </button>
        </form>
        )}

        {/* Security badge */}
        <div className="mt-2 flex items-center justify-center gap-1.5 text-[9px] sm:text-[10px] text-slate-400/90 font-medium relative z-10">
          <ShieldCheck size={12} className="text-emerald-400 shrink-0" aria-hidden="true" />
          <span>Your data and artworks are strictly confidential</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page shell — Spatial Glassmorphism & Full Background Image
// ---------------------------------------------------------------------------
export default function RegisterPage() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-y-auto overflow-x-hidden py-8 sm:py-12 selection:bg-brand-yellow selection:text-black">
      {/* Full-bleed Star Press workspace background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <Image
          src="/images/auth-press-bg.jpg"
          alt="Star Press Studio"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
          quality={95}
        />
        {/* Subtle ambient film grain / light contrast touch keeping image 100% visible */}
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Spatial Glassmorphism Auth Window */}
      <div className="relative z-10 w-full flex items-center justify-center">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
              <Loader2 size={28} className="animate-spin text-brand-yellow" />
              <p className="text-xs tracking-wider uppercase font-mono">Loading Star Press…</p>
            </div>
          }
        >
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
