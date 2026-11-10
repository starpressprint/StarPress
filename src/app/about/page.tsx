import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Printer,
  Sparkles,
  ShieldCheck,
  Award,
  Zap,
  Leaf,
  Users,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "About Star Press | Premier Printing Press in Khatima, Uttarakhand",
  description:
    "Learn about Star Press in Khatima, Uttarakhand: Advanced commercial offset, HP Indigo digital printing, custom signage fabrication, and fast Pan-India dispatch.",
};

const STATS = [
  { value: "15+", label: "Years of Craftsmanship", color: "text-brand-yellow" },
  { value: "10M+", label: "Prints Delivered", color: "text-brand-yellow" },
  { value: "5,000+", label: "Corporate Clients", color: "text-brand-yellow" },
  { value: "99.8%", label: "On-Time Dispatch Rate", color: "text-emerald-400" },
];

const PRESS_MACHINERY = [
  {
    name: "Heidelberg Speedmaster XL 75",
    type: "5-Color Commercial Offset Press",
    specs: "15,000 sheets/hour • FogRA 39 color calibration • Aqueous inline coater",
    description:
      "Our flagship heavy-production workhorse engineered in Germany, delivering ultra-consistent Pantone reproduction for business collateral and high-volume corporate runs.",
  },
  {
    name: "HP Indigo 7K Digital Press",
    type: "Digital Liquid Electrophotography",
    specs: "Up to 7 ink stations • White ink • Variable data & barcode serialization",
    description:
      "The global benchmark for short-run digital offset quality. Eliminates plate setup times, enabling same-day and 24-hour turnaround on business cards and packaging prototypes.",
  },
  {
    name: "Scodix Ultra Digital Enhancement Press",
    type: "Sensory Foil & Spot UV Finisher",
    specs: "High-build tactile 3D polymer • Hot foil stamping • Crystal gloss",
    description:
      "Brings prints to life with tangible sensory textures. Creates raised glossy spot UV coatings and metallic foils without metal dies.",
  },
  {
    name: "Kongsberg Precision Cutting Table",
    type: "Automated Digital Die-Cutter",
    specs: "Multi-axis optical eye • Creasing & routing • Rigid materials up to 50mm",
    description:
      "Provides micron-precise kiss-cutting for sticker sheets, vinyl lettering, acrylic signage, and custom corrugated mailer box packaging.",
  },
];

const VALUES = [
  {
    icon: Award,
    title: "Uncompromising Color Fidelity",
    desc: "Every press run is densitometer-monitored to ensure zero color shift across batches, matching brand standards consistently.",
  },
  {
    icon: Leaf,
    title: "Eco-Conscious Printing",
    desc: "We exclusively source FSC-certified sustainable papers, non-toxic vegetable soy inks, and recycle 100% of our paper trimmings.",
  },
  {
    icon: Zap,
    title: "24-Hour Dispatch Capability",
    desc: "Our high-speed digital print cell and automated finishing workflows mean your deadline-critical projects ship without delay.",
  },
  {
    icon: ShieldCheck,
    title: "Free Pre-Flight Verification",
    desc: "Our human prepress team audits your resolution, bleeds, and color space before printing to eliminate errors.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-base text-text-primary selection:bg-brand-yellow selection:text-black">
      <Header />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 xs:px-6 lg:px-10 py-8 sm:py-10 md:py-14">
        {/* Hero Section */}
        <div className="relative rounded-[28px] border border-border-subtle bg-bg-surface p-5 xs:p-7 sm:p-12 mb-10 sm:mb-16 overflow-hidden shadow-xl">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border-subtle bg-bg-surface-alt text-text-secondary text-xs font-semibold uppercase tracking-wider">
              <Sparkles size={14} className="text-brand-yellow" />
              <span>Craftsmanship Meets Modern Engineering</span>
            </div>

            <h1 className="font-display font-black text-2xl xs:text-3xl sm:text-5xl uppercase text-text-primary tracking-tight leading-[1.1] break-words">
              Turning Digital Ideas Into Tangible Perfection
            </h1>

            <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
              Based in Amoun, Khatima (Uttarakhand), Star Press is an advanced commercial and bespoke printing facility.
              We combine legendary German offset engineering with bleeding-edge digital print technology, serving businesses
              across Khatima, Kumaon, Uttarakhand and shipping nationwide.
            </p>
          </div>
        </div>

        {/* Statistics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {STATS.map((st) => (
            <div
              key={st.label}
              className="rounded-2xl border border-border-subtle bg-bg-surface p-6 text-center space-y-1 hover:border-border-strong transition-colors"
            >
              <div className={`font-mono font-black text-3xl sm:text-4xl ${st.color}`}>
                {st.value}
              </div>
              <div className="text-xs text-text-secondary font-medium uppercase tracking-wider">
                {st.label}
              </div>
            </div>
          ))}
        </div>

        {/* The Story & Infrastructure */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center mb-20">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border-subtle bg-bg-surface-alt text-text-secondary text-xs font-semibold uppercase tracking-wider">
              <Printer size={13} className="text-brand-yellow" />
              <span>Our Heritage</span>
            </div>

            <h2 className="font-display font-black text-2xl sm:text-4xl uppercase text-text-primary tracking-tight">
              15+ Years of Dedicated Print Innovation
            </h2>

            <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
              What started as a boutique press in 2011 has expanded into a 25,000 sq. ft.
              integrated printing facility equipped with temperature-controlled paper
              conditioning, computerized ink-dispensing stations, and automated finishing lines.
            </p>

            <p className="text-sm text-text-secondary leading-relaxed">
              Whether you are an ambitious startup needing 250 premium velvety business cards
              or a national retail chain executing a 50,000-unit flex banner rollout across 40
              cities, our experienced team ensures your colors pop and your deadlines are honored.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-text-primary">
                <CheckCircle2 size={16} className="text-emerald-400/90 shrink-0" />
                <span>In-House Pre-Press Lab</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-primary">
                <CheckCircle2 size={16} className="text-emerald-400/90 shrink-0" />
                <span>ISO 12647 Color Standard</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-primary">
                <CheckCircle2 size={16} className="text-emerald-400/90 shrink-0" />
                <span>Pan-India Air Logistics</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-primary">
                <CheckCircle2 size={16} className="text-emerald-400/90 shrink-0" />
                <span>100% Satisfaction Pledge</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative rounded-3xl border border-border-subtle overflow-hidden bg-bg-surface p-2 shadow-2xl">
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-bg-surface-alt">
                <Image
                  src="/images/hero-composition.jpg"
                  alt="Star Press printing facility and products"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Machinery & Technology Fleet */}
        <div id="equipment" className="mb-20 scroll-mt-24">
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
            <h2 className="font-display font-black text-2xl sm:text-3xl text-text-primary uppercase tracking-tight">
              Industrial Fleet & Print Capabilities
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary">
              World-class German and Israeli precision machinery under one roof.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PRESS_MACHINERY.map((mach) => (
              <div
                key={mach.name}
                className="rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-8 space-y-3 hover:border-brand-yellow/40 transition-colors"
              >
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  {mach.type}
                </span>
                <h3 className="font-display font-black text-xl text-text-primary">
                  {mach.name}
                </h3>
                <div className="text-xs font-mono text-brand-yellow bg-brand-yellow/10 border border-brand-yellow/20 px-3 py-1.5 rounded-lg inline-block">
                  {mach.specs}
                </div>
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed pt-1">
                  {mach.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Core Values 4-Grid */}
        <div className="mb-20">
          <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
            <h2 className="font-display font-black text-2xl sm:text-3xl text-text-primary uppercase tracking-tight">
              The Star Press Promise
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary">
              Built on four core pillars that guide every press run.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map((val) => {
              const Icon = val.icon;
              return (
                <div
                  key={val.title}
                  className="rounded-2xl border border-border-subtle bg-bg-surface p-6 space-y-3 hover:border-border-strong transition-colors"
                >
                  <div className="w-11 h-11 rounded-xl bg-bg-surface-alt border border-border-subtle text-brand-yellow flex items-center justify-center">
                    <Icon size={22} />
                  </div>
                  <h3 className="font-display font-bold text-base text-text-primary">
                    {val.title}
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {val.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA Banner */}
        <div className="rounded-3xl border border-border-subtle bg-bg-surface p-8 sm:p-12 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 text-center sm:text-left">
            <h3 className="font-display font-black text-2xl sm:text-3xl text-text-primary uppercase">
              Ready to bring your print project to life?
            </h3>
            <p className="text-xs sm:text-sm text-text-secondary max-w-xl">
              Explore our full commercial catalog or contact our prepress team for custom
              paper swatches.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
            <Link href="/shop" className="w-full sm:w-auto">
              <Button variant="primary" size="lg" className="w-full">
                <span>Explore Catalog</span>
                <ArrowRight size={16} />
              </Button>
            </Link>
            <Link href="/contact" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full">
                <span>Contact Us</span>
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
