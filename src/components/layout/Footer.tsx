import React from "react";
import Link from "next/link";
import Image from "next/image";
import { FOOTER_COLUMNS } from "@/lib/data";

export default function Footer() {
  const socialIcons = [
    {
      name: "Instagram",
      href: "https://instagram.com",
      svg: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      ),
    },
    {
      name: "YouTube",
      href: "https://youtube.com",
      svg: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      ),
    },
    {
      name: "LinkedIn",
      href: "https://linkedin.com",
      svg: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
        </svg>
      ),
    },
    {
      name: "Twitter / X",
      href: "https://twitter.com",
      svg: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
  ];

  return (
    <footer className="w-full border-t border-border-subtle bg-bg-base pt-16 pb-8">
      <div className="max-w-[1280px] mx-auto px-4 xs:px-6 lg:px-10">
        {/* Top 4-Column Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* 1. Brand Column */}
          <div className="space-y-4">
            <Link
              href="/"
              className="inline-block group"
              aria-label="Star Press — The Printing Hub"
            >
              <Image
                src="/images/Logo.png"
                alt="Star Press - The Printing Hub"
                width={170}
                height={55}
                className="h-11 sm:h-12 w-auto object-contain group-hover:scale-[1.02] transition-transform duration-200"
              />
            </Link>
            <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
              Turning Ideas Into Print
            </p>
            <p className="text-xs text-text-muted leading-relaxed max-w-xs">
              📍 Amoun, Khatima, Uttarakhand • Pan-India Delivery
            </p>

            {/* Social Icons Row */}
            <div className="flex items-center gap-3 pt-2">
              {socialIcons.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  className="w-9 h-9 rounded-full border border-border-subtle flex items-center justify-center text-text-secondary hover:text-brand-yellow hover:border-brand-yellow transition-all duration-150 hover:scale-105"
                >
                  {social.svg}
                </a>
              ))}
            </div>
          </div>

          {/* 2, 3, 4. Link Columns */}
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 font-display">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-text-secondary hover:text-brand-yellow dark:hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border-subtle pt-6 mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted text-center sm:text-left">
          <p>© 2025 Star Press. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Link href="/privacy" className="hover:text-text-secondary transition-colors">
              Privacy Policy
            </Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-text-secondary transition-colors">
              Terms
            </Link>
            <span>·</span>
            <Link href="/cancellation-refund" className="hover:text-text-secondary transition-colors">
              Refund Policy
            </Link>
            <span>·</span>
            <Link href="/shipping-policy" className="hover:text-text-secondary transition-colors">
              Shipping Policy
            </Link>
            <span>·</span>
            <Link href="/sitemap.xml" className="hover:text-text-secondary transition-colors">
              Sitemap
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
