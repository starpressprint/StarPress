"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import {
  ChevronDown,
  Search,
  ShoppingBag,
  Menu,
  User,
  Package,
  MapPin,
  Settings,
  LogOut,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";
import { NAV_LINKS } from "@/lib/data";
import Button from "@/components/ui/Button";
import MobileNavDrawer from "./MobileNavDrawer";
import { useCart } from "@/context/CartContext";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useTheme } from "@/context/ThemeContext";

export interface HeaderProps {
  cartCount?: number;
}

interface MenuItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  description: string;
  divider?: boolean;
  highlight?: boolean;
}

let clientAnnouncementCache: { text: string; isActive: boolean; color: string } | null = null;

export default function Header({ cartCount: propCartCount }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme, isMounted } = useTheme();
  const { session, status, isHydrated, signOut: authSignOut } = useAuthSession();
  const { totalCount: dynamicCartCount } = useCart();
  const cartCount = propCartCount !== undefined ? propCartCount : dynamicCartCount;

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isShopHovered, setIsShopHovered] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  const isHome = pathname === "/";
  const [announcement, setAnnouncement] = useState<{ text: string; isActive: boolean; color: string } | null>(
    () => clientAnnouncementCache
  );

  useEffect(() => {
    if (clientAnnouncementCache) {
      return;
    }
    fetch("/api/announcement")
      .then((res) => res.json())
      .then((data) => {
        if (data?.announcement?.isActive && data.announcement.text) {
          clientAnnouncementCache = data.announcement;
          setAnnouncement(data.announcement);
        }
      })
      .catch(() => {});
  }, []);

  // Profile dropdown state
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSearchOpen(false);
        setIsShopHovered(false);
        setIsProfileOpen(false);
        profileTriggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node) &&
        profileTriggerRef.current &&
        !profileTriggerRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }

      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };

    if (isProfileOpen || isSearchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isProfileOpen, isSearchOpen]);

  // Track scroll state and active section
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      if (pathname === "/") {
        const sectionIds = ["shop", "categories", "custom-printing", "bulk-orders", "about", "contact"];
        const scrollPosition = window.scrollY + 180;
        let matched = "";

        for (const id of sectionIds) {
          const el = document.getElementById(id);
          if (el) {
            const top = el.offsetTop;
            const height = el.offsetHeight;
            if (scrollPosition >= top && scrollPosition < top + height) {
              matched = id;
              break;
            }
          }
        }

        if (matched) {
          setActiveSection(matched);
        } else if (window.scrollY < 240) {
          setActiveSection("");
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  const isLinkActive = (href: string) => {
    if (pathname === "/") {
      const sectionName = href.replace("/", "");
      return activeSection === sectionName;
    }
    return pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith(`${href}?`);
  };

  const handleMenuItemClick = (href: string) => {
    setIsProfileOpen(false);
    router.push(href);
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await authSignOut();
    } catch (error) {
      console.error("[Header] Sign out error:", error);
      setIsSigningOut(false);
    }
  };

  const getUserInitial = (): string => {
    const name = session?.user?.name || session?.user?.email || "";
    return name.charAt(0).toUpperCase() || "U";
  };

  const featuredCategories = [
    { name: "Business Stationery", slug: "business-printing", desc: "Cards, Letterheads, Envelopes" },
    { name: "Marketing & Promo", slug: "marketing-materials", desc: "Flyers, Brochures, Booklets" },
    { name: "Large Format Signage", slug: "outdoor-advertising", desc: "Banners, Standees, Vinyls" },
    { name: "Custom Stickers", slug: "labels-stickers", desc: "Die-Cut, Holographic, Roll" },
    { name: "Corporate Merchandise", slug: "photo-custom-printing", desc: "Mugs, Pens, Diaries, Kits" },
    { name: "Custom Packaging", slug: "packaging", desc: "Boxes, Poly Mailers, Tape" },
  ];

  const authenticatedMenuItems: MenuItem[] = [
    {
      label: "My Orders & Tracking",
      href: "/account?tab=orders",
      icon: <Package size={17} className="text-brand-yellow shrink-0" />,
      description: "View order history & live shipment status",
    },
    {
      label: "Profile & Security",
      href: "/account?tab=profile",
      icon: <User size={17} className="text-brand-cyan shrink-0" />,
      description: "Update personal details & password",
    },
    {
      label: "Saved Delivery Addresses",
      href: "/account?tab=addresses",
      icon: <MapPin size={17} className="text-purple-400 shrink-0" />,
      description: "Manage shipping & billing locations",
    },
    {
      label: "Account Settings",
      href: "/account?tab=profile",
      icon: <Settings size={17} className="text-slate-400 shrink-0" />,
      description: "Notification & account preferences",
    },
  ];

  return (
    <>
      <header
        className={`w-full z-40 transition-all duration-300 ${
          isHome
            ? `fixed top-0 inset-x-0 ${
                isScrolled
                  ? "bg-white/90 dark:bg-[#0A0A0F]/85 backdrop-blur-xl border-b border-border-subtle shadow-md dark:shadow-lg"
                  : "bg-transparent border-b border-transparent"
              }`
            : "sticky top-0 bg-bg-base/90 backdrop-blur-md border-b border-border-subtle"
        }`}
      >
        {announcement && announcement.isActive && announcement.text && (
          <div
            className={`w-full py-1.5 px-4 text-center text-[11px] sm:text-xs font-bold tracking-wide transition-colors ${
              announcement.color === "emerald"
                ? "bg-emerald-600 text-white"
                : announcement.color === "crimson"
                ? "bg-rose-600 text-white"
                : announcement.color === "navy"
                ? "bg-blue-600 text-white"
                : "bg-[#F5A623] text-black"
            }`}
          >
            {announcement.text}
          </div>
        )}
        <div className="max-w-[1440px] mx-auto px-4 xs:px-6 lg:px-8 h-16 sm:h-[68px] flex items-center justify-between gap-3 sm:gap-4">
          
          {/* Far Left: StarPress Logo (Outside Pill) */}
          <Link
            href="/"
            className="flex items-center group shrink-0 focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:outline-none rounded-lg"
            aria-label="Star Press — The Printing Hub"
          >
            <Image
              src="/images/Logo.png"
              alt="Star Press - The Printing Hub"
              width={140}
              height={42}
              priority
              className="h-8 sm:h-9 w-auto object-contain group-hover:scale-[1.02] transition-transform duration-200 drop-shadow-sm"
            />
          </Link>

          {/* Center: Sleek Minimal Floating Nav Pill */}
          <nav
            className="hidden lg:flex items-center gap-0.5 xl:gap-1 px-2.5 py-1 rounded-full bg-white/85 dark:bg-[#12131A]/85 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
            aria-label="Main navigation"
          >
            {NAV_LINKS.map((link) => {
              const active = isLinkActive(link.href);

              if (link.hasDropdown) {
                return (
                  <div
                    key={link.href}
                    className="relative"
                    onMouseEnter={() => setIsShopHovered(true)}
                    onMouseLeave={() => setIsShopHovered(false)}
                  >
                    <Link
                      href={link.href}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs xl:text-[13px] font-medium whitespace-nowrap shrink-0 transition-all duration-200 ${
                        active
                          ? "bg-slate-900 text-white dark:bg-white/10 dark:text-white font-semibold border border-slate-800 dark:border-white/10 shadow-sm"
                          : "text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                    >
                      <span>{link.label}</span>
                      <ChevronDown
                        size={12}
                        className={`text-text-muted transition-transform duration-200 ${
                          isShopHovered ? "rotate-180 text-brand-yellow" : ""
                        }`}
                      />
                    </Link>

                    {/* Shop Megamenu Popover */}
                    {isShopHovered && (
                      <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2.5 w-[420px] z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-4 shadow-2xl space-y-3">
                          <div className="flex items-center justify-between px-2 pb-2 border-b border-border-subtle">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                              Popular Categories
                            </span>
                            <Link
                              href="/categories"
                              onClick={() => setIsShopHovered(false)}
                              className="text-xs text-brand-yellow hover:underline font-semibold"
                            >
                              All 8 Categories →
                            </Link>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {featuredCategories.map((cat) => (
                              <Link
                                key={cat.slug}
                                href={`/shop?category=${cat.slug}`}
                                onClick={() => setIsShopHovered(false)}
                                className="p-2.5 rounded-xl hover:bg-bg-surface-alt border border-transparent hover:border-border-subtle transition-all group/item"
                              >
                                <div className="text-xs font-bold text-text-primary group-hover/item:text-brand-yellow transition-colors line-clamp-1">
                                  {cat.name}
                                </div>
                                <div className="text-[10px] text-text-muted line-clamp-1 mt-0.5">
                                  {cat.desc}
                                </div>
                              </Link>
                            ))}
                          </div>

                          <div className="pt-2 border-t border-border-subtle flex items-center justify-between px-2 text-xs">
                            <Link
                              href="/custom-printing"
                              onClick={() => setIsShopHovered(false)}
                              className="text-brand-cyan hover:underline font-semibold"
                            >
                              Custom Printing Studio
                            </Link>
                            <Link
                              href="/bulk-orders"
                              onClick={() => setIsShopHovered(false)}
                              className="text-text-secondary hover:text-text-primary"
                            >
                              Bulk B2B Rates
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center px-3 py-1.5 rounded-full text-xs xl:text-[13px] font-medium whitespace-nowrap shrink-0 transition-all duration-200 ${
                    active
                      ? "bg-slate-900 text-white dark:bg-white/10 dark:text-white font-semibold border border-slate-800 dark:border-white/10 shadow-sm"
                      : "text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Far Right: Search, Theme Toggle, Cart, Profile/Auth, Get a Quote (Outside Pill) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Search Icon Button */}
            <div className="relative" ref={searchContainerRef}>
              <button
                type="button"
                onClick={() => setIsSearchOpen((prev) => !prev)}
                aria-label="Search products"
                className="p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus-visible:ring-2 focus-visible:ring-brand-yellow min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <Search size={19} />
              </button>

              {/* Quick Search Popover */}
              {isSearchOpen && (
                <div className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] bg-bg-surface border border-border-subtle rounded-xl p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (searchQuery.trim()) {
                        router.push(
                          `/shop?search=${encodeURIComponent(searchQuery.trim())}`
                        );
                      }
                      setIsSearchOpen(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Search cards, banners, mugs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                      autoComplete="off"
                      className="w-full bg-bg-surface-alt border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-yellow"
                    />
                    <Button variant="primary" size="sm" type="submit">
                      Go
                    </Button>
                  </form>
                </div>
              )}
            </div>

            {/* Light/Dark Mode Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus-visible:ring-2 focus-visible:ring-brand-yellow min-h-[40px] min-w-[40px] flex items-center justify-center relative group"
            >
              {isMounted ? (
                theme === "dark" ? (
                  <Sun size={19} className="text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
                ) : (
                  <Moon size={19} className="text-slate-700 group-hover:-rotate-12 transition-transform duration-300" />
                )
              ) : (
                <div className="w-5 h-5 rounded-full bg-border-subtle animate-pulse" />
              )}
            </button>

            {/* Cart Icon Button with Badge */}
            <Link
              href="/cart"
              aria-label={`Cart with ${cartCount} items`}
              className="relative p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus-visible:ring-2 focus-visible:ring-brand-yellow min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-brand-magenta text-white font-black text-[10px] min-w-[17px] h-[17px] rounded-full flex items-center justify-center shadow-md animate-in zoom-in">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* User Profile / Auth Button */}
            <div className="relative">
              {!isHydrated || status === "loading" ? (
                <div
                  className="w-9 h-9 rounded-full bg-white/5 border border-border-subtle animate-pulse"
                  aria-hidden="true"
                />
              ) : status === "authenticated" && session?.user ? (
                <button
                  ref={profileTriggerRef}
                  type="button"
                  onClick={() => setIsProfileOpen((prev) => !prev)}
                  aria-label={`User menu for ${session.user.name || session.user.email}`}
                  aria-haspopup="menu"
                  aria-expanded={isProfileOpen}
                  className="flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 border border-transparent hover:border-border-subtle transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all shadow-sm bg-brand-yellow text-black">
                      {getUserInitial()}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-bg-base bg-emerald-400" />
                  </div>

                  <span className="hidden xl:inline-block text-xs font-semibold text-text-primary max-w-[85px] truncate">
                    {session.user.name?.split(" ")[0] || "Account"}
                  </span>

                  <ChevronDown
                    size={14}
                    className={`text-slate-400 transition-transform duration-200 ${
                      isProfileOpen ? "rotate-180 text-brand-yellow" : ""
                    }`}
                  />
                </button>
              ) : (
                <button
                  ref={profileTriggerRef}
                  type="button"
                  onClick={() => setIsProfileOpen((prev) => !prev)}
                  aria-label="Sign In or Register"
                  aria-haspopup="menu"
                  aria-expanded={isProfileOpen}
                  className="flex items-center gap-1 p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus-visible:ring-2 focus-visible:ring-brand-yellow min-h-[40px] min-w-[40px] justify-center"
                >
                  <User size={20} />
                  <ChevronDown
                    size={13}
                    className={`text-slate-500 transition-transform duration-200 ${
                      isProfileOpen ? "rotate-180 text-brand-yellow" : ""
                    }`}
                  />
                </button>
              )}

              {/* Profile Dropdown Menu Popover */}
              {isProfileOpen && (
                <div
                  ref={profileDropdownRef}
                  role="menu"
                  aria-label="User Account Menu"
                  className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] bg-bg-surface border border-border-subtle rounded-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-150 overflow-hidden"
                >
                  {status === "authenticated" && session?.user ? (
                    <div>
                      {/* Identity Header */}
                      <div className="p-4 bg-gradient-to-r from-brand-yellow/10 to-transparent border-b border-border-subtle">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-display font-black text-sm shrink-0 shadow-md bg-brand-yellow text-black border border-yellow-300">
                            {getUserInitial()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-text-primary truncate">
                              {session.user.name || "Valued Customer"}
                            </h3>
                            <p className="text-xs text-text-muted truncate mt-0.5">
                              {session.user.email}
                            </p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-brand-yellow/15 text-brand-yellow border border-brand-yellow/30">
                                <CheckCircle2 size={11} />
                                <span>Verified Customer</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Navigation Items */}
                      <div className="p-1.5 space-y-0.5">
                        {authenticatedMenuItems.map((item, idx) => (
                          <React.Fragment key={idx}>
                            {item.divider && (
                              <div className="border-t border-border-subtle my-1.5 mx-2" />
                            )}
                            <button
                              type="button"
                              onClick={() => handleMenuItemClick(item.href)}
                              role="menuitem"
                              className={`w-full px-3 py-2.5 rounded-xl text-left flex items-start gap-3 transition-colors group ${
                                item.highlight
                                  ? "hover:bg-brand-cyan/10 border border-transparent hover:border-brand-cyan/20"
                                  : "hover:bg-bg-surface-alt"
                              }`}
                            >
                              <div className="mt-0.5">{item.icon}</div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-xs font-semibold group-hover:text-brand-yellow transition-colors ${
                                    item.highlight ? "text-brand-cyan" : "text-text-primary"
                                  }`}
                                >
                                  {item.label}
                                </p>
                                {item.description && (
                                  <p className="text-[10px] text-text-muted line-clamp-1 mt-0.5">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </button>
                          </React.Fragment>
                        ))}
                      </div>

                      {/* Sign Out Action */}
                      <div className="border-t border-border-subtle p-2">
                        <button
                          type="button"
                          onClick={handleSignOut}
                          disabled={isSigningOut}
                          role="menuitem"
                          className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isSigningOut ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              <span>Signing out…</span>
                            </>
                          ) : (
                            <>
                              <LogOut size={14} />
                              <span>Sign Out</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Guest Greeting */}
                      <div className="p-4 bg-gradient-to-br from-brand-yellow/[0.08] via-transparent to-brand-cyan/[0.05] border-b border-border-subtle text-center">
                        <div className="w-9 h-9 rounded-full bg-brand-yellow/15 border border-brand-yellow/30 flex items-center justify-center mx-auto mb-2 text-brand-yellow">
                          <Sparkles size={16} />
                        </div>
                        <h3 className="font-display font-bold text-sm text-text-primary mb-1">
                          Welcome to Star Press
                        </h3>
                        <p className="text-xs text-text-muted leading-relaxed">
                          Sign in to manage print orders, saved designs, and express checkout.
                        </p>
                      </div>

                      {/* Guest CTAs */}
                      <div className="p-3.5 space-y-2">
                        <Link
                          href="/login"
                          onClick={() => setIsProfileOpen(false)}
                          role="menuitem"
                          className="w-full py-2.5 px-4 bg-brand-yellow hover:bg-[#FFE04D] text-black font-bold text-xs rounded-full flex items-center justify-center gap-1.5 transition-all shadow-md shadow-brand-yellow/10"
                        >
                          <span>Sign In to Account</span>
                          <ArrowRight size={14} />
                        </Link>

                        <Link
                          href="/register"
                          onClick={() => setIsProfileOpen(false)}
                          role="menuitem"
                          className="w-full py-2 px-4 bg-bg-surface-alt hover:bg-border-subtle border border-border-subtle text-text-primary font-semibold text-xs rounded-full flex items-center justify-center transition-colors text-center"
                        >
                          Create New Account
                        </Link>
                      </div>

                      {/* Guest Order Tracking Helper */}
                      <div className="p-2.5 bg-bg-surface-alt/50 border-t border-border-subtle">
                        <Link
                          href="/account?tab=orders"
                          onClick={() => setIsProfileOpen(false)}
                          role="menuitem"
                          className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors px-2 py-1 rounded-lg hover:bg-bg-surface-alt"
                        >
                          <Package size={14} className="text-brand-yellow" />
                          <span>Track an Existing Order</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* "Get a Quote" Pill Button (Desktop) */}
            <div className="hidden sm:block">
              <Link
                href="/custom-printing"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full bg-brand-yellow text-black hover:bg-[#FFE04D] transition-all duration-200 shadow-glow-yellow hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles size={13} className="text-black" />
                <span>Get a Quote</span>
              </Link>
            </div>

            {/* Mobile Hamburger Menu Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={isMobileOpen}
              className="lg:hidden p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus-visible:ring-2 focus-visible:ring-brand-yellow min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Drawer */}
      <MobileNavDrawer
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
      />
    </>
  );
}
