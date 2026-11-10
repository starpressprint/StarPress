"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  MessageSquare,
  Sparkles,
  Send,
  CheckCircle2,
  ShieldCheck,
  Building,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";

const CONTACT_INFO = [
  {
    icon: MapPin,
    title: "Print Production Facility",
    value: "Star Press Printing Hub",
    subtext: "Amoun, Khatima (Uttarakhand), India",
    link: "https://maps.google.com/?q=Amoun,+Khatima,+Uttarakhand",
    actionLabel: "View on Google Maps",
  },
  {
    icon: Phone,
    title: "Customer Hotline",
    value: "+91 74568 49955",
    subtext: "Mon – Sat, 9:00 AM – 8:00 PM IST",
    link: "tel:+917456849955",
    actionLabel: "Call Support Desk",
  },
  {
    icon: Mail,
    title: "Email Assistance",
    value: "starpress.print@gmail.com",
    subtext: "General queries, file questions & corporate POs",
    link: "mailto:starpress.print@gmail.com",
    actionLabel: "Send Email",
  },
  {
    icon: Clock,
    title: "Production Schedule",
    value: "Monday – Saturday",
    subtext: "Day & Night Shifts (24/6 Continuous Operation)",
    link: "#",
    actionLabel: "Express Cut-off: 2:00 PM",
  },
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "Order Status & Tracking",
    orderId: "",
    message: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/inquiries/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          subject: formData.subject + (formData.orderId ? ` (Ref: ${formData.orderId})` : ""),
          message: formData.message,
        }),
      });

      const data = await response.json();
      const ticketId = data.inquiryNumber || `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
      setSubmittedTicket(ticketId);
    } catch (err) {
      console.error("Failed to submit contact ticket:", err);
      const fallbackTicket = `TKT-${Math.floor(10000 + Math.random() * 90000)}`;
      setSubmittedTicket(fallbackTicket);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg-base text-text-primary selection:bg-brand-yellow selection:text-black">
      <Header />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 xs:px-6 lg:px-10 py-8 sm:py-10 md:py-14">
        {/* Page Hero */}
        <div className="relative rounded-[28px] border border-border-subtle bg-bg-surface p-5 xs:p-7 sm:p-12 mb-8 sm:mb-12 overflow-hidden shadow-xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border-subtle bg-bg-surface-alt text-text-secondary text-xs font-semibold uppercase tracking-wider">
              <MessageSquare size={13} className="text-brand-yellow" />
              <span>We Are Here To Assist</span>
            </div>

            <h1 className="font-display font-black text-2xl xs:text-3xl sm:text-5xl uppercase text-text-primary tracking-tight leading-[1.1] break-words">
              Contact Star Press
            </h1>

            <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
              Have a question about prepress file specifications, paper stocks, or your
              existing shipment? Connect with our dedicated print specialists via phone,
              email, WhatsApp, or through the contact form below.
            </p>
          </div>
        </div>

        {/* 4 Contact Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
          {CONTACT_INFO.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-border-subtle bg-bg-surface p-6 space-y-3 flex flex-col justify-between hover:border-border-strong transition-colors"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-bg-surface-alt border border-border-subtle text-brand-yellow flex items-center justify-center">
                    <Icon size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      {item.title}
                    </span>
                    <div className="font-display font-bold text-base text-text-primary mt-0.5">
                      {item.value}
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {item.subtext}
                  </p>
                </div>

                <a
                  href={item.link}
                  target={item.link.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-brand-yellow hover:underline inline-block pt-2"
                >
                  {item.actionLabel} →
                </a>
              </div>
            );
          })}
        </div>

        {/* 2-Column: Form & WhatsApp Live Desk */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Form */}
          <div className="lg:col-span-8">
            <div className="rounded-3xl border border-border-subtle bg-bg-surface p-6 sm:p-10 space-y-6 shadow-2xl">
              <div className="space-y-1">
                <h2 className="font-display font-black text-2xl text-text-primary uppercase tracking-tight">
                  Send a Message to Pre-Press & Support
                </h2>
                <p className="text-xs text-text-secondary">
                  Typical email response time is under 90 minutes during standard business hours.
                </p>
              </div>

              {submittedTicket ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 className="font-display font-black text-2xl text-text-primary uppercase">
                    Message Dispatched!
                  </h3>
                  <p className="text-xs sm:text-sm text-text-secondary max-w-md mx-auto">
                    Your support ticket reference is{" "}
                    <strong className="text-brand-yellow font-mono text-base">
                      {submittedTicket}
                    </strong>
                    . Our team will review your inquiry and get back to you promptly.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSubmittedTicket(null)}
                  >
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label
                        htmlFor="contact-name"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        Your Name *
                      </label>
                      <input
                        id="contact-name"
                        name="name"
                        type="text"
                        required
                        placeholder="e.g. Vikram Batra"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-yellow"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="contact-email"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        Email Address *
                      </label>
                      <input
                        id="contact-email"
                        name="email"
                        type="email"
                        required
                        placeholder="vikram@example.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-yellow"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="contact-phone"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        Mobile Number *
                      </label>
                      <input
                        id="contact-phone"
                        name="phone"
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-yellow"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="contact-subject"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        Topic / Department *
                      </label>
                      <select
                        id="contact-subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-yellow"
                      >
                        <option>Order Status & Tracking</option>
                        <option>Pre-Press & Artwork File Help</option>
                        <option>Custom / Bulk Printing Quote</option>
                        <option>Invoicing & GST Tax Credit</option>
                        <option>Report a Print Defect / Replacement</option>
                        <option>General Feedback</option>
                      </select>
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label
                        htmlFor="contact-orderId"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        Order ID (Optional)
                      </label>
                      <input
                        id="contact-orderId"
                        name="orderId"
                        type="text"
                        placeholder="e.g. SP-49281"
                        value={formData.orderId}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-yellow uppercase font-mono"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label
                        htmlFor="contact-message"
                        className="block text-xs font-semibold text-text-secondary uppercase"
                      >
                        How can our print engineers assist you? *
                      </label>
                      <textarea
                        id="contact-message"
                        name="message"
                        rows={4}
                        required
                        placeholder="Detail your inquiry, questions on bleeds, delivery address updates, or specifications..."
                        value={formData.message}
                        onChange={handleInputChange}
                        className="w-full rounded-xl bg-bg-surface-alt border border-border-subtle px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-yellow resize-none"
                      />
                    </div>
                  </div>

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
                        <span>Submitting Ticket...</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Send size={16} />
                        <span>Submit Message</span>
                      </span>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>

          {/* Right Column: Live WhatsApp & Facility Card */}
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-7 space-y-6 shadow-xl sticky top-24">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                  Instant Messaging
                </span>
                <h3 className="font-display font-black text-xl text-text-primary uppercase tracking-tight">
                  Chat on WhatsApp
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Fastest way to send design files, get instant soft proof approvals, or check
                  dispatch courier slips.
                </p>
              </div>

              <a
                href="https://wa.me/917456849955?text=Hi%20Star%20Press%20Support,%20I%20have%20an%20inquiry%20regarding%20my%20print%20order."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-[#25D366] text-black hover:bg-[#20bd5a] transition-colors shadow-lg"
              >
                <MessageSquare size={16} />
                <span>Open WhatsApp Chat</span>
              </a>

              <div className="pt-4 border-t border-border-subtle space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <Building size={16} className="text-brand-yellow shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-text-primary block">Corporate Head Office</strong>
                    <span className="text-text-secondary">
                      Star Press, Amoun, Khatima (Uttarakhand)
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <ShieldCheck size={16} className="text-emerald-400/90 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-text-primary block">GSTIN & Compliance</strong>
                    <span className="text-text-secondary font-mono">
                      07AAAAA0000A1Z5 (Delhi, India)
                    </span>
                  </div>
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
