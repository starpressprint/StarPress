"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  X,
  ChevronRight,
  Phone,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  User,
  LogOut,
  Package,
  MapPin,
  ArrowRight,
  Store,
  Layers,
  Boxes,
  Info,
  PhoneCall,
  Sun,
  Moon,
} from "lucide-react";
import { NAV_LINKS, WHATSAPP_NUMBER, CONTACT_PHONE } from "@/lib/data";
import Button from "@/components/ui/Button";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useTheme } from "@/context/ThemeContext";

export interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const getNavIcon = (label: string) => {
  switch (label.toLowerCase()) {
    case "shop":
      return Store;
    case "categories":
      return Layers;
    case "custom printing":
      return Sparkles;
    case "bulk orders":
      return Boxes;
    case "about":
      return Info;
    case "contact":
      return PhoneCall;
    default:
      return Sparkles;
  }
};

export default function MobileNavDrawer({
  isOpen,
  onClose,
}: MobileNavDrawerProps) {
  const pathname = usePathname();
  const { session, signOut } = useAuthSession();
  const { theme, toggleTheme } = useTheme();

  // Prevent body scroll and handle Escape key when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div
        className="fixed inset-y-0 right-0 w-[min(320px,88vw)] max-w-xs bg-bg-surface border-l border-border-subtle p-4 xs:p-6 flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-out overflow-y-auto overscroll-contain"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile Navigation"
      >
        <div>
          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-5 border-b border-border-subtle">
            <Link
              href="/"
              onClick={onClose}
              className="flex items-center group focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:outline-none rounded-full"
              aria-label="Star Press — The Printing Hub"
            >
              <Image
                src="/images/Logo.png"
                alt="Star Press - The Printing Hub"
                width={135}
                height={42}
                className="h-8 sm:h-9 w-auto object-contain"
              />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="p-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-brand-yellow min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="mt-5 flex flex-col space-y-1.5">
            {NAV_LINKS.map((link) => {
              const active =
                pathname === link.href ||
                pathname.startsWith(`${link.href}/`) ||
                pathname.startsWith(`${link.href}?`);
              const Icon = getNavIcon(link.label);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    active
                      ? "text-text-primary font-semibold bg-bg-surface-alt border border-border-subtle shadow-sm"
                      : "text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      size={17}
                      className={active ? "text-brand-yellow" : "text-text-muted"}
                    />
                    <span>{link.label}</span>
                  </div>
                  {active ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-yellow shadow-glow-yellow" />
                  ) : (
                    <ChevronRight size={15} className="text-text-muted" />
                  )}
                </Link>
              );
            })}

            <Link
              href="/cart"
              onClick={onClose}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                pathname.startsWith("/cart")
                  ? "text-text-primary font-semibold bg-bg-surface-alt border border-border-subtle shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShoppingBag
                  size={17}
                  className={pathname.startsWith("/cart") ? "text-brand-yellow" : "text-text-muted"}
                />
                <span>My Shopping Cart</span>
              </div>
              <ChevronRight size={15} className="text-text-muted" />
            </Link>

            {/* Auth / Account Links */}
            <div className="pt-3 mt-3 border-t border-border-subtle">
              {session?.user ? (
                <div className="space-y-1.5">
                  <div className="px-3.5 py-2 flex items-center gap-3 bg-bg-surface-alt border border-border-subtle rounded-2xl mb-2">
                    <div className="w-8 h-8 rounded-full bg-brand-yellow text-black font-black text-xs uppercase flex items-center justify-center">
                      {session.user.name?.[0] || session.user.email?.[0] || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-text-primary truncate">
                        {session.user.name || "Customer"}
                      </p>
                      <p className="text-[10px] text-text-muted truncate">
                        {session.user.email}
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/account?tab=orders"
                    onClick={onClose}
                    className="flex items-center justify-between px-3.5 py-2 rounded-full text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Package size={15} className="text-brand-yellow" />
                      <span>My Orders & Tracking</span>
                    </div>
                    <ChevronRight size={14} className="text-text-muted" />
                  </Link>

                  <Link
                    href="/account?tab=profile"
                    onClick={onClose}
                    className="flex items-center justify-between px-3.5 py-2 rounded-full text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <User size={15} className="text-brand-cyan" />
                      <span>Profile & Security</span>
                    </div>
                    <ChevronRight size={14} className="text-text-muted" />
                  </Link>

                  <Link
                    href="/account?tab=addresses"
                    onClick={onClose}
                    className="flex items-center justify-between px-3.5 py-2 rounded-full text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin size={15} className="text-purple-400" />
                      <span>Saved Addresses</span>
                    </div>
                    <ChevronRight size={14} className="text-text-muted" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      signOut();
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 rounded-full text-xs font-medium text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <LogOut size={15} />
                      <span>Sign Out</span>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <Link
                    href="/login"
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-full text-xs font-bold bg-brand-yellow text-black hover:bg-[#FFE04D] transition-colors shadow-md shadow-brand-yellow/10"
                  >
                    <span>Sign In</span>
                    <ArrowRight size={14} />
                  </Link>

                  <Link
                    href="/register"
                    onClick={onClose}
                    className="flex items-center justify-center w-full py-2 px-4 rounded-full text-xs font-semibold border border-border-subtle bg-bg-surface-alt text-text-primary hover:bg-border-subtle transition-colors"
                  >
                    Create Account
                  </Link>

                  <Link
                    href="/account?tab=orders"
                    onClick={onClose}
                    className="flex items-center justify-between px-3.5 py-2 text-xs text-text-muted hover:text-text-primary transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Package size={14} className="text-brand-yellow" />
                      <span>Track an Order</span>
                    </div>
                    <ChevronRight size={13} className="text-text-muted" />
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Drawer Bottom Actions: Theme Toggle, WhatsApp, Call, Quote */}
        <div className="pt-4 border-t border-border-subtle space-y-3">
          {/* Theme Switcher Toggle Row */}
          <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-bg-surface-alt border border-border-subtle">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              {theme === "dark" ? (
                <Moon size={15} className="text-amber-400" />
              ) : (
                <Sun size={15} className="text-amber-500" />
              )}
              <span>Theme</span>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-bg-surface border border-border-strong text-text-primary hover:border-brand-yellow transition-all"
            >
              <span>{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hi%20Star%20Press,%20I%20have%20an%20inquiry`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-colors"
            >
              <MessageCircle size={14} />
              <span>WhatsApp</span>
            </a>

            <a
              href={`tel:${CONTACT_PHONE.replace(/\s+/g, "")}`}
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full bg-bg-surface-alt border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-border-subtle text-xs font-bold transition-colors"
            >
              <Phone size={14} />
              <span>Call Desk</span>
            </a>
          </div>

          <Button
            variant="primary"
            size="lg"
            href="/custom-printing"
            className="w-full justify-center !py-2.5 !text-xs font-bold rounded-full shadow-lg shadow-brand-yellow/15"
            onClick={onClose}
          >
            <Sparkles size={15} />
            <span>Launch Print Studio</span>
          </Button>

          <p className="text-center text-[10px] text-text-muted">
            Pan-India Delivery • Pre-Press Verified
          </p>
        </div>
      </div>
    </div>
  );
}
