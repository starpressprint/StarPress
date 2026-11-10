import React from "react";
import { TRUST_BADGES } from "@/lib/data";
import IconBadge from "@/components/ui/IconBadge";

export default function TrustBadges() {
  return (
    <section className="w-full border-t border-b border-border-subtle py-10 bg-bg-base">
      <div className="max-w-[1280px] mx-auto px-4 xs:px-6 lg:px-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {TRUST_BADGES.map((badge) => (
            <div
              key={badge.id}
              className="flex items-center gap-3 sm:gap-4 justify-start group min-w-0"
            >
              <IconBadge
                iconName={badge.iconName}
                variant="outline"
                outlineColor="border-border-subtle text-slate-300 group-hover:border-brand-yellow/50 group-hover:text-brand-yellow"
                size="md"
                className="group-hover:scale-105 transition-all duration-200 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm sm:text-base font-bold text-text-primary tracking-tight font-display truncate">
                  {badge.title}
                </div>
                <div className="text-xs text-text-secondary mt-0.5 truncate">
                  {badge.subtitle}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
