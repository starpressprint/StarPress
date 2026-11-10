import React from "react";
import Link from "next/link";
import { Truck, PackageCheck, Clock, MapPin, Shield, ArrowLeft, Mail, Phone } from "lucide-react";
import { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy | Star Press",
  description:
    "Learn about Star Press Pan-India delivery timelines (3-7 days), carrier logistics (Blue Dart, Delhivery), moisture-proof packaging, and free shipping over ₹999.",
};

export default function ShippingDeliveryPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-base text-text-primary selection:bg-brand-yellow selection:text-black">
      <Header />

      <main className="flex-1 max-w-[900px] w-full mx-auto px-4 xs:px-6 lg:px-10 py-8 sm:py-10 md:py-16">
        {/* Navigation Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-text-secondary hover:text-brand-yellow transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Return to Home</span>
          </Link>
        </div>

        {/* Header Title */}
        <div className="space-y-4 mb-12 pb-8 border-b border-border-subtle">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-brand-yellow/40 bg-brand-yellow/10 text-brand-yellow text-xs font-bold uppercase tracking-wider">
            <Truck size={13} />
            <span>Pan-India Fulfillment • Updated January 2025</span>
          </div>

          <h1 className="font-display font-black text-2xl xs:text-3xl sm:text-5xl text-text-primary uppercase tracking-tight break-words">
            Shipping & Delivery Policy
          </h1>

          <p className="text-sm text-text-secondary leading-relaxed">
            Star Press Media Private Limited (&ldquo;Star Press&rdquo;) is dedicated to delivering high-volume commercial
            and bespoke custom prints securely to your doorstep across India. This Shipping and Delivery Policy sets out the
            fulfillment timelines, shipping carriers, packaging standards, and tracking protocols.
          </p>
        </div>

        {/* Content Body */}
        <div className="space-y-10 text-sm text-text-secondary leading-relaxed">
          {/* Section 1: Coverage & Logistics Partners */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              1. Delivery Network & Courier Partners
            </h2>
            <p>
              We provide comprehensive Pan-India logistics coverage, delivering to over <strong className="text-text-primary">26,000+ PIN codes</strong> across all 28 Indian States and 8 Union Territories.
            </p>
            <p>
              To ensure safety, speed, and real-time transit visibility, Star Press partners exclusively with verified Tier-1 express courier and freight networks:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-xl border border-border-subtle bg-bg-surface text-center">
                <span className="font-display font-bold text-text-primary text-sm block">Blue Dart</span>
                <span className="text-[11px] text-text-muted">Express Air Freight</span>
              </div>
              <div className="p-3.5 rounded-xl border border-border-subtle bg-bg-surface text-center">
                <span className="font-display font-bold text-text-primary text-sm block">Delhivery</span>
                <span className="text-[11px] text-text-muted">Surface & Express</span>
              </div>
              <div className="p-3.5 rounded-xl border border-border-subtle bg-bg-surface text-center">
                <span className="font-display font-bold text-text-primary text-sm block">DTDC</span>
                <span className="text-[11px] text-text-muted">Pan-India Cargo</span>
              </div>
              <div className="p-3.5 rounded-xl border border-border-subtle bg-bg-surface text-center">
                <span className="font-display font-bold text-text-primary text-sm block">India Post</span>
                <span className="text-[11px] text-text-muted">Speed Post Network</span>
              </div>
            </div>
          </section>

          {/* Section 2: Production vs Transit Timelines */}
          <section className="space-y-3 rounded-2xl border border-brand-yellow/30 bg-brand-yellow/5 p-6">
            <div className="flex items-center gap-2 text-brand-yellow font-bold uppercase text-xs tracking-wider">
              <Clock size={16} />
              <span>Turnaround Schedule</span>
            </div>
            <h2 className="font-display font-black text-lg text-text-primary uppercase">
              2. Total Order Turnaround Time
            </h2>
            <p className="text-text-secondary">
              Total turnaround consists of <strong className="text-text-primary">Production Manufacturing Time</strong> + <strong className="text-text-primary">Courier Transit Time</strong>:
            </p>
            <div className="space-y-3 pl-2 pt-2">
              <div className="space-y-1">
                <strong className="text-text-primary block text-sm">A. Production Manufacturing (At Press Facility):</strong>
                <p className="text-xs text-text-secondary">
                  • <strong className="text-text-primary">Standard Production:</strong> 2 to 4 business days (includes printing, UV/thermal lamination curing, die-cutting, inspection, and packing).<br />
                  • <strong className="text-text-primary">Priority 24h Rush:</strong> 24 to 48 hours expedited dispatch for qualifying orders approved before 2:00 PM IST.
                </p>
              </div>

              <div className="space-y-1">
                <strong className="text-text-primary block text-sm">B. Courier Transit Durations (Post-Dispatch):</strong>
                <p className="text-xs text-text-secondary">
                  • <strong className="text-text-primary">Metro Cities</strong> (Delhi NCR, Mumbai, Bengaluru, Chennai, Hyderabad, Kolkata): <strong className="text-brand-yellow">2 to 4 business days</strong>.<br />
                  • <strong className="text-text-primary">Tier 2 & Tier 3 Cities / Non-Metro:</strong> <strong className="text-brand-yellow">3 to 7 business days</strong>.<br />
                  • <strong className="text-text-primary">Remote Locations / North-East / J&K:</strong> <strong className="text-brand-yellow">5 to 9 business days</strong>.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Shipping Rates */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              3. Shipping Charges & Free Shipping Threshold
            </h2>
            <p>
              We believe in transparent pricing with zero surprise checkout fees:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-text-secondary">
              <li>
                <strong className="text-text-primary">Free Standard Shipping:</strong> Automatically applied to all orders with an order cart value of <strong className="text-brand-yellow">₹999 or more</strong>.
              </li>
              <li>
                <strong className="text-text-primary">Standard Delivery (Under ₹999):</strong> A flat standard rate (typically ₹49 – ₹99 depending on destination PIN code and total volumetric weight) calculated transparently during checkout.
              </li>
              <li>
                <strong className="text-text-primary">Bulk Commercial Freight:</strong> Heavy pallet orders (such as 10,000+ brochures or rigid display signs) qualify for subsidized surface cargo freight with GST e-Way bills generated automatically.
              </li>
            </ul>
          </section>

          {/* Section 4: Live Order Tracking */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              4. Dispatch Notifications & Live Shipment Tracking
            </h2>
            <p>
              As soon as your printed consignment passes our quality inspection gate and is scanned by the courier partner:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-text-secondary">
              <li>You receive an automated <strong className="text-text-primary">Email & SMS/WhatsApp notification</strong> containing the carrier name (e.g., Blue Dart, Delhivery) and your unique Air Waybill (AWB) tracking number.</li>
              <li>You can monitor the live transit journey directly through our website&apos;s <Link href="/account/orders" className="text-brand-yellow hover:underline font-semibold">Track Order Portal</Link>.</li>
            </ul>
          </section>

          {/* Section 5: Packaging & Transit Safety */}
          <section className="space-y-3 rounded-2xl border border-border-subtle bg-bg-surface p-6">
            <div className="flex items-center gap-2 text-brand-yellow font-bold uppercase text-xs tracking-wider">
              <PackageCheck size={16} />
              <span>Industrial Packaging Standards</span>
            </div>
            <h2 className="font-display font-black text-lg text-text-primary uppercase">
              5. Moisture-Proof & Impact-Resistant Packaging
            </h2>
            <p className="text-text-secondary">
              Printed paper, boards, and coated substrates are susceptible to moisture and corner crushing during inter-state transit. Every Star Press consignment is protected with:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-xs text-text-secondary">
              <li><strong className="text-text-primary">Moisture Barrier:</strong> Heat-sealed polypropylene shrink-wrap wrapping each bundle.</li>
              <li><strong className="text-text-primary">Shock Cushioning:</strong> High-density bubble wrap cushioning within outer boxes.</li>
              <li><strong className="text-text-primary">Heavy-Duty Outer Shell:</strong> Sturdy 5-ply corrugated carton boxes with reinforced corner edge protectors.</li>
            </ul>
          </section>

          {/* Section 6: Non-Delivery & Damaged Goods */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              6. Failed Delivery Attempts & Transit Damages
            </h2>
            <ul className="list-disc pl-6 space-y-2 text-text-secondary">
              <li>
                <strong className="text-text-primary">Delivery Attempts:</strong> Couriers make up to three delivery attempts and will reach out via the recipient phone number provided. If delivery fails due to incorrect address or customer unavailability, parcels will be temporarily held at the nearest courier hub before returning.
              </li>
              <li>
                <strong className="text-text-primary">Damage in Transit:</strong> If your outer box arrives visibly torn, crushed, or water-logged, please take photographs immediately before opening and alert our support team within <strong className="text-text-primary">48 hours of delivery</strong>. We will arrange a free rush reprint or issue a full refund under our <Link href="/cancellation-refund" className="text-brand-yellow hover:underline">Cancellation & Refund Policy</Link>.
              </li>
            </ul>
          </section>

          {/* Section 7: Support & Contact */}
          <section className="space-y-3 border-t border-border-subtle pt-8">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              7. Shipping Assistance & Inquiries
            </h2>
            <p>
              Need expedited dispatch, change of delivery address, or special freight handling? Contact our logistics desk:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-border-subtle bg-bg-surface flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-yellow/10 border border-brand-yellow/30 flex items-center justify-center text-brand-yellow">
                  <Mail size={18} />
                </div>
                <div>
                  <div className="text-xs text-text-muted">Logistics Desk Email</div>
                  <a href="mailto:starpress.print@gmail.com" className="text-sm font-bold text-text-primary hover:text-brand-yellow">
                    starpress.print@gmail.com
                  </a>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border-subtle bg-bg-surface flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-yellow/10 border border-brand-yellow/30 flex items-center justify-center text-brand-yellow">
                  <Phone size={18} />
                </div>
                <div>
                  <div className="text-xs text-text-muted">Customer Helpline</div>
                  <a href="tel:+917456849955" className="text-sm font-bold text-text-primary hover:text-brand-yellow">
                    +91 74568 49955
                  </a>
                </div>
              </div>
            </div>
            <p className="text-xs text-text-muted mt-2">
              Dispatch Origin: Star Press Printing Hub, Amoun, Khatima, Uttarakhand, India - 262308.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
