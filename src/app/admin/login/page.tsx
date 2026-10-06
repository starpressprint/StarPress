"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  ExternalLink,
  Package,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { isUserAdmin } from "@/lib/admin/is-admin";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, status, isHydrated, isAdmin } = useAuthSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  // If already authenticated as an Admin, redirect immediately
  useEffect(() => {
    if (isHydrated && status === "authenticated" && isAdmin) {
      const callback = searchParams.get("callbackUrl") || "/admin/dashboard";
      router.replace(callback);
    }
  }, [isHydrated, status, isAdmin, router, searchParams]);

  // Handle client-side brute-force lockout countdown
  useEffect(() => {
    if (lockoutTimer <= 0) return;
    const timer = setInterval(() => {
      setLockoutTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutTimer]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (lockoutTimer > 0) {
      setErrorMessage(`Too many failed attempts. Please wait ${lockoutTimer}s before trying again.`);
      return;
    }

    if (!email.trim() || !password) {
      setErrorMessage("Please provide both administrator email and password.");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);

        if (nextAttempts >= 5) {
          setLockoutTimer(60);
          setErrorMessage("Rate limit exceeded: 5 failed attempts. Locked for 60 seconds.");
        } else {
          setErrorMessage(
            error.message.includes("Invalid login credentials")
              ? `Invalid admin credentials. (${5 - nextAttempts} attempts remaining)`
              : error.message
          );
        }
        return;
      }

      if (!data.user) {
        setErrorMessage("Authentication failed: No user returned.");
        return;
      }

      // Cryptographically verify administrative role
      const isAuthorized = isUserAdmin(data.user);

      if (!isAuthorized) {
        // Immediate session revocation for unauthorized accounts
        await supabase.auth.signOut();
        setErrorMessage(
          "Access Denied: This account lacks administrative clearance. Contact Security Operations if this is an error."
        );
        return;
      }

      // Reset attempts on successful authentication
      setAttempts(0);

      // Successfully authenticated as administrator
      const callbackUrl = searchParams.get("callbackUrl") || "/admin/dashboard";
      router.push(callbackUrl);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred during administrative verification.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAdminLogin = async () => {
    setErrorMessage(null);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const target = searchParams.get("callbackUrl") || "/admin/dashboard";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(target)}`,
        },
      });
      if (error) {
        setErrorMessage(error.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Google OAuth initialization failed.");
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-[#07090E]">
      {/* Background Graphic Asset */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none select-none">
        <Image
          src="/images/auth-press-bg.png"
          alt="Star Press Operations"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center filter brightness-50"
        />
      </div>

      {/* Subtle Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-yellow/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glassmorphic Container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Security Classification Pill */}
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-mono tracking-wider uppercase text-emerald-400 font-semibold">
              SSL / AES-256 Encrypted Gateway
            </span>
          </div>

          <a
            href={process.env.NEXT_PUBLIC_APP_URL || "https://starpress.in"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-brand-yellow transition-colors"
          >
            <span>Customer Store</span>
            <ExternalLink size={10} />
          </a>
        </div>

        {/* Spatial Window */}
        <div className="rounded-3xl border border-white/10 bg-[#0B0F19]/80 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_24px_70px_rgba(0,0,0,0.8)]">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-brand-yellow/15 border border-brand-yellow/30 flex items-center justify-center text-brand-yellow shadow-[0_0_24px_rgba(255,224,77,0.2)] mb-4">
              <Lock size={26} />
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-yellow/10 border border-brand-yellow/30 text-[10px] font-mono font-bold tracking-widest text-brand-yellow uppercase mb-2">
              <ShieldCheck size={11} />
              Operations Gateway
            </div>

            <h1 className="font-display font-black text-2xl text-white tracking-wide">
              STAR<span className="text-brand-yellow">PRESS</span> ADMIN
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Restricted management console for authorized operations staff.
            </p>
          </div>

          {/* Error / Alert Display */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn"
            >
              <ShieldAlert size={16} className="shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Administrator Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail size={16} />
                </div>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  autoComplete="username"
                  disabled={isLoading || lockoutTimer > 0}
                  className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/50 rounded-xl text-xs text-white placeholder:text-slate-600 outline-none transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="admin-password"
                  className="text-xs font-semibold text-slate-300"
                >
                  Security Key / Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock size={16} />
                </div>
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  disabled={isLoading || lockoutTimer > 0}
                  className="w-full pl-10 pr-10 py-2.5 bg-black/40 border border-white/10 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/50 rounded-xl text-xs text-white placeholder:text-slate-600 outline-none transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || lockoutTimer > 0}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-brand-yellow hover:bg-[#FFE04D] text-black text-xs font-bold tracking-wider uppercase transition-all shadow-[0_4px_20px_rgba(255,224,77,0.25)] hover:shadow-[0_4px_24px_rgba(255,224,77,0.4)] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifying Credentials…</span>
                </>
              ) : lockoutTimer > 0 ? (
                <span>Locked ({lockoutTimer}s)</span>
              ) : (
                <>
                  <span>Access Operations Console</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <span className="relative px-3 bg-[#0B0F19] text-[10px] uppercase font-mono tracking-widest text-slate-500">
              Enterprise SSO
            </span>
          </div>

          {/* Google Workspace SSO */}
          <button
            type="button"
            onClick={handleGoogleAdminLogin}
            disabled={isLoading || lockoutTimer > 0}
            className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-xs font-semibold text-slate-200 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google Admin Workspace</span>
          </button>

          {/* Security Notice Footer */}
          <div className="mt-6 pt-4 border-t border-white/5 text-center">
            <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
              Unauthorized access attempts are audited and logged with IP telemetry.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#07090E] text-white">
          <Loader2 size={32} className="animate-spin text-brand-yellow" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
