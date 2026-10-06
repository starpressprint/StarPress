"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  ExternalLink,
  LogOut,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";

interface AdminHeaderProps {
  activeSection?: "orders" | "products" | "inquiries" | "analytics";
}

export default function AdminHeader({ activeSection = "orders" }: AdminHeaderProps) {
  const router = useRouter();
  const { session, signOut } = useAuthSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push("/admin/login");
      router.refresh();
    } catch {
      window.location.href = "/admin/login";
    } finally {
      setIsSigningOut(false);
    }
  };

  const userEmail = session?.user?.email || "admin@example.com";
  const userRole = session?.user?.role || "OPERATIONS";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#07090E]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Identity */}
          <div className="flex items-center gap-4">
            <Link
              href="/admin/orders"
              className="flex items-center gap-2.5 group focus:outline-none"
            >
              <div className="w-9 h-9 rounded-xl bg-brand-yellow/15 border border-brand-yellow/30 flex items-center justify-center text-brand-yellow shadow-[0_0_16px_rgba(255,224,77,0.15)] group-hover:scale-105 transition-transform">
                <Package size={20} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-display font-black text-sm text-white tracking-wider">
                    STAR<span className="text-brand-yellow">PRESS</span>
                  </span>
                  <span className="text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded bg-brand-yellow/10 border border-brand-yellow/30 text-brand-yellow font-bold">
                    ADMIN
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono tracking-wider">
                  OPERATIONS CONSOLE
                </span>
              </div>
            </Link>

            {/* Live System Indicator */}
            <div className="hidden md:flex items-center gap-2 pl-4 border-l border-white/10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-mono text-emerald-400 font-medium">
                Live Fulfillment
              </span>
            </div>
          </div>

          {/* Quick Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1.5">
            <Link
              href="/admin/orders"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSection === "orders"
                  ? "bg-white/10 text-white border border-white/15 shadow-inner"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Orders & Dispatch
            </Link>
            <Link
              href="/admin/products"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSection === "products"
                  ? "bg-white/10 text-white border border-white/15 shadow-inner"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Product Catalog
            </Link>
            <Link
              href="/admin/products/new"
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-brand-yellow bg-brand-yellow/10 hover:bg-brand-yellow/20 border border-brand-yellow/30 transition-all flex items-center gap-1"
            >
              <span>+ New Product</span>
            </Link>
            <a
              href="https://wa.me/919999999999?text=StarPress%20Operations%20Support"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1"
            >
              <HelpCircle size={13} />
              Support
            </a>
          </nav>

          {/* User Status, Public Store Link & Sign Out */}
          <div className="flex items-center gap-3">
            {/* View Public Storefront */}
            <a
              href={process.env.NEXT_PUBLIC_APP_URL || "/"}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-yellow font-medium transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10"
              title="Open Public Customer Store in a new tab"
            >
              <span>Public Store</span>
              <ExternalLink size={12} />
            </a>

            {/* User Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
              <div className="w-6 h-6 rounded-full bg-brand-yellow/20 border border-brand-yellow/40 flex items-center justify-center text-brand-yellow font-bold text-[11px]">
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-medium text-white max-w-[140px] truncate">
                  {userEmail}
                </span>
                <span className="text-[9px] font-mono uppercase text-brand-yellow tracking-wider font-semibold">
                  {userRole}
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
              title="Sign Out of Operations Console"
            >
              {isSigningOut ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <LogOut size={14} />
              )}
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
