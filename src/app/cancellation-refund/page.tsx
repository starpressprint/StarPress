import React from "react";
import Link from "next/link";
import { RotateCcw, ShieldCheck, Clock, AlertCircle, ArrowLeft, Mail, Phone } from "lucide-react";
import { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy | Star Press",
  description:
    "Review Star Press cancellation rules, 100% quality assurance reprint guarantee, return process, and 5-7 day refund turnaround timelines.",
};

export default function CancellationRefundPolicyPage() {
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
            <RotateCcw size={13} />
            <span>Customer Protection • Updated January 2025</span>
          </div>

          <h1 className="font-display font-black text-2xl xs:text-3xl sm:text-5xl text-text-primary uppercase tracking-tight break-words">
            Cancellation & Refund Policy
          </h1>

          <p className="text-sm text-text-secondary leading-relaxed">
            At Star Press Media Private Limited (&ldquo;Star Press&rdquo;), we take pride in delivering industrial-grade
            print precision, accurate color profiles, and reliable fulfillment. This Cancellation and Refund Policy outlines
            the terms under which orders may be cancelled, returned, reprinted, or refunded.
          </p>
        </div>

        {/* Policy Body */}
        <div className="space-y-10 text-sm text-text-secondary leading-relaxed">
          {/* Section 1: Order Cancellation Policy */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              1. Order Cancellation Guidelines
            </h2>
            <p>
              Due to the bespoke, customized nature of commercial and personalized printing, cancellation terms depend on the current production stage of your order:
            </p>
            <div className="space-y-3 pl-2">
              <div className="p-4 rounded-xl border border-border-subtle bg-bg-surface space-y-1">
                <span className="text-text-primary font-bold block text-sm">
                  A. Prior to Proof Approval or Press Setup (Eligible for 100% Refund)
                </span>
                <p className="text-xs text-text-secondary">
                  If you wish to cancel your order before you have approved the digital prepress proof (soft proof) or before physical manufacturing has commenced, you are eligible for an immediate <strong className="text-text-primary">100% full refund</strong> with zero cancellation penalties.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border-subtle bg-bg-surface space-y-1">
                <span className="text-text-primary font-bold block text-sm">
                  B. After Digital Proof Approval & Plate Imposition
                </span>
                <p className="text-xs text-text-secondary">
                  Once you have approved your digital proof and printing plates, die-cut blades, or substrate rolls have been allocated to the machine press, custom orders cannot be cancelled or altered because these raw materials are permanently dedicated to your job.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border-subtle bg-bg-surface space-y-1">
                <span className="text-text-primary font-bold block text-sm">
                  C. Standard Non-Custom Goods (Stock Supplies)
                </span>
                <p className="text-xs text-text-secondary">
                  Orders containing non-customized stock items (e.g., standard generic stationery, display stands without prints) can be cancelled anytime prior to shipment dispatch for a full refund.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: 100% Quality Assurance & Free Reprint Guarantee */}
          <section className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
            <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase text-xs tracking-wider">
              <ShieldCheck size={16} />
              <span>100% Quality Assurance Guarantee</span>
            </div>
            <h2 className="font-display font-black text-lg text-text-primary uppercase">
              2. Defective, Damaged, or Incorrect Prints
            </h2>
            <p className="text-text-secondary">
              While bespoke custom prints cannot be returned for buyer&apos;s change of mind once manufactured, Star Press provides a complete guarantee against manufacturing flaws and shipping damages.
            </p>
            <p className="text-text-primary font-medium">
              You are entitled to an immediate resolution if:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-xs text-text-secondary">
              <li>There is an obvious printing defect attributable to us (e.g., ink streaks, color banding, missing layers).</li>
              <li>The incorrect paper stock, finish (matte vs. gloss), or size was supplied.</li>
              <li>Cutting or folding deviates beyond our industry-standard mechanical tolerance of ±1.5mm.</li>
              <li>The goods were crushed, bent, or water-damaged during transit by our logistics partners.</li>
            </ul>
          </section>

          {/* Section 3: Return & Claim Process */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              3. How to File a Claim (Within 48–72 Hours)
            </h2>
            <p>
              To report damaged or defective merchandise:
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-text-secondary">
              <li>
                <strong className="text-text-primary">Notify Us Promptly:</strong> Contact our support desk within <strong className="text-text-primary">48 to 72 hours of delivery</strong> via email (<a href="mailto:starpress.print@gmail.com" className="text-brand-yellow hover:underline">starpress.print@gmail.com</a>) or phone / WhatsApp (<a href="tel:+917456849955" className="text-brand-yellow hover:underline">+91 74568 49955</a>).
              </li>
              <li>
                <strong className="text-text-primary">Provide Evidence:</strong> Include your Order Number along with clear photographs or a short video demonstrating the defect or package transit damage.
              </li>
              <li>
                <strong className="text-text-primary">Resolution Choice:</strong> Upon quick verification by our quality control engineers, you may choose:
                <ul className="list-disc pl-6 mt-1 space-y-1">
                  <li><strong className="text-text-primary">Free Rush Reprint:</strong> We will reprint your order with priority press scheduling and express dispatch at zero cost to you; OR</li>
                  <li><strong className="text-text-primary">Full Monetary Refund:</strong> We will process a complete refund back to your source account.</li>
                </ul>
              </li>
            </ol>
          </section>

          {/* Section 4: Refund Method & Timelines (Razorpay Compliance Focus) */}
          <section className="space-y-3 rounded-2xl border border-brand-yellow/30 bg-brand-yellow/5 p-6">
            <div className="flex items-center gap-2 text-brand-yellow font-bold uppercase text-xs tracking-wider">
              <Clock size={16} />
              <span>Turnaround Guarantee</span>
            </div>
            <h2 className="font-display font-black text-lg text-text-primary uppercase">
              4. Refund Method & Processing Timelines
            </h2>
            <p className="text-text-secondary">
              Once an order cancellation or quality refund is approved by our billing team:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-text-secondary">
              <li>
                <strong className="text-text-primary">Original Payment Method:</strong> All refunds are automatically initiated back to the original payment source utilized during checkout (Credit Card, Debit Card, UPI, Net Banking, or Digital Wallet via Razorpay).
              </li>
              <li>
                <strong className="text-text-primary">Processing Timeline:</strong> Refunds are initiated within <strong className="text-text-primary">24 hours</strong> of approval. Depending on your bank or card issuer, the credited funds will reflect in your account within <strong className="text-brand-yellow">5 to 7 working days</strong>.
              </li>
              <li>
                <strong className="text-text-primary">Notification:</strong> You will receive an automated email confirmation and SMS containing your unique Razorpay Refund Reference ID as soon as the refund is dispatched.
              </li>
            </ul>
          </section>

          {/* Section 5: Non-Refundable Scenarios */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              5. Non-Refundable Scenarios
            </h2>
            <p>Refunds or free reprints cannot be issued for:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-text-secondary">
              <li>Typographical errors, spelling mistakes, or low-resolution pixelated artwork approved by the customer in the final digital soft proof.</li>
              <li>Subtle monitor-to-print color shifts (RGB screen vs. CMYK press inks) within standard Fogra39 tolerance (≤3ΔE).</li>
              <li>Delivery delays caused by incorrect shipping address, invalid phone numbers provided by the customer, or recipient unavailability.</li>
            </ul>
          </section>

          {/* Section 6: Contact Information */}
          <section className="space-y-3 border-t border-border-subtle pt-8">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              6. Need Help or Have Questions?
            </h2>
            <p>
              Our support team is ready to assist you with order cancellations, quality audits, and billing inquiries:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-border-subtle bg-bg-surface flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-yellow/10 border border-brand-yellow/30 flex items-center justify-center text-brand-yellow">
                  <Mail size={18} />
                </div>
                <div>
                  <div className="text-xs text-text-muted">Email Support</div>
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
                  <div className="text-xs text-text-muted">Helpline (Mon–Sat, 9AM–8PM)</div>
                  <a href="tel:+917456849955" className="text-sm font-bold text-text-primary hover:text-brand-yellow">
                    +91 74568 49955
                  </a>
                </div>
              </div>
            </div>
            <p className="text-xs text-text-muted mt-2">
              Physical Facility: Star Press Printing Hub, Amoun, Khatima, Uttarakhand, India - 262308.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
