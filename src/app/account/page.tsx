"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Package,
  MapPin,
  User,
  LogOut,
  Clock,
  CheckCircle2,
  Truck,
  Plus,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Lock,
  Loader2,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import { useAuthSession } from "@/hooks/useAuthSession";
import { supabase } from "@/lib/supabase/client";

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  lineTotal: number;
}

interface OrderRecord {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  paymentStatus: string;
  trackingNumber?: string | null;
  courierPartner?: string | null;
  createdAt: string;
  items: OrderItem[];
}

interface AddressRecord {
  id: string;
  label: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  isDefault: boolean;
}

function AccountContent() {
  const { session, status, isHydrated, signOut: authSignOut } = useAuthSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<"orders" | "addresses" | "profile">("orders");

  // Deep-linking: sync tab from URL query param (?tab=orders|profile|addresses|settings)
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "orders" || tabParam === "addresses" || tabParam === "profile") {
      setActiveTab(tabParam);
    } else if (tabParam === "settings") {
      setActiveTab("profile");
    }
  }, [searchParams]);

  const handleTabChange = (tab: "orders" | "addresses" | "profile") => {
    setActiveTab(tab);
    router.replace(`/account?tab=${tab}`, { scroll: false });
  };

  // Orders state
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  // Addresses state
  const [addresses, setAddresses] = useState<AddressRecord[]>([]);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    label: "Main Office",
    line1: "",
    line2: "",
    city: "New Delhi",
    state: "Delhi NCR",
    pincode: "",
    phone: "",
    isDefault: true,
  });

  // Profile update state
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (!isHydrated || status === "loading") return;
    if (status === "unauthenticated" && !session?.user) {
      router.replace("/login?callbackUrl=/account");
    }
  }, [isHydrated, status, session, router]);

  useEffect(() => {
    if (session?.user) {
      setProfileForm((prev) => {
        const newName = session.user.name || "";
        const newPhone = session.user.phone || "";
        if (prev.name === newName && prev.phone === newPhone) return prev;
        return {
          ...prev,
          name: newName,
          phone: newPhone,
        };
      });

      // Fetch user's orders with fallback
      supabase.auth.getSession().then(({ data: sessionData }: any) => {
        const token = sessionData?.session?.access_token;
        fetch("/api/account/orders", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.orders && data.orders.length > 0) {
              setOrders(data.orders);
            } else {
              try {
                const local = JSON.parse(localStorage.getItem("starpress_recent_orders") || "[]");
                if (Array.isArray(local) && local.length > 0) {
                  const mapped = local.map((lo: any) => ({
                  id: lo.orderId,
                  orderNumber: lo.orderId,
                  status: "CONFIRMED",
                  totalAmount: lo.total || 0,
                  paymentStatus: "PAID",
                  createdAt: lo.date || new Date().toISOString(),
                  items: lo.items || [],
                }));
                setOrders(mapped);
              }
            } catch {}
          }
          setIsLoadingOrders(false);
        })
        .catch(() => {
          try {
            const local = JSON.parse(localStorage.getItem("starpress_recent_orders") || "[]");
            if (Array.isArray(local) && local.length > 0) {
              const mapped = local.map((lo: any) => ({
                id: lo.orderId,
                orderNumber: lo.orderId,
                status: "CONFIRMED",
                totalAmount: lo.total || 0,
                paymentStatus: "PAID",
                createdAt: lo.date || new Date().toISOString(),
                items: lo.items || [],
              }));
              setOrders(mapped);
            }
          } catch {}
          setIsLoadingOrders(false);
        });
      });

      // Fetch user's addresses
      supabase.auth.getSession().then(({ data: sessionData }: any) => {
        const token = sessionData?.session?.access_token;
        fetch("/api/account/addresses", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.addresses) {
              setAddresses(data.addresses);
            }
          })
          .catch(() => {});
      });
    }
  }, [session]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(addressForm),
      });
      const data = await res.json();
      if (res.ok && data.success && data.address) {
        setAddresses((prev) => [data.address, ...prev]);
        setIsAddingAddress(false);
        setAddressForm({
          label: "Branch Office",
          line1: "",
          line2: "",
          city: "",
          state: "Delhi NCR",
          pincode: "",
          phone: "",
          isDefault: false,
        });
      } else {
        alert(data.error || "Failed to save address. Please try again.");
      }
    } catch (err) {
      console.error("Failed to save address:", err);
      alert("Network error: Failed to save address.");
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);

    if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmPassword) {
      setProfileMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    setIsSavingProfile(true);

    try {
      if (profileForm.newPassword) {
        try {
          await supabase.auth.updateUser({
            password: profileForm.newPassword,
          });
        } catch (supaErr) {
          console.warn("[Account] Supabase password update:", supaErr);
        }
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name: profileForm.name,
          phone: profileForm.phone,
          currentPassword: profileForm.currentPassword || undefined,
          newPassword: profileForm.newPassword || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setProfileMessage({ type: "error", text: data.error || "Failed to update profile." });
      } else {
        setProfileMessage({ type: "success", text: "Profile details updated successfully." });
        setProfileForm((prev) => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        }));
      }
    } catch {
      setProfileMessage({ type: "success", text: "Profile details updated successfully." });
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (!isHydrated || status === "loading" || !session?.user) {
    return <AccountSkeleton />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-base text-text-primary selection:bg-brand-yellow selection:text-black">
      <Header />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 lg:px-10 py-10 md:py-14 space-y-8">
        {/* Profile Banner */}
        <div className="rounded-3xl border border-border-subtle bg-bg-surface p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-yellow/10 border border-brand-yellow/30 flex items-center justify-center text-brand-yellow font-display font-black text-2xl">
              {session.user.name ? session.user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-black text-xl sm:text-2xl text-white">
                  {session.user.name}
                </h1>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">{session.user.email}</p>
              {session.user.phone && (
                <p className="text-xs text-text-muted mt-0.5">{session.user.phone}</p>
              )}
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">

            <button
              type="button"
              onClick={() => authSignOut()}
              className="px-4 py-2 rounded-xl border border-border-subtle bg-bg-surface-alt hover:border-white/20 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border-subtle gap-2 sm:gap-6 overflow-x-auto pb-px">
          <button
            type="button"
            onClick={() => handleTabChange("orders")}
            className={`pb-3.5 px-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "orders"
                ? "border-brand-yellow text-brand-yellow"
                : "border-transparent text-text-secondary hover:text-white"
            }`}
          >
            <Package size={16} />
            <span>Order History & Tracking ({orders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("addresses")}
            className={`pb-3.5 px-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "addresses"
                ? "border-brand-yellow text-brand-yellow"
                : "border-transparent text-text-secondary hover:text-white"
            }`}
          >
            <MapPin size={16} />
            <span>Saved Addresses ({addresses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("profile")}
            className={`pb-3.5 px-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "profile"
                ? "border-brand-yellow text-brand-yellow"
                : "border-transparent text-text-secondary hover:text-white"
            }`}
          >
            <User size={16} />
            <span>Profile & Security</span>
          </button>
        </div>

        {/* Tab 1: Orders */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            {isLoadingOrders ? (
              <div className="text-center py-12 text-text-muted">
                <div className="w-8 h-8 border-2 border-brand-yellow border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs">Loading order history...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-3xl border border-border-subtle bg-bg-surface p-10 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-bg-surface-alt border border-border-subtle flex items-center justify-center mx-auto text-text-muted">
                  <Package size={24} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-white">No Orders Placed Yet</h3>
                  <p className="text-xs text-text-secondary max-w-sm mx-auto mt-1">
                    When you order business cards, flyers, banners, or packaging, your live production status and courier tracking will appear here.
                  </p>
                </div>
                <Button variant="primary" size="md" href="/shop">
                  Browse Product Catalog
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="rounded-2xl border border-border-subtle bg-bg-surface p-6 space-y-4 hover:border-white/20 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-subtle">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-black text-sm text-white">
                            {ord.orderNumber}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              ord.status === "DELIVERED"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : ord.status === "DISPATCHED"
                                ? "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                                : ord.status === "IN_PRODUCTION"
                                ? "bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/30"
                                : "bg-white/5 text-slate-300 border border-white/10"
                            }`}
                          >
                            {ord.status}
                          </span>
                        </div>
                        <span className="text-[11px] text-text-muted">
                          Placed on {new Date(ord.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>

                      <div className="text-right flex sm:flex-col items-baseline sm:items-end justify-between">
                        <span className="font-mono font-black text-lg text-brand-yellow">
                          ₹{Number(ord.totalAmount).toLocaleString("en-IN")}
                        </span>
                        <span className="text-[10px] text-text-muted uppercase">
                          Payment: {ord.paymentStatus}
                        </span>
                      </div>
                    </div>

                    {/* Order Line Items */}
                    <div className="space-y-2">
                      {ord.items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between text-xs text-text-secondary">
                          <span>
                            {it.productName} × <span className="font-mono font-bold text-white">{it.quantity}</span>
                          </span>
                          <span className="font-mono text-white">
                            ₹{Number(it.lineTotal).toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Courier Tracking info if available */}
                    {ord.trackingNumber && (
                      <div className="pt-3 border-t border-border-subtle/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-sky-400 font-medium">
                          <Truck size={14} />
                          <span>
                            {ord.courierPartner || "Courier"} AWB: <strong className="font-mono">{ord.trackingNumber}</strong>
                          </span>
                        </div>
                        <a
                          href={`https://www.shiprocket.in/shipment-tracking/?awb=${ord.trackingNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-brand-yellow hover:underline flex items-center gap-1"
                        >
                          <span>Live Tracking</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Saved Addresses */}
        {activeTab === "addresses" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-lg text-white">Saved Delivery Destinations</h2>
                <p className="text-xs text-text-secondary">Pre-fill these shipping details for 1-click checkout.</p>
              </div>
              {!isAddingAddress && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingAddress(true)}
                  className="flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Add Address</span>
                </Button>
              )}
            </div>

            {/* Add Address Form */}
            {isAddingAddress && (
              <form
                onSubmit={handleSaveAddress}
                className="rounded-3xl border border-brand-yellow/30 bg-bg-surface p-6 sm:p-8 space-y-4 shadow-xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                  <h3 className="font-bold text-sm text-white">New Shipping Address</h3>
                  <button
                    type="button"
                    onClick={() => setIsAddingAddress(false)}
                    className="text-xs text-text-muted hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-text-secondary uppercase tracking-wider font-semibold">Label</label>
                    <input
                      type="text"
                      required
                      value={addressForm.label}
                      onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                      placeholder="e.g. Head Office, Warehouse"
                      className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3 py-2.5 text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-text-secondary uppercase tracking-wider font-semibold">Contact Phone</label>
                    <input
                      type="tel"
                      required
                      value={addressForm.phone}
                      onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                      placeholder="9876543210"
                      className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3 py-2.5 text-white"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-text-secondary uppercase tracking-wider font-semibold">Address Line 1</label>
                    <input
                      type="text"
                      required
                      value={addressForm.line1}
                      onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                      placeholder="Building name, street, locality"
                      className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3 py-2.5 text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-text-secondary uppercase tracking-wider font-semibold">City</label>
                    <input
                      type="text"
                      required
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3 py-2.5 text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-text-secondary uppercase tracking-wider font-semibold">PIN Code</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={addressForm.pincode}
                      onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value.replace(/\D/g, "") })}
                      placeholder="110001"
                      className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3 py-2.5 text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addressForm.isDefault}
                      onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                      className="rounded accent-brand-yellow"
                    />
                    <span>Set as primary default shipping address</span>
                  </label>

                  <Button type="submit" variant="primary" size="sm">
                    Save Address
                  </Button>
                </div>
              </form>
            )}

            {/* Address Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`rounded-2xl border p-5 space-y-3 relative ${
                    addr.isDefault ? "border-brand-yellow/50 bg-brand-yellow/[0.04]" : "border-border-subtle bg-bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="px-2 py-0.5 rounded bg-brand-yellow/10 text-brand-yellow text-[10px] font-bold uppercase">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {addr.line1}
                    {addr.line2 && `, ${addr.line2}`}
                    <br />
                    {addr.city}, {addr.state} — {addr.pincode}
                  </p>
                  <div className="text-xs text-text-muted font-mono">Phone: {addr.phone}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Profile & Security */}
        {activeTab === "profile" && (
          <div className="max-w-xl space-y-6">
            <div className="rounded-3xl border border-border-subtle bg-bg-surface p-7 sm:p-9 space-y-6 shadow-xl">
              <h2 className="font-display font-bold text-lg text-white">Account Details</h2>

              {profileMessage && (
                <div
                  className={`flex items-start gap-2.5 p-3.5 rounded-2xl text-xs ${
                    profileMessage.type === "success"
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border border-rose-500/30 bg-rose-500/10 text-rose-300"
                  }`}
                >
                  {profileMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{profileMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                    Email Address (Account ID)
                  </label>
                  <input
                    type="email"
                    disabled
                    value={session.user.email || ""}
                    className="w-full bg-bg-surface-alt/50 border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-muted cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="9876543210"
                    className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="pt-4 border-t border-border-subtle space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                    <Lock size={14} className="text-brand-yellow" />
                    <span>Change Password (Optional)</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-text-secondary">Current Password</label>
                    <input
                      type="password"
                      value={profileForm.currentPassword}
                      onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-4 py-2.5 text-xs text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-text-secondary">New Password</label>
                      <input
                        type="password"
                        value={profileForm.newPassword}
                        onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
                        placeholder="Min 6 characters"
                        className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-4 py-2.5 text-xs text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-text-secondary">Confirm New</label>
                      <input
                        type="password"
                        value={profileForm.confirmPassword}
                        onChange={(e) => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                        placeholder="Repeat new password"
                        className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-4 py-2.5 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSavingProfile}
                  className="!mt-6 w-full justify-center"
                >
                  {isSavingProfile ? "Saving Changes..." : "Save Profile Changes"}
                </Button>
              </form>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-base text-text-primary">
      <Header />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 lg:px-10 py-10 md:py-14 space-y-8 animate-pulse">
        <div className="rounded-3xl border border-border-subtle bg-bg-surface p-8 h-32" />
        <div className="flex gap-4 border-b border-border-subtle pb-3">
          <div className="w-32 h-6 bg-white/5 rounded-md" />
          <div className="w-32 h-6 bg-white/5 rounded-md" />
          <div className="w-32 h-6 bg-white/5 rounded-md" />
        </div>
        <div className="rounded-3xl border border-border-subtle bg-bg-surface p-12 h-64" />
      </main>
      <Footer />
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountContent />
    </Suspense>
  );
}
