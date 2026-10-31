import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type FooterLink = {
  label: string;
  href: string;
};

export type FooterSection = {
  title: string;
  links: FooterLink[];
};

export type FooterProps = {
  logoSrc?: string;
  brandName?: string;
  description?: string;
  sections: FooterSection[];
  legalLinks?: FooterLink[];
  copyright?: string;
  className?: string;
  children?: ReactNode;
};

export function Footer({
  logoSrc,
  brandName = "INARI",
  description = "Educational wealth intelligence for clearer financial decisions.",
  sections,
  legalLinks = [],
  copyright = `© ${new Date().getFullYear()} INARI. All rights reserved.`,
  className,
  children,
}: FooterProps) {
  return (
    <footer className={cn("bg-wv-primary-dark text-white", className)}>
      <div className="mx-auto grid max-w-[var(--wv-content-width)] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.3fr_2fr] lg:px-8">
        <div>
          <a
            href="/"
            className="inline-flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wv-primary-dark"
            aria-label={`${brandName} home`}
          >
            {logoSrc ? (
              <img src={logoSrc} alt="Official INARI logo" className="h-11 w-auto rounded-md" />
            ) : null}
            <span className="font-display text-lg font-bold">{brandName}</span>
          </a>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
            {description}
          </p>
          {children ? <div className="mt-5">{children}</div> : null}
        </div>

        <nav
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Footer navigation"
        >
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                {section.title}
              </h2>
              <ul className="mt-3 space-y-2">
                {section.links.map((link) => (
                  <li key={`${section.title}-${link.href}-${link.label}`}>
                    <a
                      href={link.href}
                      className="rounded-sm text-sm text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wv-primary-dark"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/12">
        <div className="mx-auto flex max-w-[var(--wv-content-width)] flex-col gap-3 px-4 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>{copyright}</p>
          {legalLinks.length > 0 ? (
            <nav aria-label="Legal navigation">
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {legalLinks.map((link) => (
                  <li key={`${link.href}-${link.label}`}>
                    <a
                      href={link.href}
                      className="rounded-sm transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wv-primary-dark"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
