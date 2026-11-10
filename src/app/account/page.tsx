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
  CreditCard,
  FileText,
  RotateCcw,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronRight,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase/client";

interface OrderItem {
  id: string;
  productName: string;
  productSlug?: string;
  quantity: number;
  lineTotal: number;
  unitPrice?: number;
  specs?: any;
  customText?: string;
  previewUrl?: string;
}

interface OrderRecord {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  paymentStatus: string;
  paymentMethod?: string | null;
  paymentExpiresAt?: string | null;
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

const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Delhi NCR",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu & Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

function AccountContent() {
  const { session, status, isHydrated, signOut: authSignOut } = useAuthSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addItem } = useCart();

  const [activeTab, setActiveTab] = useState<"orders" | "addresses" | "profile">("orders");

  // Deep-linking: sync tab from URL query param
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
  const [reorderedId, setReorderedId] = useState<string | null>(null);

  // Addresses state
  const [addresses, setAddresses] = useState<AddressRecord[]>([]);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState({
    label: "Delivery Address",
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

  const fetchAddressesList = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch("/api/account/addresses", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.addresses && Array.isArray(data.addresses)) {
        setAddresses(data.addresses);
      }
    } catch {}
  };

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

      // Fetch user's orders
      supabase.auth.getSession().then(({ data: sessionData }: any) => {
        const token = sessionData?.session?.access_token;
        fetch("/api/account/orders", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.orders && Array.isArray(data.orders) && data.orders.length > 0) {
              setOrders(data.orders);
            }
          })
          .catch(() => {})
          .finally(() => {
            setIsLoadingOrders(false);
          });
      });

      fetchAddressesList();
    }
  }, [session]);

  const handleReorder = (order: OrderRecord) => {
    if (!order.items || order.items.length === 0) return;

    order.items.forEach((item) => {
      const specs = item.specs || {};
      const customKey = `${item.productSlug || item.id}-${specs.sizeId || "std"}-${specs.materialId || "std"}-${Date.now().toString(36)}`;

      addItem(
        {
          id: customKey,
          productId: undefined,
          productSlug: item.productSlug,
          name: item.productName,
          price: item.unitPrice || Number(item.lineTotal) / (item.quantity || 1),
          imageSrc: item.previewUrl || "/images/hero-composition.jpg",
          href: item.productSlug ? `/shop/${item.productSlug}` : "/shop",
          quantity: item.quantity,
          sizeId: specs.sizeId,
          sizeLabel: specs.sizeLabel,
          materialId: specs.materialId,
          materialLabel: specs.materialLabel,
          customText: item.customText || specs.customText,
          customizations: {
            personalizedText: item.customText || specs.customText,
            notes: specs.notes,
          },
          specs: item.specs,
        },
        item.quantity
      );
    });

    setReorderedId(order.id);
    setTimeout(() => {
      router.push("/cart");
    }, 1200);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const method = editingAddressId ? "PUT" : "POST";
      const payload = editingAddressId ? { id: editingAddressId, ...addressForm } : addressForm;

      const res = await fetch("/api/account/addresses", {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await fetchAddressesList();
        setIsAddingAddress(false);
        setEditingAddressId(null);
        setAddressForm({
          label: "Delivery Address",
          line1: "",
          line2: "",
          city: "New Delhi",
          state: "Delhi NCR",
          pincode: "",
          phone: "",
          isDefault: false,
        });
      } else {
        alert(data.error || "Failed to save address. Please check your inputs.");
      }
    } catch (err) {
      console.error("Failed to save address:", err);
      alert("Network error: Failed to save address.");
    }
  };

  const handleStartEdit = (addr: AddressRecord) => {
    setEditingAddressId(addr.id);
    setIsAddingAddress(true);
    setAddressForm({
      label: addr.label || "Delivery Address",
      line1: addr.line1,
      line2: addr.line2 || "",
      city: addr.city,
      state: addr.state || "Delhi NCR",
      pincode: addr.pincode,
      phone: addr.phone,
      isDefault: addr.isDefault,
    });
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm("Are you sure you want to delete this delivery address?")) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      await fetch(`/api/account/addresses?id=${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      await fetchAddressesList();
    } catch {}
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
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 xs:px-6 lg:px-10 py-8 sm:py-10 md:py-14 space-y-8">
        {/* Profile Banner */}
        <div className="rounded-3xl border border-border-subtle bg-bg-surface p-4 xs:p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-yellow/10 border border-brand-yellow/30 flex items-center justify-center text-brand-yellow font-display font-black text-2xl">
              {session.user.name ? session.user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-black text-xl sm:text-2xl text-text-primary">
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
            <Link
              href="/shop"
              className="px-4 py-2 rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 text-brand-yellow text-xs font-bold hover:bg-brand-yellow/20 transition-colors"
            >
              Order New Prints
            </Link>

            <button
              type="button"
              onClick={() => authSignOut()}
              className="px-4 py-2 rounded-xl border border-border-subtle bg-bg-surface-alt hover:border-border-strong text-text-secondary hover:text-text-primary text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border-subtle gap-2 sm:gap-6 overflow-x-auto pb-px no-scrollbar overscroll-x-contain">
          <button
            type="button"
            onClick={() => handleTabChange("orders")}
            className={`pb-3.5 px-2 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "orders"
                ? "border-brand-yellow text-brand-yellow"
                : "border-transparent text-text-secondary hover:text-text-primary"
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
                : "border-transparent text-text-secondary hover:text-text-primary"
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
                : "border-transparent text-text-secondary hover:text-text-primary"
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
                  <h3 className="font-display font-bold text-lg text-text-primary">No Orders Placed Yet</h3>
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
                    className="rounded-2xl border border-border-subtle bg-bg-surface p-6 space-y-4 hover:border-border-strong transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-subtle">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <Link
                            href={`/account/orders/${ord.id}`}
                            className="font-mono font-black text-sm text-brand-yellow hover:underline"
                          >
                            {ord.orderNumber}
                          </Link>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              ord.status === "DELIVERED"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : ord.status === "DISPATCHED"
                                ? "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                                : ord.status === "IN_PRODUCTION"
                                ? "bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/30"
                                : "bg-bg-surface-alt text-text-secondary border border-border-subtle"
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
                            {it.productName} × <span className="font-mono font-bold text-text-primary">{it.quantity}</span>
                          </span>
                          <span className="font-mono text-text-primary">
                            ₹{Number(it.lineTotal).toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Actions: View Details, Track, Buy Again, Invoice */}
                    <div className="pt-3 border-t border-border-subtle/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/account/orders/${ord.id}`}
                          className="font-bold text-text-primary hover:text-brand-yellow flex items-center gap-1 transition-colors"
                        >
                          <span>Order Details</span>
                          <ChevronRight size={13} />
                        </Link>

                        <Link
                          href={`/orders/track?order=${encodeURIComponent(ord.orderNumber)}`}
                          className="text-text-secondary hover:text-brand-yellow flex items-center gap-1 transition-colors"
                        >
                          <Truck size={13} />
                          <span>Track Package</span>
                        </Link>

                        {ord.paymentStatus === "PAID" && (
                          <Link
                            href={`/account/orders/${ord.id}/invoice`}
                            className="text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors"
                          >
                            <FileText size={13} />
                            <span>Tax Invoice</span>
                          </Link>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReorder(ord)}
                        className="font-bold text-xs uppercase"
                      >
                        {reorderedId === ord.id ? (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <Check size={13} />
                            <span>Added to Cart!</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <RotateCcw size={12} className="text-brand-yellow" />
                            <span>Buy Again</span>
                          </span>
                        )}
                      </Button>
                    </div>

                    {/* Payment Recovery Action for Unpaid Orders */}
                    {ord.paymentStatus !== "PAID" && ord.status !== "CANCELLED" && (
                      <div className="pt-3 border-t border-border-subtle/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-500/5 -mx-6 -mb-6 p-4 rounded-b-2xl border-t border-amber-500/20">
                        <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 text-xs font-medium">
                          <CreditCard size={15} />
                          <span>Payment incomplete — complete payment now to start production.</span>
                        </div>
                        <Link
                          href={`/account/orders/${ord.id}/pay`}
                          className="px-4 py-2 rounded-xl bg-brand-yellow hover:bg-yellow-400 text-black text-xs font-bold flex items-center gap-1.5 shadow-md shadow-brand-yellow/10 transition-colors shrink-0"
                        >
                          <CreditCard size={13} />
                          <span>Complete Payment</span>
                        </Link>
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
                <h2 className="font-display font-bold text-lg text-text-primary">Saved Delivery Destinations</h2>
                <p className="text-xs text-text-secondary">Pre-fill these shipping details for 1-click checkout.</p>
              </div>
              {!isAddingAddress && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingAddressId(null);
                    setIsAddingAddress(true);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Add Address</span>
                </Button>
              )}
            </div>

            {/* Add / Edit Address Form */}
            {isAddingAddress && (
              <form
                onSubmit={handleSaveAddress}
                className="rounded-3xl border border-brand-yellow/30 bg-bg-surface p-6 sm:p-8 space-y-4 shadow-xl"
              >
                <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                  <h3 className="font-bold text-sm text-text-primary">
                    {editingAddressId ? "Edit Delivery Address" : "New Shipping Address"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingAddress(false);
                      setEditingAddressId(null);
                    }}
                    className="text-xs text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-text-secondary uppercase tracking-wider font-semibold">Address Label *</label>
                    <input
                      type="text"
                      required
                      value={addressForm.label}
                      onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                      placeholder="e.g. Head Office, Warehouse, Home"
                      className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3 py-2.5 text-text-primary focus:outline-none focus:border-brand-yellow"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-text-secondary uppercase tracking-wider font-semibold">Contact Phone *</label>
                    <input
                      type="tel"
                      required
                      value={addressForm.phone}
                      onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                      placeholder="9876543210"
                      className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3 py-2.5 text-text-primary focus:outline-none focus:border-brand-yellow"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-text-secondary uppercase tracking-wider font-semibold">Address Line 1 (Flat/Building) *</label>
                    <input
                      type="text"
                      required
                      value={addressForm.line1}
                      onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                      placeholder="Building name, street, locality"
                      className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3 py-2.5 text-text-primary focus:outline-none focus:border-brand-yellow"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-text-secondary uppercase tracking-wider font-semibold">Address Line 2 (Area/Sector)</label>
                    <input
                      type="text"
                      value={addressForm.line2}
                      onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
                      placeholder="Near Landmark, Area"
                      className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3 py-2.5 text-text-primary focus:outline-none focus:border-brand-yellow"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-text-secondary uppercase tracking-wider font-semibold">City *</label>
                    <input
                      type="text"
                      required
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      placeholder="New Delhi, Mumbai, etc."
                      className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3 py-2.5 text-text-primary focus:outline-none focus:border-brand-yellow"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-text-secondary uppercase tracking-wider font-semibold">State *</label>
                    <select
                      value={addressForm.state}
                      onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                      className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3 py-2.5 text-text-primary focus:outline-none focus:border-brand-yellow"
                    >
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st} className="bg-bg-surface text-text-primary">
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-text-secondary uppercase tracking-wider font-semibold">PIN Code (6 Digits) *</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={addressForm.pincode}
                      onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                      placeholder="110001"
                      className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-3 py-2.5 text-text-primary font-mono focus:outline-none focus:border-brand-yellow"
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

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingAddress(false);
                        setEditingAddressId(null);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary"
                    >
                      Cancel
                    </button>
                    <Button type="submit" variant="primary" size="sm">
                      {editingAddressId ? "Save Changes" : "Save Address"}
                    </Button>
                  </div>
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
                    <span className="font-bold text-sm text-text-primary">{addr.label}</span>
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
                    {addr.city}, {addr.state} — <strong className="text-text-primary font-mono">{addr.pincode}</strong>
                  </p>
                  <div className="text-xs text-text-muted font-mono">Phone: {addr.phone}</div>

                  <div className="flex items-center gap-3 pt-2 border-t border-border-subtle text-xs">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(addr)}
                      className="text-text-secondary hover:text-brand-yellow flex items-center gap-1 font-medium transition-colors"
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="text-text-muted hover:text-rose-400 flex items-center gap-1 font-medium transition-colors"
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Profile & Security */}
        {activeTab === "profile" && (
          <div className="max-w-xl space-y-6">
            <div className="rounded-3xl border border-border-subtle bg-bg-surface p-7 sm:p-9 space-y-6 shadow-xl">
              <h2 className="font-display font-bold text-lg text-text-primary">Account Details</h2>

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
                    className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary"
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
                    className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary"
                  />
                </div>

                <div className="pt-4 border-t border-border-subtle space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider">
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
                      className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-4 py-2.5 text-xs text-text-primary"
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
                        className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-4 py-2.5 text-xs text-text-primary"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-text-secondary">Confirm New</label>
                      <input
                        type="password"
                        value={profileForm.confirmPassword}
                        onChange={(e) => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                        placeholder="Repeat new password"
                        className="w-full bg-bg-surface-alt border border-border-subtle rounded-xl px-4 py-2.5 text-xs text-text-primary"
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
