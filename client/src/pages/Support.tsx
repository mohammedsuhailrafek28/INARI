import { INARI_EMBLEM as inariLogo } from "@/lib/brand";
import { Footer } from "@/components/layout/Footer";
import { SupportCategoryCard } from "@/components/support/SupportCategoryCard";
import { SupportNotice } from "@/components/support/SupportNotice";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/wealth/EmptyState";
import { SectionHeader } from "@/components/wealth/SectionHeader";
import { PublicNavbar, type PublicNavLink } from "@/components/layout/PublicNavbar";
import { supportCategories, supportFaqs } from "@/data/supportFaqs";
import {
  AlertTriangle,
  ArrowRight,
  HelpCircle,
  Info,
  LockKeyhole,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

const navLinks: PublicNavLink[] = [
  { label: "Overview", href: "/" },
  { label: "Support", href: "/support", isActive: true },
];

export default function Support() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const faqSectionRef = useRef<HTMLElement | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const selectedCategoryTitle = selectedCategory
    ? supportCategories.find((category) => category.id === selectedCategory)?.title
    : null;

  const filteredFaqs = useMemo(() => {
    return supportFaqs.filter((faq) => {
      const categoryMatches = selectedCategory
        ? faq.category === selectedCategory
        : true;
      const queryMatches = normalizedQuery
        ? `${faq.question} ${faq.answer}`.toLowerCase().includes(normalizedQuery)
        : true;

      return categoryMatches && queryMatches;
    });
  }, [normalizedQuery, selectedCategory]);

  const resultSummary =
    filteredFaqs.length === 1
      ? "1 FAQ matches your filters."
      : `${filteredFaqs.length} FAQs match your filters.`;

  const selectCategory = (categoryId: string) => {
    setSelectedCategory((current) => (current === categoryId ? null : categoryId));
    window.setTimeout(() => {
      faqSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const clearFilters = () => {
    setQuery("");
    setSelectedCategory(null);
  };

  return (
    <div className="min-h-screen bg-wv-background text-wv-text">
      <PublicNavbar
        logoSrc={inariLogo}
        links={navLinks}
        actions={[
          {
            label: "Start Interactive Demo",
            href: "/choose-profile",
            variant: "secondary",
            ariaLabel: "Start the interactive INARI demo",
          },
          {
            label: "Sign in",
            href: "/login",
            variant: "primary",
            ariaLabel: "Sign in to INARI",
          },
        ]}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuClick={() => setMobileMenuOpen((open) => !open)}
        className="sticky top-0 z-40"
      />

      <main>
        <section className="bg-gradient-to-br from-wv-primary-dark via-wv-primary to-[#1C4D41] px-4 py-16 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[var(--wv-content-width)]">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em]">
                <HelpCircle className="size-4" aria-hidden="true" />
                Help Centre
              </p>
              <h1 className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                How can we help?
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/82 sm:text-lg">
                Find answers about your INARI account, financial insights,
                goals, recommendations, and advisor experience.
              </p>
            </div>

            <div className="mt-8 max-w-2xl rounded-[var(--wv-radius-card)] border border-white/20 bg-wv-surface p-3 shadow-wv-card">
              <label htmlFor="support-search" className="sr-only">
                Search help topics
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-wv-muted"
                    aria-hidden="true"
                  />
                  <Input
                    id="support-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search help topics"
                    className="min-h-11 border-wv-border bg-wv-background pl-9 text-wv-text"
                  />
                </div>
                {query || selectedCategory ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 border-wv-border text-wv-text hover:bg-wv-background"
                    onClick={clearFilters}
                  >
                    <X className="size-4" aria-hidden="true" />
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-16">
          <div className="mx-auto max-w-[var(--wv-content-width)] px-4 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Support topics"
              title="Choose a help category"
              description="Filter the FAQ list by topic. These cards do not navigate away or open unsupported contact workflows."
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {supportCategories.map((category) => (
                <SupportCategoryCard
                  key={category.id}
                  title={category.title}
                  description={category.description}
                  icon={category.icon}
                  active={selectedCategory === category.id}
                  onSelect={() => selectCategory(category.id)}
                />
              ))}
            </div>
          </div>
        </section>

        <section ref={faqSectionRef} className="bg-wv-surface py-14 sm:py-16">
          <div className="mx-auto max-w-[var(--wv-content-width)] px-4 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Frequently asked questions"
              title={selectedCategoryTitle ? `${selectedCategoryTitle} FAQs` : "Common questions"}
              description="Answers are based on the current INARI prototype capabilities."
              action={
                query || selectedCategory ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 border-wv-border text-wv-text hover:bg-wv-background"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                ) : null
              }
            />
            <p className="mt-5 text-sm text-wv-text-secondary" aria-live="polite">
              {resultSummary}
            </p>

            {filteredFaqs.length > 0 ? (
              <Accordion
                type="single"
                collapsible
                className="mt-6 rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface px-5 shadow-wv-card"
              >
                {filteredFaqs.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id} className="border-wv-border">
                    <AccordionTrigger className="py-5 text-base font-bold text-wv-text hover:no-underline focus-visible:ring-wv-primary">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-6 text-wv-text-secondary">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <EmptyState
                className="mt-6"
                icon={<Search className="size-6" aria-hidden="true" />}
                title="No matching help topics"
                description="Try a different search term or clear the current filters to view all frequently asked questions."
                action={{
                  label: "Clear search",
                  onClick: clearFilters,
                  ariaLabel: "Clear support search filters",
                }}
              />
            )}
          </div>
        </section>

        <section className="py-14 sm:py-16">
          <div className="mx-auto grid max-w-[var(--wv-content-width)] gap-4 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
            <SupportNotice
              icon={Info}
              title="Need more help?"
              description="Direct support contact is not yet available in this prototype. You can return to the dashboard, sign in, or review the public product overview."
              className="lg:col-span-1"
            >
              <div className="flex flex-col gap-2">
                <Button asChild className="min-h-11 bg-wv-primary text-white hover:bg-wv-primary-dark">
                  <a href="/dashboard">
                    Return to dashboard
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="min-h-11 border-wv-border text-wv-text hover:bg-wv-background"
                >
                  <a href="/login">Go to sign in</a>
                </Button>
              </div>
            </SupportNotice>

            <SupportNotice
              icon={LockKeyhole}
              title="Security guidance"
              description="Use only official INARI pages, do not share session links, and sign out on shared devices. INARI does not request passwords or OTPs through this prototype."
              className="lg:col-span-1"
            />

            <SupportNotice
              icon={AlertTriangle}
              title="Financial guidance disclaimer"
              description="INARI provides educational financial insights and does not guarantee financial or investment outcomes. Seek qualified professional advice before major financial decisions."
              tone="warning"
              className="lg:col-span-1"
            />
          </div>
        </section>
      </main>

      <Footer
        logoSrc={inariLogo}
        description="INARI is an educational digital wealth experience for understanding financial health, spending, goals, and explainable recommendations."
        sections={[
          {
            title: "Product",
            links: [
              { label: "Overview", href: "/" },
              { label: "Start Interactive Demo", href: "/choose-profile" },
              { label: "Sign In", href: "/login" },
            ],
          },
          {
            title: "Help",
            links: [{ label: "Support", href: "/support" }],
          },
        ]}
      >
        <p className="max-w-sm text-xs leading-5 text-white/58">
          Support contact, legal pages, and contact workflows are planned for
          later phases.
        </p>
      </Footer>
    </div>
  );
}
