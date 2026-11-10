import React from "react";
import Link from "next/link";
import { FileText, Scale, AlertTriangle, ArrowLeft } from "lucide-react";
import { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Terms & Conditions | Star Press Commercial Printing",
  description:
    "Review Star Press terms of service, proof approval guidelines, color accuracy standards, and reprint policies for commercial printing.",
};

export default function TermsPage() {
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
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-brand-yellow/40 bg-brand-yellow/10 text-brand-yellow text-xs font-bold uppercase tracking-wider">
            <Scale size={13} />
            <span>Commercial Terms • Updated January 2025</span>
          </div>

          <h1 className="font-display font-black text-2xl xs:text-3xl sm:text-5xl text-text-primary uppercase tracking-tight break-words">
            Terms & Conditions of Service
          </h1>

          <p className="text-sm text-text-secondary leading-relaxed">
            Please read these Terms and Conditions carefully before commissioning print production
            with Star Press Media Private Limited (&ldquo;Star Press&rdquo;). By placing an order or approving
            a pre-press proof, you agree to be bound by these provisions.
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-10 text-sm text-text-secondary leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              1. Digital Proof Approval & Production Authorization
            </h2>
            <p>
              For any order containing customer-provided artwork, Star Press generates a digital
              pre-press proof (soft proof) for customer review. Production commences solely upon your
              affirmative written approval (via Email, Website confirmation, or WhatsApp).
            </p>
            <p className="text-text-primary font-medium">
              Your approval constitutes final verification of spelling, grammar, phone numbers,
              QR codes, visual layouts, and fold orientations. Star Press is not liable for errors
              present in the approved proof file.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 rounded-2xl border border-border-subtle bg-bg-surface p-6">
            <h2 className="font-display font-bold text-lg text-text-primary uppercase">
              2. Color Calibration & Screen RGB vs Print CMYK
            </h2>
            <p>
              Due to physical variations between back-lit computer/mobile screens (which display RGB
              light) and physical printing inks (which reflect CMYK pigments onto paper substrates),
              printed colors may exhibit subtle chromatic differences compared to on-screen previews.
            </p>
            <p className="text-xs text-text-muted">
              Star Press calibrates all commercial presses to ISO 12647-2 / FogRA 39 standards. A
              color difference delta (ΔE) within industry-standard tolerance margins (3ΔE) is normal
              and does not constitute a printing defect. For exact brand matching, customers are
              encouraged to specify Pantone Matching System (PMS) spot codes.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              3. Cutting, Folding & Mechanical Tolerances
            </h2>
            <p>
              Industrial paper guillotines and die-cutting machines operate with mechanical tolerances.
              A shifting margin of up to <strong>±1.5mm</strong> may occur during high-volume trimming
              and folding. All critical design elements (text, borders, logos) must be placed within
              our designated Safe Zone (at least 3.5mm from the trim line) with a 3mm external bleed.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              4. Turnaround Times & Courier Transit
            </h2>
            <p>
              Production turnaround times represent the duration required to manufacture, inspect,
              and pack your order. Production begins on the business day following receipt of proof
              approval (orders approved after 2:00 PM IST commence the next business day).
            </p>
            <p>
              While Star Press partners exclusively with premier logistics services (Blue Dart,
              Delhivery, DTDC), courier transit times are external to manufacturing and may be
              impacted by regional weather conditions, regional holidays, or force majeure events.
            </p>
          </section>

          {/* Section 5 */}
          <section id="guarantee" className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 scroll-mt-28">
            <h2 className="font-display font-bold text-lg text-emerald-400 uppercase">
              5. 100% Quality Assurance & Free Reprint Policy
            </h2>
            <p className="text-text-secondary">
              Because custom-printed goods cannot be restocked or resold, orders cannot be cancelled
              or returned for buyer&apos;s remorse once printing has commenced.
            </p>
            <p className="text-text-primary">
              However, if your delivered order has a genuine manufacturing defect attributable to
              Star Press (such as streaking ink, incorrect paper stock, cutting misregistration
              exceeding tolerance, or transit packaging damage), notify our team within{" "}
              <strong>48 hours of delivery</strong> with photographic evidence. We will rush-reprint
              and dispatch your entire order at zero cost.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              6. Intellectual Property & Customer Indemnity
            </h2>
            <p>
              The customer warrants that they hold all necessary copyrights, trademarks, licenses,
              and permissions for all text, photographs, graphics, and brand assets submitted for
              printing. The customer agrees to defend and indemnify Star Press from any claims,
              damages, or legal liabilities arising from third-party copyright or trademark
              infringements.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              7. Governing Law & Jurisdiction
            </h2>
            <p>
              These Terms and Conditions shall be governed by and construed in accordance with the
              laws of the Republic of India. Any disputes arising under these terms shall be subject
              to the exclusive jurisdiction of the competent courts located in Uttarakhand, India.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
