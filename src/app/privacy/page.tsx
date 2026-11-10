import React from "react";
import Link from "next/link";
import { Shield, Lock, FileCheck, ArrowLeft } from "lucide-react";
import { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Privacy & Artwork Confidentiality Policy | Star Press",
  description:
    "Learn how Star Press protects your personal data, customer information, and proprietary design files with complete industrial confidentiality.",
};

export default function PrivacyPolicyPage() {
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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border-subtle bg-bg-surface-alt text-text-secondary text-xs font-semibold uppercase tracking-wider">
            <Shield size={13} className="text-brand-yellow" />
            <span>Effective Date: 1 January 2025</span>
          </div>

          <h1 className="font-display font-black text-2xl xs:text-3xl sm:text-5xl text-text-primary uppercase tracking-tight break-words">
            Privacy Policy & Artwork Confidentiality
          </h1>

          <p className="text-sm text-text-secondary leading-relaxed">
            Star Press Media Private Limited (&ldquo;Star Press&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is
            committed to maintaining the absolute confidentiality, integrity, and security of
            both your personal data and your proprietary design and corporate marketing assets.
          </p>
        </div>

        {/* Content Body */}
        <div className="space-y-10 text-sm text-text-secondary leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              1. Information We Collect
            </h2>
            <p>
              When you interact with our website, place a commercial printing order, or request a
              bulk quotation, we collect:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-text-secondary">
              <li>
                <strong className="text-text-primary">Contact & Identity:</strong> Full Name, Email
                Address, Mobile & WhatsApp Number, Company / Entity Name.
              </li>
              <li>
                <strong className="text-text-primary">Billing & Taxation:</strong> 15-character Indian
                GSTIN and billing address for issuing official tax-compliant B2B invoices.
              </li>
              <li>
                <strong className="text-text-primary">Fulfillment Details:</strong> Physical shipping
                address, PIN code, and recipient contact for courier logistics.
              </li>
              <li>
                <strong className="text-text-primary">Artwork & Creative Files:</strong> Digital graphic
                files (PDF, AI, PSD, CDR, SVG, PNG) uploaded for prepress inspection and
                printing.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 rounded-2xl border border-brand-yellow/30 bg-brand-yellow/5 p-6">
            <div className="flex items-center gap-2 text-brand-yellow font-bold uppercase text-xs tracking-wider">
              <Lock size={15} />
              <span>Strict Non-Disclosure Guarantee</span>
            </div>
            <h2 className="font-display font-black text-lg text-text-primary uppercase">
              2. Confidentiality of Client Artwork & Intellectual Property
            </h2>
            <p>
              We recognize that your design files may contain unreleased product branding,
              confidential sales marketing campaigns, or proprietary corporate data. Star Press
              guarantees:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-text-secondary">
              <li>
                Your uploaded files are accessible solely to authorized prepress engineers, color
                calibrators, and machine press operators assigned to your order.
              </li>
              <li>
                We will <strong className="text-text-primary">NEVER</strong> sell, license, share,
                distribute, or display your design files to third parties or use them in public
                portfolios without explicit prior written consent.
              </li>
              <li>
                Files are archived on encrypted cold storage for up to 90 days solely to facilitate
                re-orders, after which they are permanently purged unless requested otherwise.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              3. How We Utilize Your Information
            </h2>
            <p>Your information is used strictly to:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-text-secondary">
              <li>Execute pre-flight file checks, calibrate color plates, and print your order.</li>
              <li>
                Send automated transaction status updates, soft proofs for approval, and SMS/WhatsApp
                courier tracking numbers.
              </li>
              <li>Generate valid GST Tax Invoices in accordance with Indian revenue laws.</li>
              <li>Prevent fraudulent transactions and secure our e-commerce platform.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              4. Payment Processing Security
            </h2>
            <p>
              Star Press does not store or process raw credit card numbers, debit card PINs, or
              net-banking credentials on our servers. All online monetary transactions are handled
              securely via RBI-authorized, PCI-DSS Level 1 certified payment gateways (such as
              Razorpay) utilizing 256-bit SSL cryptographic encryption.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              5. Third-Party Logistics & Courier Partners
            </h2>
            <p>
              To complete physical order fulfillment, we disclose necessary shipping information
              (Name, Delivery Address, PIN code, and Mobile Number) to trusted logistics carriers
              such as Blue Dart, Delhivery, and DTDC. These partners are legally restricted from
              using your details for any purpose other than executing delivery.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="font-display font-bold text-xl text-text-primary uppercase tracking-wider">
              6. Data Officer Contact
            </h2>
            <p>
              If you have any questions regarding this Privacy Policy, wish to inspect the personal
              data we hold, or request the immediate deletion of your archived print files, please
              contact:
            </p>
            <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 font-mono text-xs space-y-1 text-text-secondary">
              <div>
                <strong className="text-text-primary">Grievance & Privacy Officer:</strong> Star Press Media Pvt Ltd
              </div>
              <div>
                <strong className="text-text-primary">Email:</strong> starpress.print@gmail.com
              </div>
              <div>
                <strong className="text-text-primary">Address:</strong> Amoun, Khatima (Uttarakhand)
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
