import React from "react";
import { WHY_CHOOSE_US } from "@/lib/data";
import IconBadge from "@/components/ui/IconBadge";

export default function WhyChooseUs() {
  return (
    <section className="py-16 md:py-20">
      <div className="max-w-[1280px] mx-auto px-4 xs:px-6 lg:px-10">
        {/* Left-Aligned H2 */}
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-text-primary tracking-tight mb-10">
          Why Choose STAR PRESS?
        </h2>

        {/* 4 Benefit Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          {WHY_CHOOSE_US.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-4 p-2 group"
            >
              <IconBadge
                iconName={item.iconName}
                variant="filled"
                fillColor={item.circleColor}
                size="lg"
                className="group-hover:scale-110 transition-transform duration-200"
              />
              <div className="space-y-1">
                <h3 className="font-display font-bold text-base sm:text-lg text-text-primary tracking-tight">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-text-secondary leading-normal">
                  {item.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
