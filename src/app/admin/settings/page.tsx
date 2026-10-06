'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Store,
  CreditCard,
  Truck,
  Bell,
  Shield,
  Users,
  Globe,
  Palette,
  Mail,
  Save,
  Loader2,
  Image as ImageIcon,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  Check,
  ExternalLink,
} from 'lucide-react';
import { showToast } from '@/components/admin/ui/Toast';
import { Skeleton } from '@/components/admin/ui/Skeleton';
import ImageUploader from '@/components/admin/ui/ImageUploader';
import Hero from '@/components/sections/Hero';

const TABS = [
  { key: 'general', label: 'General Info', icon: Store },
  { key: 'slider', label: 'Home Slider', icon: ImageIcon },
  { key: 'payments', label: 'Payments & COD', icon: CreditCard },
  { key: 'shipping', label: 'Shipping Rules', icon: Truck },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security & Auth', icon: Shield },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Slider state
  const [slides, setSlides] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Settings form state
  const [storeName, setStoreName] = useState('Star Press');
  const [storeEmail, setStoreEmail] = useState('starpress.print@gmail.com');
  const [storePhone, setStorePhone] = useState('+91 74568 49955');
  const [storeAddress, setStoreAddress] = useState('Amoun, Khatima (Uttarakhand)');
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [gstin, setGstin] = useState('07AAAAA0000A1Z5');

  // Payments state
  const [codEnabled, setCodEnabled] = useState(true);
  const [gatewayStatus, setGatewayStatus] = useState<{
    isRazorpayConfigured: boolean;
    keyIdMasked: string | null;
    hasKeySecret: boolean;
    hasWebhookSecret: boolean;
    isResendConfigured: boolean;
  }>({
    isRazorpayConfigured: false,
    keyIdMasked: null,
    hasKeySecret: false,
    hasWebhookSecret: false,
    isResendConfigured: false,
  });

  // Shipping state
  const [defaultCourier, setDefaultCourier] = useState('Shiprocket');
  const [flatShippingFee, setFlatShippingFee] = useState('99');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('999');

  useEffect(() => {
    async function load() {
      try {
        const [res, sliderRes, categoriesRes] = await Promise.all([
          fetch('/api/admin/settings'),
          fetch('/api/admin/settings/slider'),
          fetch('/api/admin/categories'),
        ]);

        if (res.ok) {
          const data = await res.json();
          if (data.gatewayStatus) {
            setGatewayStatus(data.gatewayStatus);
          }
          if (data.settings) {
            setStoreName(data.settings.storeName || 'Star Press');
            setStoreEmail(data.settings.storeEmail || 'starpress.print@gmail.com');
            setStorePhone(data.settings.storePhone || '+91 74568 49955');
            setStoreAddress(data.settings.storeAddress || 'Amoun, Khatima (Uttarakhand)');
            setCurrency(data.settings.currency || 'INR');
            setTimezone(data.settings.timezone || 'Asia/Kolkata');
            setGstin(data.settings.gstin || '07AAAAA0000A1Z5');
          }
        }

        if (sliderRes.ok) {
          const sliderData = await sliderRes.json();
          if (sliderData.slides && Array.isArray(sliderData.slides)) {
            setSlides(sliderData.slides);
          }
        }
        
        if (categoriesRes.ok) {
          const catData = await categoriesRes.json();
          if (catData.categories && Array.isArray(catData.categories)) {
            setCategories(catData.categories);
          }
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeTab === 'slider') {
        const res = await fetch('/api/admin/settings/slider', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slides }),
        });
        if (res.ok) {
          showToast('Hero slider settings updated & saved to Supabase');
        } else {
          showToast('Failed to save slider settings', 'error');
        }
        setSaving(false);
        return;
      }

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName,
          storeEmail,
          storePhone,
          storeAddress,
          currency,
          timezone,
          gstin,
        }),
      });

      if (res.ok) {
        showToast('Store settings saved successfully');
      } else {
        showToast('Failed to save settings', 'error');
      }
    } catch {
      showToast('Network error while saving settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSlide = () => {
    setSlides([
      ...slides,
      {
        src: '',
        alt: 'Promotional Banner',
        badge: 'NEW ARRIVAL',
        headline: ['PREMIUM', 'PRINTING'],
        highlightIndex: 1,
        sub: 'Order high quality prints delivered straight to your door.',
        cta: { label: 'Shop Now', href: '/shop' },
      },
    ]);
  };

  const handleRemoveSlide = (idx: number) => {
    const newSlides = [...slides];
    newSlides.splice(idx, 1);
    setSlides(newSlides);
  };

  const handleMoveSlide = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === slides.length - 1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newSlides = [...slides];
    const temp = newSlides[idx];
    newSlides[idx] = newSlides[targetIdx];
    newSlides[targetIdx] = temp;
    setSlides(newSlides);
  };

  const updateSlide = (idx: number, field: string, value: any) => {
    const newSlides = [...slides];
    const keys = field.split('.');
    if (keys.length === 2) {
      newSlides[idx][keys[0]][keys[1]] = value;
    } else {
      newSlides[idx][field] = value;
    }
    setSlides(newSlides);
  };

  const updateHeadline = (idx: number, lineIdx: number, value: string) => {
    const newSlides = [...slides];
    if (!newSlides[idx].headline) newSlides[idx].headline = ['', ''];
    newSlides[idx].headline[lineIdx] = value;
    setSlides(newSlides);
  };

  const inputClass =
    'w-full h-9 px-3 rounded-xl bg-[#090B12] border border-white/[0.08] text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-yellow/50 transition-colors';

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
          <div className="md:col-span-3 bg-[#0E111B] border border-white/[0.06] rounded-2xl p-6 space-y-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Store Settings</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure store identity, homepage hero slider, payments, shipping rates, and security.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-yellow text-black hover:bg-[#FFE04D] transition-all shadow-[0_0_15px_rgba(245,186,19,0.2)] disabled:opacity-50 self-start sm:self-auto"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          <span>{saving ? 'Saving Changes…' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Tabs */}
        <div className="space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium transition-all ${
                  active
                    ? 'bg-brand-yellow/15 text-brand-yellow font-semibold border border-brand-yellow/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Icon size={16} className={active ? 'text-brand-yellow' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Panel */}
        <div className="lg:col-span-3 bg-[#0E111B] border border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-elevation-sm">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-white">Store Identity &amp; Contact Information</h2>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Store Name</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Official Support Email</label>
                  <input
                    type="email"
                    value={storeEmail}
                    onChange={(e) => setStoreEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Customer Helpline / WhatsApp</label>
                  <input
                    type="text"
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Physical Store / Factory Address</label>
                <textarea
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  rows={2}
                  className={inputClass.replace('h-9', 'h-auto py-2.5 resize-none')}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className={inputClass + ' cursor-pointer'}
                  >
                    <option value="INR">INR (₹) - Indian Rupee</option>
                    <option value="USD">USD ($) - US Dollar</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className={inputClass + ' cursor-pointer'}
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">GSTIN Identifier</label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Slider Tab */}
          {activeTab === 'slider' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div>
                  <h2 className="text-sm font-semibold text-white">Homepage Hero Slider Slides</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Images and promotions displayed on the store homepage hero carousel.
                  </p>
                </div>
                <button
                  onClick={handleAddSlide}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-yellow/10 hover:bg-brand-yellow/20 text-brand-yellow border border-brand-yellow/30 transition-all"
                >
                  <Plus size={14} /> Add Slide
                </button>
              </div>

              {/* Live Preview Container */}
              <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-black relative mb-6">
                <div className="p-3 border-b border-white/[0.08] bg-[#0E111B] flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5"><Eye size={14} className="text-brand-yellow" /> Live Preview</span>
                </div>
                <div className="w-full h-[400px] overflow-hidden relative pointer-events-none">
                  {/* We scale the preview down to 50% to fit it nicely while preserving standard aspect ratio */}
                  <div className="absolute top-0 left-0 w-[200%] h-[200%] origin-top-left scale-50">
                    <Hero slides={slides.length > 0 ? slides : undefined} />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {slides.map((slide, idx) => (
                  <div
                    key={idx}
                    className="p-4 sm:p-5 rounded-2xl bg-[#090B12] border border-white/[0.08] relative space-y-4 hover:border-white/[0.14] transition-all"
                  >
                    {/* Header with reordering and delete */}
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-brand-yellow/15 border border-brand-yellow/30 text-brand-yellow text-xs font-bold font-mono">
                          Slide #{idx + 1}
                        </span>
                        <span className="text-xs text-slate-400 truncate max-w-[200px]">
                          {slide.headline?.[0]} {slide.headline?.[1]}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveSlide(idx, 'up')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-30"
                          title="Move up"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === slides.length - 1}
                          onClick={() => handleMoveSlide(idx, 'down')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-30"
                          title="Move down"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveSlide(idx)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors ml-1"
                          title="Remove slide"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Image Upload & URL */}
                    <div className="space-y-4">
                      <ImageUploader
                        bucket="product-images"
                        folder="slider"
                        entityId={`slide_${idx}`}
                        maxImages={1}
                        images={slide.src ? [{ id: `slide_${idx}`, url: slide.src, altText: slide.alt || '', isPrimary: true, position: 0 }] : []}
                        onChange={(newImages) => {
                          if (newImages.length > 0) {
                            updateSlide(idx, 'src', newImages[0].url);
                          } else {
                            updateSlide(idx, 'src', '');
                          }
                        }}
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300">Image Source (URL or Path)</label>
                          <input
                            type="text"
                            value={slide.src}
                            placeholder="/images/Slider/NamePlates.jpeg or https://..."
                            onChange={(e) => updateSlide(idx, 'src', e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300">Alt Text (Accessibility)</label>
                          <input
                            type="text"
                            value={slide.alt}
                            placeholder="e.g. Acrylic Nameplates and signs"
                            onChange={(e) => updateSlide(idx, 'alt', e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Headline and Copy */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300">Badge Text</label>
                        <input
                          type="text"
                          value={slide.badge}
                          placeholder="e.g. BESTSELLER"
                          onChange={(e) => updateSlide(idx, 'badge', e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300">Headline Line 1</label>
                        <input
                          type="text"
                          value={slide.headline?.[0] || ''}
                          placeholder="e.g. LUXURY ACRYLIC"
                          onChange={(e) => updateHeadline(idx, 0, e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300">Headline Line 2</label>
                        <input
                          type="text"
                          value={slide.headline?.[1] || ''}
                          placeholder="e.g. NAMEPLATES"
                          onChange={(e) => updateHeadline(idx, 1, e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Subtext / Description (Use \n for line breaks)
                      </label>
                      <textarea
                        value={slide.sub}
                        onChange={(e) => updateSlide(idx, 'sub', e.target.value)}
                        rows={2}
                        className={inputClass.replace('h-9', 'h-auto py-2.5 resize-none')}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300">CTA Button Label</label>
                        <input
                          type="text"
                          value={slide.cta?.label || ''}
                          placeholder="Shop Now"
                          onChange={(e) => updateSlide(idx, 'cta.label', e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-slate-300">CTA Link Target</label>
                          {categories.length > 0 && (
                            <select
                              className="text-[9px] bg-white/[0.04] border border-white/10 rounded px-1.5 py-0.5 text-slate-300 outline-none cursor-pointer"
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                const cat = categories.find(c => c.slug === val);
                                if (cat) {
                                  updateSlide(idx, 'cta.href', `/shop/category/${cat.slug}`);
                                  if (!slide.cta?.label) updateSlide(idx, 'cta.label', `Explore ${cat.name}`);
                                }
                                e.target.value = ''; // Reset select
                              }}
                            >
                              <option value="">Auto-link Category...</option>
                              {categories.map(c => (
                                <option key={c.slug} value={c.slug}>{c.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                        <input
                          type="text"
                          value={slide.cta?.href || ''}
                          placeholder="/shop/category/nameplates"
                          onChange={(e) => updateSlide(idx, 'cta.href', e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {slides.length === 0 && (
                  <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl">
                    <p className="text-xs text-slate-400">No custom slides defined. Using system default hero slides.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-white">Payment Gateways &amp; Checkout Rules</h2>
              
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <CreditCard size={15} className="text-brand-yellow" />
                      Razorpay Payment Gateway Integration
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Processes UPI (Google Pay, PhonePe, Paytm), NetBanking, RuPay, Visa, and Mastercard.
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase border ${
                      gatewayStatus.isRazorpayConfigured
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {gatewayStatus.isRazorpayConfigured ? 'CONFIGURED' : 'NOT CONFIGURED'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/[0.06] text-xs">
                  <div className="p-3 rounded-xl bg-[#090B12] border border-white/[0.06]">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">
                      Key ID (Public)
                    </span>
                    <span className="font-mono text-white text-xs font-medium">
                      {gatewayStatus.keyIdMasked || 'Missing in env'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#090B12] border border-white/[0.06]">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">
                      Key Secret
                    </span>
                    <span
                      className={`font-semibold text-xs ${
                        gatewayStatus.hasKeySecret ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {gatewayStatus.hasKeySecret ? '✓ Configured in env' : '✗ Missing in env'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#090B12] border border-white/[0.06]">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block mb-1">
                      Webhook Secret
                    </span>
                    <span
                      className={`font-semibold text-xs ${
                        gatewayStatus.hasWebhookSecret ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {gatewayStatus.hasWebhookSecret ? '✓ Configured in env' : '✗ Missing in env'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 leading-relaxed">
                  🔒 <strong>Zero-Trust Credential Security:</strong> Razorpay credentials stay strictly in secure server environment variables (<code className="font-mono text-white">NEXT_PUBLIC_RAZORPAY_KEY_ID</code>, <code className="font-mono text-white">RAZORPAY_KEY_SECRET</code>, <code className="font-mono text-white">RAZORPAY_WEBHOOK_SECRET</code>). For production safety, secrets are never stored in the database or exposed to the client browser.
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white">Pay After Proof (COD / Manual Verification)</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Allow customers to review pre-press digital proofs on WhatsApp before fulfilling payment.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCodEnabled(!codEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    codEnabled ? 'bg-brand-yellow' : 'bg-white/[0.1]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                      codEnabled ? 'translate-x-5' : 'translate-x-0 bg-white'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Shipping Tab */}
          {activeTab === 'shipping' && (
            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-white">Shipping &amp; Logistics Rules</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Default Courier Partner</label>
                  <select
                    value={defaultCourier}
                    onChange={(e) => setDefaultCourier(e.target.value)}
                    className={inputClass + ' cursor-pointer'}
                  >
                    <option value="Shiprocket">Shiprocket (Automated Multi-Courier)</option>
                    <option value="BlueDart">BlueDart Express</option>
                    <option value="Delhivery">Delhivery Surface/Air</option>
                    <option value="DTDC">DTDC Courier</option>
                    <option value="India Post">India Post Speed Post</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Standard Flat Delivery Fee (₹)</label>
                  <input
                    type="number"
                    value={flatShippingFee}
                    onChange={(e) => setFlatShippingFee(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Free Shipping Minimum Cart Value (₹)</label>
                <input
                  type="number"
                  value={freeShippingThreshold}
                  onChange={(e) => setFreeShippingThreshold(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-white">Automated Notifications</h2>
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">Instant WhatsApp Order Notification</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Sends live order confirmation and tracking link to customer WhatsApp.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">ENABLED</span>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">Admin Email Alert on New Order</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Sends copy of each order receipt to store notification email.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">ENABLED</span>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-white">Security &amp; Access Controls</h2>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-3 text-xs">
                <p className="font-semibold text-white">Cryptographic Session Verification</p>
                <p className="text-slate-400 leading-relaxed">
                  Administrative access is enforced via strict server-side cookie sessions. Every administrative API
                  route verifies authoritative role clearances before processing commands.
                </p>
                <div className="pt-2 text-[11px] text-brand-yellow flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-yellow animate-pulse" />
                  Brute-force protection: Active (account locks after 5 consecutive failed attempts)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
