"use client";

import React, { useState } from "react";
import { CheckCircle2, FileText, Settings, Truck, HelpCircle } from "lucide-react";
import { CatalogProduct } from "@/lib/catalog";

export interface ProductTabsProps {
  product: CatalogProduct;
}

export default function ProductTabs({ product }: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "specs" | "artwork" | "shipping">("overview");

  const tabs = [
    { id: "overview", label: "Overview & Features", icon: FileText },
    { id: "specs", label: "Specifications", icon: Settings },
    { id: "artwork", label: "Artwork Guidelines", icon: HelpCircle },
    { id: "shipping", label: "Shipping & Delivery", icon: Truck },
  ] as const;

  return (
    <div className="mt-16 md:mt-24 pt-12 border-t border-border-subtle">
      {/* Tabs Header */}
      <div className="flex items-center gap-2 border-b border-border-subtle pb-px overflow-x-auto scrollbar-none no-scrollbar overscroll-x-contain">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? "border-brand-yellow text-brand-yellow bg-bg-surface-alt/40 rounded-t-lg"
                  : "border-transparent text-text-secondary hover:text-text-primary hover:border-border-subtle"
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="py-8">
        {activeTab === "overview" && (
          <div className="space-y-6 max-w-4xl">
            <p className="text-base text-text-secondary leading-relaxed">
              {product.description}
            </p>

            {product.features.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
                  Key Advantages
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {product.features.map((feature, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 p-3 rounded-xl bg-bg-surface border border-border-subtle"
                    >
                      <CheckCircle2 size={16} className="text-emerald-400/90 shrink-0" />
                      <span className="text-xs sm:text-sm text-text-primary">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "specs" && (
          <div className="max-w-3xl">
            <div className="rounded-2xl border border-border-subtle overflow-hidden bg-bg-surface overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[280px]">
                <tbody>
                  {Object.entries(product.specifications).map(([key, val], idx) => (
                    <tr
                      key={idx}
                      className={idx % 2 === 0 ? "bg-bg-surface" : "bg-bg-surface-alt/40"}
                    >
                      <th className="py-3.5 px-5 font-bold text-text-primary w-1/3 border-b border-border-subtle/50">
                        {key}
                      </th>
                      <td className="py-3.5 px-5 text-text-secondary border-b border-border-subtle/50 font-mono">
                        {val}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "artwork" && (
          <div className="space-y-4 max-w-3xl text-sm text-text-secondary leading-relaxed">
            <h4 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
              File Preparation Checklist
            </h4>
            <ul className="space-y-2 list-disc list-inside">
              <li><strong className="text-text-primary">Accepted Formats:</strong> Print-ready PDF, Adobe Illustrator (.AI), Photoshop (.PSD), or high-res PNG/TIFF.</li>
              <li><strong className="text-text-primary">Bleed & Margins:</strong> Please maintain a minimum 3mm bleed on all sides and keep critical text 4mm away from trim lines.</li>
              <li><strong className="text-text-primary">Color Space:</strong> Design in CMYK color mode for optimal print fidelity. RGB files will be automatically converted to CMYK standard.</li>
              <li><strong className="text-text-primary">Resolution:</strong> Ensure all rasterized elements and images are at least 300 DPI at 100% scale.</li>
            </ul>
            <div className="p-4 rounded-xl bg-bg-surface-alt border border-border-subtle text-xs text-text-secondary mt-4 flex items-center gap-2">
              <span className="text-base">💡</span>
              <span>Don&apos;t have a print-ready design? Send your logo and text on WhatsApp and our pre-press designers will create a free digital layout for your approval!</span>
            </div>
          </div>
        )}

        {activeTab === "shipping" && (
          <div className="space-y-4 max-w-3xl text-sm text-text-secondary leading-relaxed">
            <h4 className="font-display font-bold text-sm text-text-primary uppercase tracking-wider">
              Transit & Delivery Times
            </h4>
            <p>
              All orders are manufactured with precision in Khatima, Uttarakhand, carefully packaged inside waterproof corrugated boxes, and dispatched via courier across Pan-India.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle">
                <div className="text-xs text-text-muted font-semibold uppercase tracking-wider">North India / Delhi NCR</div>
                <div className="text-lg font-bold text-text-primary mt-1">2 – 3 Days</div>
                <div className="text-xs text-text-muted mt-0.5">Express surface / air courier</div>
              </div>
              <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle">
                <div className="text-xs text-text-muted font-semibold uppercase tracking-wider">Rest of India Metro</div>
                <div className="text-lg font-bold text-text-primary mt-1">3 – 5 Days</div>
                <div className="text-xs text-text-muted mt-0.5">Tracked door-to-door transit</div>
              </div>
              <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle">
                <div className="text-xs text-text-muted font-semibold uppercase tracking-wider">Remote & Tier-3</div>
                <div className="text-lg font-bold text-text-primary mt-1">5 – 7 Days</div>
                <div className="text-xs text-text-muted mt-0.5">India Post / Speed Post</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
