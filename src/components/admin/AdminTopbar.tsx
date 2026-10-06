'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Bell,
  ExternalLink,
  LogOut,
  Loader2,
  X,
  Package,
  ShoppingCart,
  Users,
  Menu,
  Plus,
  Sliders,
  Sparkles,
  Command,
  ArrowRight,
} from 'lucide-react';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useAdminSidebar } from './AdminSidebarContext';

export default function AdminTopbar() {
  const { session, signOut } = useAuthSession();
  const router = useRouter();
  const { toggleMobile } = useAdminSidebar();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    orders: any[];
    products: any[];
    customers: any[];
  }>({ orders: [], products: [], customers: [] });
  const [isSigningOut, setIsSigningOut] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const userEmail = session?.user?.email || 'admin@example.com';
  const userName = session?.user?.name || 'Administrator';
  const userInitial = userName.charAt(0).toUpperCase();

  // Keyboard shortcut listener (⌘K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced search query
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults({ orders: [], products: [], customers: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults({
            orders: data.orders || [],
            products: data.products || [],
            customers: data.customers || [],
          });
        }
      } catch {
        // silent
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push('/admin/login');
    } catch {
      window.location.href = '/admin/login';
    }
  };

  const hasResults =
    searchResults.orders.length > 0 ||
    searchResults.products.length > 0 ||
    searchResults.customers.length > 0;

  return (
    <>
      <header className="sticky top-0 z-40 h-16 flex items-center justify-between gap-4 px-4 sm:px-6 bg-[#080A10]/80 backdrop-blur-xl border-b border-white/[0.06]">
        {/* Left: Mobile Hamburger & Search Trigger */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <button
            onClick={toggleMobile}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Open navigation sidebar"
          >
            <Menu size={20} />
          </button>

          {/* Quick Search Bar */}
          <button
            onClick={() => {
              setSearchOpen(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className="w-full max-w-md h-9 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-left text-xs text-slate-400 flex items-center justify-between transition-all group"
          >
            <div className="flex items-center gap-2">
              <Search size={14} className="text-slate-500 group-hover:text-brand-yellow transition-colors" />
              <span>Search products, orders, customers…</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[10px] font-mono text-slate-400">
              <span className="text-[11px]">⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Right: Status, Actions, Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live DB Indicator */}
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-medium text-emerald-400">Database Live</span>
          </div>

          {/* Quick Add Product */}
          <Link
            href="/admin/products/new"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-yellow/10 hover:bg-brand-yellow/20 text-brand-yellow border border-brand-yellow/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={14} />
            <span>Add Product</span>
          </Link>

          {/* View Public Storefront */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
            title="Open storefront in new tab"
          >
            <span>View Store</span>
            <ExternalLink size={12} />
          </a>

          {/* Vertical Divider */}
          <div className="w-px h-6 bg-white/[0.08] mx-1 hidden sm:block" />

          {/* User Profile */}
          <div className="flex items-center gap-2.5 pl-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-yellow/20 to-brand-yellow/5 border border-brand-yellow/30 flex items-center justify-center text-brand-yellow font-bold text-xs shadow-[0_0_10px_rgba(245,186,19,0.15)]">
              {userInitial}
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-semibold text-white leading-tight truncate max-w-[130px]">
                {userName}
              </span>
              <span className="text-[10px] text-slate-400 leading-tight truncate max-w-[130px]">
                {userEmail}
              </span>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
            title="Sign Out"
            aria-label="Sign Out"
          >
            {isSigningOut ? <Loader2 size={16} className="animate-spin text-rose-400" /> : <LogOut size={16} />}
          </button>
        </div>
      </header>

      {/* Global Command Palette / Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-24 px-4">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-md animate-fadeIn"
            onClick={() => setSearchOpen(false)}
          />
          <div className="relative w-full max-w-xl bg-[#0D101A] border border-white/10 rounded-2xl shadow-elevation-md overflow-hidden z-10 animate-fadeIn">
            {/* Input bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08]">
              <Search size={18} className="text-brand-yellow shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, orders, customers…"
                className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded text-slate-500 hover:text-white"
                >
                  <X size={15} />
                </button>
              )}
              <kbd
                onClick={() => setSearchOpen(false)}
                className="px-2 py-0.5 text-[11px] rounded bg-white/[0.06] text-slate-400 border border-white/[0.08] cursor-pointer hover:bg-white/10"
              >
                ESC
              </kbd>
            </div>

            {/* Results Area */}
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {isSearching ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 size={18} className="animate-spin text-brand-yellow" />
                  <span>Searching StarPress live database…</span>
                </div>
              ) : searchQuery.trim().length >= 2 && !hasResults ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No matching orders, products, or customers found for &quot;{searchQuery}&quot;
                </div>
              ) : searchQuery.trim().length < 2 ? (
                <div className="p-4 space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Quick Navigation
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/admin/products/new"
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.04] text-xs text-white transition-colors"
                    >
                      <Plus size={14} className="text-brand-yellow" />
                      <span>Create New Product</span>
                    </Link>
                    <Link
                      href="/admin/settings?tab=slider"
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.04] text-xs text-white transition-colors"
                    >
                      <Sliders size={14} className="text-cyan-400" />
                      <span>Manage Hero Slider</span>
                    </Link>
                    <Link
                      href="/admin/orders?status=pending"
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.04] text-xs text-white transition-colors"
                    >
                      <ShoppingCart size={14} className="text-emerald-400" />
                      <span>Pending Orders</span>
                    </Link>
                    <Link
                      href="/admin/categories"
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.04] text-xs text-white transition-colors"
                    >
                      <Package size={14} className="text-purple-400" />
                      <span>Product Categories</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {searchResults.products.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Package size={12} className="text-brand-yellow" /> Products ({searchResults.products.length})
                      </div>
                      <div className="space-y-1 mt-1">
                        {searchResults.products.map((p) => (
                          <Link
                            key={p.id}
                            href={p.href || `/admin/products/${p.id}`}
                            onClick={() => setSearchOpen(false)}
                            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.06] transition-colors group"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-medium text-white group-hover:text-brand-yellow transition-colors truncate">
                                {p.title || p.name}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">{p.subtitle || p.categoryName || 'Product'}</p>
                            </div>
                            <ArrowRight size={14} className="text-slate-500 group-hover:text-white transition-colors shrink-0" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.orders.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <ShoppingCart size={12} className="text-emerald-400" /> Orders ({searchResults.orders.length})
                      </div>
                      <div className="space-y-1 mt-1">
                        {searchResults.orders.map((o) => (
                          <Link
                            key={o.id}
                            href={o.href || `/admin/orders`}
                            onClick={() => setSearchOpen(false)}
                            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.06] transition-colors group"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-mono font-medium text-brand-yellow group-hover:underline">
                                {o.title || o.orderNumber}
                              </p>
                              <p className="text-[11px] text-slate-400">{o.subtitle || o.customerName}</p>
                            </div>
                            <ArrowRight size={14} className="text-slate-500 group-hover:text-white transition-colors shrink-0" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.customers.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Users size={12} className="text-purple-400" /> Customers ({searchResults.customers.length})
                      </div>
                      <div className="space-y-1 mt-1">
                        {searchResults.customers.map((c) => (
                          <Link
                            key={c.id}
                            href={c.href || `/admin/customers`}
                            onClick={() => setSearchOpen(false)}
                            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.06] transition-colors group"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-medium text-white group-hover:text-white transition-colors">
                                {c.title || c.name}
                              </p>
                              <p className="text-[11px] text-slate-400">{c.subtitle || c.email}</p>
                            </div>
                            <ArrowRight size={14} className="text-slate-500 group-hover:text-white transition-colors shrink-0" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
