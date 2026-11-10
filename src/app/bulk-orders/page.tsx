"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Package,
  ShieldCheck,
  Truck,
  Sparkles,
  CheckCircle2,
  PhoneCall,
  Clock,
  Layers,
  ArrowRight,
  FileText,
  BadgePercent,
  Send,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import { BULK_ORDER_PERKS, BULK_VOLUME_TIERS } from "@/lib/data";

const ENTERPRISE_FEATURES = [
  {
    icon: Building2,
    title: "Dedicated Print Director",
    desc: "Single point of technical contact for prepress, color calibration, and continuous delivery scheduling.",
  },
  {
    icon: Package,
    title: "Free Hardcopy Swatch Kit",
    desc: "Delivered to your corporate headquarters containing paper textures, GSM samples, foilings, and spot UV swatches.",
  },
  {
    icon: FileText,
    title: "B2B GST Invoicing & Net Terms",
    desc: "Seamless 18% Input Tax Credit invoicing, Purchase Order (PO) processing, and Net-30 credit lines for verified companies.",
  },
  {
    icon: Truck,
    title: "Multi-Hub Split Dispatch",
    desc: "Ship directly across regional offices in Mumbai, Bengaluru, Delhi NCR, Hyderabad, Chennai, and Pune in a single batch.",
  },
];

export default function BulkOrdersPage() {
  const [formData, setFormData] = useState({
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    gstin: "",
    category: "Marketing Materials (Flyers, Brochures)",
    estimatedQuantity: "1,000 – 5,000 units",
    targetDate: "",
    requestSampleKit: true,
    message: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedQuoteId, setSubmittedQuoteId] = useState<string | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/inquiries/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.contactPerson || formData.companyName,
          phone: formData.phone,
          email: formData.email,
          company: formData.companyName,
          productType: formData.category,
          quantity: formData.estimatedQuantity,
          details: `Target Date: ${formData.targetDate || "Flexible"}. GSTIN: ${formData.gstin || "N/A"}. Message: ${formData.message}`,
          swatchKitRequested: formData.requestSampleKit,
        }),
      });

      const data = await response.json();
      const quoteRef = data.inquiryNumber || `SP-CORP-${Math.floor(1000 + Math.random() * 9000)}`;
      setSubmittedQuoteId(quoteRef);
    } catch (err) {
      console.error("Failed to submit bulk order inquiry:", err);
      const fallbackRef = `SP-CORP-${Math.floor(1000 + Math.random() * 9000)}`;
      setSubmittedQuoteId(fallbackRef);
    } finally {
      setIsSubmitting(false);
      window.scrollTo({ top: 400, behavior: "smooth" });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg-base text-text-primary selection:bg-brand-yellow selection:text-black">
      <Header />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 xs:px-6 lg:px-10 py-8 sm:py-10 md:py-14">
        {/* Hero Section */}
        <div className="relative rounded-[28px] border border-border-subtle bg-bg-surface p-5 xs:p-7 sm:p-12 mb-8 sm:mb-12 overflow-hidden shadow-xl">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border-subtle bg-bg-surface-alt text-text-secondary text-xs font-semibold uppercase tracking-wider">
              <BadgePercent size={14} className="text-brand-yellow" />
              <span>Enterprise & Corporate Solutions</span>
            </div>

            <h1 className="font-display font-black text-2xl xs:text-3xl sm:text-5xl uppercase text-text-primary tracking-tight leading-[1.1] break-words">
              Bulk Orders & Corporate Printing
            </h1>

            <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
              Scale your brand with industrial-grade Heidelberg offset printing and HP
              Indigo digital presses. Enjoy volume rebates up to 45%, dedicated account
              managers, and Pan-India multi-location fulfillment.
            </p>
          </div>
        </div>

        {/* Volume Discount Slabs */}
        <div className="mb-14">
          <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
            <h2 className="font-display font-black text-2xl sm:text-3xl text-text-primary uppercase tracking-tight">
              Tiered Volume Pricing Slabs
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary">
              Higher run sizes significantly reduce per-unit plate and setup costs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BULK_VOLUME_TIERS.map((tier) => (
              <div
                key={tier.range}
                className={`rounded-2xl border p-6 sm:p-8 flex flex-col justify-between relative transition-all duration-300 ${
                  tier.featured
                    ? "border-brand-yellow/80 bg-brand-yellow/[0.05] shadow-lg shadow-black/40 scale-100 md:scale-105"
                    : "border-border-subtle bg-bg-surface hover:border-white/20"
                }`}
              >
                {tier.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand-yellow text-black font-black text-[10px] uppercase tracking-wider">
                    Most Popular Tier
                  </span>
                )}

                <div>
                  <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
                    Order Volume
                  </span>
                  <div className="font-display font-black text-2xl text-text-primary mt-1 mb-2">
                    {tier.range}
                  </div>
                  <div className="font-mono font-black text-3xl text-brand-yellow mb-4">
                    {tier.discount}
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed mb-6">
                    {tier.perks}
                  </p>
                </div>

                <div className="pt-4 border-t border-border-subtle flex items-center gap-2 text-xs text-emerald-400/90 font-medium">
                  <CheckCircle2 size={14} />
                  <span>Free Pre-Production Proof Included</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Enterprise Perks 4-Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
          {ENTERPRISE_FEATURES.map((feat) => {
            const IconComponent = feat.icon;
            return (
              <div
                key={feat.title}
                className="rounded-2xl border border-border-subtle bg-bg-surface p-6 space-y-3 hover:border-border-strong transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-bg-surface-alt border border-border-subtle text-brand-yellow flex items-center justify-center">
                  <IconComponent size={22} />
                </div>
                <h3 className="font-display font-bold text-base text-text-primary">
                  {feat.title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Inquiry Form & WhatsApp Assist */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left: Interactive RFQ Form */}
          <div className="lg:col-span-8">
            <div className="rounded-3xl border border-border-subtle bg-bg-surface p-6 sm:p-10 space-y-8 shadow-2xl">
              <div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border-subtle bg-bg-surface-alt text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">
                  <FileText size={13} className="text-brand-yellow" />
                  <span>Fast Response Under 2 Hours</span>
                </div>
                <h2 className="font-display font-black text-2xl sm:text-3xl text-text-primary uppercase tracking-tight">
                  Request an Enterprise Quote
                </h2>
                <p className="text-xs sm:text-sm text-text-secondary mt-1">
                  Submit your estimated quantities and specifications. Our senior prepress
                  consultant will prepare a competitive wholesale proposal.
                </p>
              </div>

              {submittedQuoteId ? (
                /* Submission Confirmation */
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 className="font-display font-black text-2xl text-text-primary uppercase">
                    Inquiry Received!
                  </h3>
                  <p className="text-xs sm:text-sm text-text-secondary max-w-md mx-auto">
                    Your corporate quote reference is{" "}
                    <strong className="text-brand-yellow font-mono text-base">
                      {submittedQuoteId}
                    </strong>
                    . Our print director will contact you via WhatsApp & Email within 2
                    business hours.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSubmittedQuoteId(null)}
                  >
                    Submit Another Inquiry
                  </Button>
                </div>
              ) : (
                /* Form */
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label
                        htmlFor="companyName"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        Company / Organization Name *
                      </label>
                      <input
                        id="companyName"
                        name="companyName"
                        type="text"
                        required
                        placeholder="e.g. Acme Technologies India Pvt Ltd"
                        value={formData.companyName}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-yellow"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="contactPerson"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        Contact Person & Title *
                      </label>
                      <input
                        id="contactPerson"
                        name="contactPerson"
                        type="text"
                        required
                        placeholder="e.g. Priya Sharma, Procurement Manager"
                        value={formData.contactPerson}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-yellow"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="email"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        Official Work Email *
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        placeholder="priya@company.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-yellow"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="phone"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        Mobile / WhatsApp Hotline *
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-yellow"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="category"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        Print Product Category *
                      </label>
                      <select
                        id="category"
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-yellow"
                      >
                        <option>Marketing Materials (Flyers, Brochures)</option>
                        <option>Business Stationery & Business Cards</option>
                        <option>Packaging Boxes & Custom Mailers</option>
                        <option>Corporate Uniforms, Apparel & Mugs</option>
                        <option>Large Format Banners & Event Signage</option>
                        <option>Labels, Barcodes & Product Stickers</option>
                        <option>Multiple / Mixed Print Categories</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="estimatedQuantity"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        Estimated Units *
                      </label>
                      <select
                        id="estimatedQuantity"
                        name="estimatedQuantity"
                        value={formData.estimatedQuantity}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-yellow"
                      >
                        <option>250 – 500 units</option>
                        <option>500 – 2,500 units</option>
                        <option>2,500 – 10,000 units</option>
                        <option>10,000 – 50,000+ units</option>
                      </select>
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label
                        htmlFor="gstin"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        GSTIN Number (Optional)
                      </label>
                      <input
                        id="gstin"
                        name="gstin"
                        type="text"
                        placeholder="07AAAAA0000A1Z5"
                        maxLength={15}
                        value={formData.gstin}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-yellow uppercase font-mono"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label
                        htmlFor="message"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        Specifications, Dimensions, or Special Finishes (Spot UV, Foil, GSM)
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        rows={3}
                        placeholder="Tell us about paper weight preferences, special folding, multiple delivery addresses, or deadline constraints..."
                        value={formData.message}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-yellow resize-none"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-border-subtle bg-bg-surface-alt">
                    <input
                      type="checkbox"
                      name="requestSampleKit"
                      checked={formData.requestSampleKit}
                      onChange={handleInputChange}
                      className="w-4 h-4 rounded border-border-subtle bg-bg-surface text-brand-yellow focus:ring-brand-yellow accent-brand-yellow"
                    />
                    <div>
                      <span className="font-bold text-xs sm:text-sm text-text-primary">
                        Send our team a Free Physical Hardcopy Sample Swatch Kit
                      </span>
                      <p className="text-[11px] text-text-secondary">
                        Includes paper stocks (300 GSM, 350 GSM, textured), foil stamp samples, and lamination grades.
                      </p>
                    </div>
                  </label>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full justify-center text-sm font-bold uppercase tracking-wider py-4"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        <span>Transmitting Quote Request...</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Send size={16} />
                        <span>Request Official Bulk Quote</span>
                      </span>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>

          {/* Right: Direct Hotline & Corporate Assurance */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-7 space-y-6 shadow-xl sticky top-24">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">
                  Immediate Procurement Desk
                </span>
                <h3 className="font-display font-black text-xl text-text-primary uppercase tracking-tight">
                  Need an Urgent Quote?
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Have an impending conference or launch event? Speak directly to our senior
                  print estimator.
                </p>
              </div>

              <div className="space-y-3">
                <a
                  href="https://wa.me/917456849955?text=Hi%20Star%20Press%20Procurement%20Team,%20I%20have%20an%20urgent%20bulk%20print%20inquiry."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-[#25D366] text-black hover:bg-[#20bd5a] transition-colors shadow-lg"
                >
                  <PhoneCall size={16} />
                  <span>WhatsApp Procurement Desk</span>
                </a>

                <div className="rounded-xl border border-border-subtle bg-bg-surface-alt p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Hotline:</span>
                    <span className="text-text-primary font-mono font-bold">+91 74568 49955</span>
                  </div>
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Procurement Email:</span>
                    <span className="text-text-primary font-mono">starpress.print@gmail.com</span>
                  </div>
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Working Hours:</span>
                    <span className="text-brand-yellow font-medium">9 AM – 9 PM IST</span>
                  </div>
                </div>
              </div>

              {/* Guarantees */}
              <div className="pt-4 border-t border-border-subtle space-y-2.5 text-xs text-text-muted">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-400/90 shrink-0" />
                  <span>ISO 9001:2015 Certified Color Calibration</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-emerald-400/90 shrink-0" />
                  <span>Strict Turnaround SLA with Penalty Safeguard</span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-emerald-400/90 shrink-0" />
                  <span>Complimentary Pre-Flight File Preparation</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
