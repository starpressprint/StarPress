"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense, useId } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ArrowLeft,
  Loader2,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";

// ---------------------------------------------------------------------------
// Inline field error component — no layout shift, reserved space via min-h
// ---------------------------------------------------------------------------
function FieldError({ message }: { message: string | null }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="min-h-[18px] mt-1"
    >
      {message && (
        <p className="flex items-center gap-1 text-[11px] text-rose-400 font-medium leading-tight">
          <AlertCircle size={11} className="shrink-0" aria-hidden="true" />
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
        Welcome back, <span className="font-semibold text-brand-yellow">{session?.user?.name || session?.user?.email}</span>
      </p>
      <p className="text-xs text-slate-500">
        Redirecting to homepage…
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login Form Skeleton
// ---------------------------------------------------------------------------
function LoginSkeleton() {
  return (
    <div className="w-full max-w-[440px] sm:max-w-[460px] rounded-[28px] sm:rounded-[32px] border border-white/10 bg-[#0A0D17]/70 backdrop-blur-xl p-6 sm:p-8 animate-pulse space-y-4">
      <div className="flex justify-between items-center">
        <div className="w-14 h-4 bg-white/10 rounded-md" />
        <div className="w-20 h-6 bg-white/10 rounded-md" />
      </div>
      <div className="w-40 h-7 bg-white/10 rounded-lg mb-1" />
      <div className="w-56 h-3.5 bg-white/5 rounded-md mb-4" />
      <div className="w-full h-10 bg-white/5 rounded-full" />
      <div className="w-full h-10 bg-white/5 rounded-full" />
      <div className="w-full h-11 bg-brand-yellow/20 rounded-full mt-4" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login Form (inner — uses useSearchParams, must be inside <Suspense>)
// ---------------------------------------------------------------------------
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, status, isHydrated, signInWithGoogle } = useAuthSession();
  const callbackUrl = searchParams.get("callbackUrl") || searchParams.get("redirect") || "/";
  const registered = searchParams.get("registered");
  const errorParam = searchParams.get("error");

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated" && session) {
      router.replace(callbackUrl);
    }
  }, [status, session, router, callbackUrl]);

  // Unique IDs for accessible label association
  const emailId = useId();
  const passwordId = useId();

  const emailParam = searchParams.get("email") || "";
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Field-level errors (shown on blur or submit)
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // General / server error (shown below CTA)
  const [serverError, setServerError] = useState<string | null>(
    errorParam === "AccessDenied"
      ? "You do not have administrator permissions to access that area."
      : errorParam === "OAuthCallbackError"
      ? "Unable to complete Google verification. Please try again."
      : null
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleResendConfirmation = async () => {
    if (!email.trim()) return;
    setIsResendingEmail(true);
    try {
      await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}` : undefined,
        },
      });
      setResendSuccess(true);
    } catch {
      // safe fallback
    } finally {
      setIsResendingEmail(false);
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

  // ── Validation helpers ────────────────────────────────────────────────────
  const validateEmail = (value: string): string | null => {
    if (!value.trim()) return "Email address is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
      return "Please enter a valid email address.";
    return null;
  };

  const validatePassword = (value: string): string | null => {
    if (!value) return "Password is required.";
    return null;
  };

  // ── Blur handlers ─────────────────────────────────────────────────────────
  const handleEmailBlur = () => setEmailError(validateEmail(email));
  const handlePasswordBlur = () => setPasswordError(validatePassword(password));

  // ── Submit via Supabase Auth ───────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    setServerError(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setIsLoading(false);
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("email not confirmed") || (error as any).code === "email_not_confirmed") {
          setServerError("EMAIL_NOT_CONFIRMED");
        } else {
          setServerError(error.message || "Invalid email or password.");
        }
        return;
      }

      if (data?.user) {
        window.location.href = callbackUrl;
      }
    } catch {
      setServerError("Unable to connect to authentication service. Please try again.");
      setIsLoading(false);
    }
  };

  // ── Google OAuth Submit ───────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setServerError(null);
    const { error } = await signInWithGoogle(callbackUrl);
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("unsupported provider") || msg.includes("not enabled")) {
        setServerError("GOOGLE_PROVIDER_DISABLED");
      } else {
        setServerError(error.message);
      }
      setIsGoogleLoading(false);
    }
  };

  if (!isHydrated) {
    return <LoginSkeleton />;
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
      <div className="relative rounded-[28px] sm:rounded-[32px] border border-border-subtle bg-bg-surface/90 dark:bg-[#090D1A]/70 backdrop-blur-2xl sm:backdrop-blur-3xl p-6 sm:p-7 shadow-2xl overflow-hidden">
        {/* Spatial light rims & glass specular highlights */}
        <div className="pointer-events-none absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/40 dark:via-white/60 to-transparent" />
        <div className="pointer-events-none absolute -left-px top-8 bottom-8 w-px bg-gradient-to-b from-white/20 via-transparent to-transparent" />
        <div className="pointer-events-none absolute -right-px top-8 bottom-8 w-px bg-gradient-to-b from-brand-yellow/30 via-transparent to-transparent" />
        <div className="pointer-events-none absolute top-0 right-0 w-36 h-36 bg-brand-yellow/[0.08] rounded-full blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 w-36 h-36 bg-brand-cyan/[0.08] rounded-full blur-2xl" />

        {/* Top Header Row with Back link & Star Press Hallmark Logo */}
        <div className="flex items-center justify-between mb-3.5 relative z-10">
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
        <div className="mb-3 relative z-10">
          <h1 className="font-display font-black text-2xl sm:text-3xl text-text-primary tracking-tight leading-tight mb-0.5">
            Welcome <span className="text-brand-yellow">Back</span>
          </h1>
          <p className="text-xs text-text-secondary">
            Don&apos;t have an account?{" "}
            <Link
              href={`/register${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
              className="text-brand-yellow font-semibold hover:underline
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow rounded-sm"
            >
              Create an Account
            </Link>
          </p>
        </div>


        {/* Registration success banner */}
        {registered && (
          <div
            role="status"
            className="mb-2.5 flex items-start gap-2 p-2 sm:p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-xs backdrop-blur-md relative z-10"
          >
            <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-500" aria-hidden="true" />
            <span>Account created successfully! Please sign in with your credentials.</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading || isLoading}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-full
            bg-bg-surface-alt hover:bg-bg-surface border border-border-subtle hover:border-border-strong
            text-text-primary text-xs sm:text-sm font-semibold transition-all duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow
            disabled:opacity-60 disabled:cursor-not-allowed mb-2.5 shadow-sm group relative z-10 backdrop-blur-md"
        >
          {isGoogleLoading ? (
            <Loader2 size={16} className="animate-spin text-brand-yellow" />
          ) : (
            <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          )}
          <span>{isGoogleLoading ? "Connecting to Google…" : "Continue with Google"}</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-2.5 relative z-10">
          <div className="flex-1 h-px bg-border-subtle" />
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold font-mono">
            or continue with email
          </span>
          <div className="flex-1 h-px bg-border-subtle" />
        </div>

        {/* Direct Email & Password Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-2 relative z-10">
          {/* Email */}
          <div>
            <label
              htmlFor={emailId}
              className="block text-[11px] font-semibold text-text-secondary tracking-wide mb-1"
            >
              Email Address
            </label>
            <input
              id={emailId}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null); }}
              onBlur={handleEmailBlur}
              placeholder="name@company.com"
              aria-describedby={emailError ? `${emailId}-error` : undefined}
              aria-invalid={!!emailError}
              className={`w-full bg-bg-surface-alt border rounded-full px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-text-primary
                placeholder:text-text-muted transition-all duration-200 backdrop-blur-md
                focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-yellow
                focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:border-brand-yellow
                hover:border-border-strong
                ${emailError ? "border-rose-500/60 bg-rose-500/[0.04]" : "border-border-subtle"}`}
            />
            <div id={`${emailId}-error`}>
              <FieldError message={emailError} />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor={passwordId}
                className="block text-[11px] font-semibold text-text-secondary tracking-wide"
              >
                Password
              </label>
              <Link
                href="/contact?topic=PasswordReset"
                className="text-[10px] sm:text-[11px] font-medium text-brand-yellow hover:underline transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow rounded-sm"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <input
                id={passwordId}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(null); }}
                onBlur={handlePasswordBlur}
                placeholder="••••••••••••"
                aria-describedby={passwordError ? `${passwordId}-error` : undefined}
                aria-invalid={!!passwordError}
                className={`w-full bg-bg-surface-alt border rounded-full px-4 pr-11 py-2 sm:py-2.5 text-xs sm:text-sm text-text-primary
                  placeholder:text-text-muted transition-all duration-200 backdrop-blur-md
                  focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-yellow
                  focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:border-brand-yellow
                  hover:border-border-strong
                  ${passwordError ? "border-rose-500/60 bg-rose-500/[0.04]" : "border-border-subtle"}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors p-1
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow rounded-full"
              >
                {showPassword ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
              </button>
            </div>
            <div id={`${passwordId}-error`}>
              <FieldError message={passwordError} />
            </div>
          </div>

          {/* Server / general error */}
          {serverError && (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-1"
            >
              {serverError === "EMAIL_NOT_CONFIRMED" ? (
                <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-200 text-xs backdrop-blur-md space-y-1.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-amber-300 text-[11px]">Email Verification Required</p>
                      <p className="text-[10px] text-amber-200/90 leading-relaxed mt-0.5">
                        Your account has not been activated yet. Please click the verification link in your inbox.
                      </p>
                    </div>
                  </div>
                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={isResendingEmail || resendSuccess}
                      className="text-[10px] font-bold text-brand-yellow hover:underline cursor-pointer disabled:opacity-50"
                    >
                      {isResendingEmail ? "Sending link…" : resendSuccess ? "Verification link sent!" : "Resend Verification Link"}
                    </button>
                  </div>
                </div>
              ) : serverError === "GOOGLE_PROVIDER_DISABLED" ? (
                <div className="p-2.5 rounded-xl border border-brand-yellow/30 bg-brand-yellow/10 text-amber-200 text-xs backdrop-blur-md space-y-1">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5 text-brand-yellow" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-brand-yellow text-[11px]">Google OAuth Needs Activation</p>
                      <p className="text-[10px] text-slate-300 leading-relaxed mt-0.5">
                        Google provider is not enabled in your Supabase project dashboard yet. Turn it ON under <strong className="text-white">Authentication &gt; Providers &gt; Google</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-2 rounded-xl border border-rose-500/30 bg-rose-500/15 text-rose-300 text-xs backdrop-blur-md">
                  <AlertCircle size={13} className="shrink-0 mt-0.5 text-rose-400" aria-hidden="true" />
                  <span>{serverError}</span>
                </div>
              )}
            </div>
          )}

          {/* Primary CTA */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full !mt-3 relative group overflow-hidden rounded-full py-2.5 sm:py-3 px-6
              font-display font-extrabold text-xs sm:text-sm uppercase tracking-wider text-black
              bg-brand-yellow hover:bg-[#FFE04D]
              shadow-[0_4px_24px_rgba(245,186,19,0.35)] hover:shadow-[0_6px_32px_rgba(245,186,19,0.50)]
              active:translate-y-0.5 active:scale-[0.99] transition-all duration-200
              flex items-center justify-center gap-2 cursor-pointer
              disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow
              focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0C10]"
            aria-busy={isLoading}
          >
            {/* Shimmer on hover */}
            <span
              aria-hidden="true"
              className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent
                -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none"
            />
            {isLoading ? (
              <span className="flex items-center gap-2 relative z-10">
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                <span>Signing In…</span>
              </span>
            ) : (
              <span className="relative z-10 font-black tracking-wide">Sign In to Star Press</span>
            )}
          </button>
        </form>

        {/* Security badge */}
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400/90 font-medium relative z-10">
          <ShieldCheck size={13} className="text-emerald-400 shrink-0" aria-hidden="true" />
          <span>256-bit encrypted secure session</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page shell — Spatial Glassmorphism & Full Background Image
// ---------------------------------------------------------------------------
export default function LoginPage() {
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
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
