import heroAdvisorConsult from "@/assets/wealthverse/hero-advisor-consult.png";
import heroBankingSecurity from "@/assets/wealthverse/hero-banking-security.png";
import heroFamily from "@/assets/wealthverse/hero-family.png";
import inariLogo from "@/assets/inari/inari-logo.svg";
import { Footer } from "@/components/layout/Footer";
import { PublicNavbar, type PublicNavLink } from "@/components/layout/PublicNavbar";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/wealth/SectionHeader";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Landmark,
  LineChart,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Target,
  WalletCards,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

const navLinks: PublicNavLink[] = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Security", href: "#security" },
  { label: "Advisor", href: "#advisor" },
  { label: "Support", href: "/support" },
];

const valuePillars = [
  {
    title: "Understand your financial health",
    description:
      "See savings, spending, debt, emergency readiness, and goals in one clear picture.",
    icon: <LineChart className="size-5" aria-hidden="true" />,
  },
  {
    title: "See where your money goes",
    description:
      "Review category-level spending, unusual expenses, and practical saving opportunities.",
    icon: <WalletCards className="size-5" aria-hidden="true" />,
  },
  {
    title: "Build achievable goals",
    description:
      "Track progress toward goals with contribution signals and realistic next steps.",
    icon: <Target className="size-5" aria-hidden="true" />,
  },
  {
    title: "Receive explainable recommendations",
    description:
      "Review educational recommendations with reasons, risk labels, and suggested actions.",
    icon: <Sparkles className="size-5" aria-hidden="true" />,
  },
];

const howItWorks = [
  "Import a statement (CSV, digital PDF or SMS alerts) and review the preview before anything is saved.",
  "See spending, recurring payments, refunds owed and data gaps, with unknown balances shown as not provided.",
  "Ask the advisor, run what-ifs and plan goals. Answers are calculated deterministically and show their assumptions.",
  "Corrections, reconciliations and new imports update the dashboard, goals and advisor together.",
];

const productFeatures = [
  {
    title: "Import Center",
    description:
      "Bring in CSV, digital PDF or SMS alerts with duplicate protection, possible-duplicate review and one-click undo.",
    icon: <WalletCards className="size-5" aria-hidden="true" />,
  },
  {
    title: "Financial Health",
    description:
      "A simple health score helps users understand overall financial strength without hiding the contributing signals.",
    icon: <BarChart3 className="size-5" aria-hidden="true" />,
  },
  {
    title: "Spending Insights",
    description:
      "Category breakdowns and unusual-expense signals help users spot where attention may be needed.",
    icon: <CircleDollarSign className="size-5" aria-hidden="true" />,
  },
  {
    title: "Goal Planner",
    description:
      "Goal cards show progress, priority, and contribution context for a clearer planning experience.",
    icon: <Target className="size-5" aria-hidden="true" />,
  },
  {
    title: "Personalized Recommendations",
    description:
      "Recommendations are generated from existing profile and transaction signals, with educational disclaimers.",
    icon: <CheckCircle2 className="size-5" aria-hidden="true" />,
  },
  {
    title: "INARI Advisor",
    description:
      "Ask in plain language, by typing or dictating. The advisor answers from your ledger, asks when it needs more, and never acts without your confirmation.",
    icon: <Bot className="size-5" aria-hidden="true" />,
  },
];

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const authActions = useMemo(
    () => [
      {
        label: "Import a statement",
        href: "/import",
        variant: "secondary" as const,
        ariaLabel: "Import a statement into INARI",
      },
      {
        label: "Sign in",
        href: "/login",
        variant: "primary" as const,
        ariaLabel: "Sign in to INARI",
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-wv-background text-wv-text">
      <PublicNavbar
        logoSrc={inariLogo}
        links={navLinks}
        actions={authActions}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuClick={() => setMobileMenuOpen((open) => !open)}
        className="sticky top-0 z-40"
      />

      <main>
        <section className="relative overflow-hidden bg-gradient-to-br from-wv-primary-dark via-wv-primary to-[#13a693] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_34%)]" />
          <div className="relative mx-auto grid max-w-[var(--wv-content-width)] items-center gap-7 px-4 py-10 sm:px-6 md:py-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-6 lg:px-8 lg:py-16">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Voice-first money coach
              </p>
              <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Your money, understood clearly.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/82 sm:text-lg">
                INARI turns your own bank statements into a living picture of your
                money. Import a CSV, digital PDF or SMS alerts, then ask questions
                out loud, test what-ifs, plan goals and review explainable
                recommendations. Every number is calculated from your ledger, never guessed.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  className="min-h-11 bg-wv-accent px-6 text-white hover:bg-wv-accent-hover"
                >
                  <a href="/import" aria-label="Import a statement into INARI">
                    Import a statement
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="min-h-11 border-white/35 bg-white/10 px-6 text-white hover:bg-white/20"
                >
                  <a href="/choose-profile" aria-label="Explore a sample persona">Explore a sample persona</a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="min-h-11 border-white/35 bg-white/10 px-6 text-white hover:bg-white/20"
                >
                  <a href="#how-it-works">See how it works</a>
                </Button>
              </div>

              <div className="mt-8 grid gap-3 text-sm text-white/82 sm:grid-cols-3">
                <TrustItem>One ledger behind every page</TrustItem>
                <TrustItem>Explainable guidance</TrustItem>
                <TrustItem>No automatic financial actions</TrustItem>
              </div>
            </div>

            <div className="relative lg:scale-110 lg:origin-center xl:scale-125">
              <ProductHeroVisual />
            </div>
          </div>
        </section>

        <section id="features" className="py-16 sm:py-20">
          <div className="mx-auto max-w-[var(--wv-content-width)] px-4 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Product value"
              title="A calmer way to understand personal finance"
              description="The landing experience explains what INARI currently helps users do, without overstating unsupported banking or investment capabilities."
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {valuePillars.map((pillar) => (
                <FeatureCard key={pillar.title} {...pillar} />
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-white py-16 sm:py-20">
          <div className="mx-auto grid max-w-[var(--wv-content-width)] gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <SectionHeader
              eyebrow="How it works"
              title="From financial signals to practical next steps"
              description="INARI keeps the flow understandable: review context, surface insights, explain recommendations, and track progress."
            />
            <ol className="grid gap-4">
              {howItWorks.map((step, index) => (
                <li
                  key={step}
                  className="flex gap-4 rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-background p-5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-wv-primary text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-sm leading-6 text-wv-text-secondary">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-[var(--wv-content-width)] px-4 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow="Currently implemented"
              title="Every product area runs on one ledger"
              description="Import once and the dashboard, spending, goals, recommendations and advisor all use the same verified figures."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {productFeatures.map((feature) => (
                <FeatureCard key={feature.title} {...feature} compact />
              ))}
            </div>
          </div>
        </section>

        <ImageStorySection
          id="security"
          eyebrow="Security and trust"
          title="Designed around protected sessions and explainable guidance"
          description="INARI uses authenticated application routes and a temporary per-browser demo identity in this build (not production sign-in). Recommendations are educational, explainable, and do not execute financial actions automatically."
          imageSrc={heroBankingSecurity}
          imageWidth={1120}
          imageHeight={500}
          imageAlt="Secure digital banking interface"
          points={[
            "Authenticated sessions support protected product routes.",
            "Financial recommendations include educational safety language.",
            "Users stay in control: no automatic investing, lending, or banking actions are executed.",
          ]}
        />

        <ImageStorySection
          id="advisor"
          eyebrow="Digital advisor"
          title="A guided way to question your own money"
          description="The advisor answers from your own imported ledger: spending, recurring payments, refunds, what-ifs and goals. It states that no language model is used and shows the evidence behind each number."
          imageSrc={heroAdvisorConsult}
          imageWidth={904}
          imageHeight={468}
          imageAlt="Financial advisor consultation interface"
          reverse
          points={[
            "Ask focused questions about your imported statements.",
            "Review suggested next actions and educational disclaimers.",
            "Use the advisor as a guide, not as licensed financial advice.",
          ]}
        />

        <section className="bg-white py-16 sm:py-20">
          <div className="mx-auto grid max-w-[var(--wv-content-width)] items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-wv-primary">
                Goals and progress
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-wv-text">
                Move from financial information to personal goals
              </h2>
              <p className="mt-4 text-base leading-7 text-wv-text-secondary">
                INARI connects insights to goals so users can understand
                what to improve this month and what to monitor over time.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-full bg-wv-background px-4 py-2 text-sm font-semibold text-wv-primary">
                  Emergency fund
                </span>
                <span className="rounded-full bg-wv-background px-4 py-2 text-sm font-semibold text-wv-primary">
                  Spending habits
                </span>
                <span className="rounded-full bg-wv-background px-4 py-2 text-sm font-semibold text-wv-primary">
                  Goal readiness
                </span>
              </div>
            </div>
            <img
              src={heroFamily}
              width={1038}
              height={372}
              alt="Family planning finances together"
              className="aspect-[1038/372] w-full rounded-[var(--wv-radius-card)] object-cover shadow-wv-card"
              loading="lazy"
              decoding="async"
            />
          </div>
        </section>

        <section
          id="guidance-disclaimer"
          className="bg-wv-primary-dark px-4 py-14 text-white sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-4xl text-center">
            <Landmark className="mx-auto size-10 text-wv-accent" aria-hidden="true" />
            <h2 className="mt-4 font-display text-3xl font-bold">
              Start with clarity, then keep improving.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/76 sm:text-base">
              INARI provides educational financial insights and demo-safe
              guidance. It does not guarantee outcomes or replace a qualified
              financial professional.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                className="min-h-11 bg-wv-accent px-6 text-white hover:bg-wv-accent-hover"
              >
                <a href="/choose-profile">Start Interactive Demo</a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="min-h-11 border-white/30 bg-transparent px-6 text-white hover:bg-white/10"
              >
                <a href="#features">Review product features</a>
              </Button>
            </div>
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
              { label: "Features", href: "#features" },
              { label: "How It Works", href: "#how-it-works" },
              { label: "Advisor", href: "#advisor" },
            ],
          },
          {
            title: "Trust",
            links: [
              { label: "Security", href: "#security" },
              { label: "Support", href: "/support" },
              { label: "Guidance Disclaimer", href: "#guidance-disclaimer" },
            ],
          },
        ]}
      >
        <p className="max-w-sm text-xs leading-5 text-white/58">
          Educational financial guidance only. Legal, privacy, and support
          pages will be added in later migration phases.
        </p>
      </Footer>
    </div>
  );
}

function ProductHeroVisual() {
  return (
    <div
      className="relative rounded-[28px] border border-white/20 bg-white/12 p-4 shadow-2xl shadow-wv-primary-dark/30 backdrop-blur"
      aria-label="INARI product preview showing health score, goals, recommendations, and advisor"
    >
      <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/12 blur-2xl" aria-hidden="true" />
      <div className="relative rounded-[22px] border border-white/18 bg-[#f7fbfa] p-4 text-wv-text shadow-[0_28px_80px_-48px_rgba(0,0,0,0.75)]">
        <div className="flex items-center justify-between border-b border-wv-border pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-wv-primary">
              INARI
            </p>
            <h2 className="mt-1 font-display text-xl font-bold tracking-[-0.03em]">
              Financial Intelligence
            </h2>
          </div>
          <span className="rounded-full bg-wv-primary px-3 py-1 text-xs font-semibold text-white">
            Illustrative preview
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-wv-border bg-white p-4 shadow-wv-low">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-wv-muted">
              Health Score
            </p>
            <div className="mt-4 flex items-end gap-3">
              <span className="font-display text-5xl font-extrabold leading-none tracking-[-0.04em] text-wv-primary-dark tabular-nums">
                75
              </span>
              <span className="pb-1 text-sm font-semibold text-wv-muted">/100</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-wv-border">
              <div className="h-full w-3/4 rounded-full bg-wv-primary" />
            </div>
          </div>

          <div className="grid gap-3">
            <HeroSignal
              icon={<Target className="size-4" aria-hidden="true" />}
              label="Goal"
              title="First home plan"
              meta="18 months faster with monthly focus"
            />
            <HeroSignal
              icon={<Sparkles className="size-4" aria-hidden="true" />}
              label="Recommendation"
              title="Increase emergency buffer"
              meta="Priority: high"
            />
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-wv-border bg-white p-4 shadow-wv-low">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-wv-primary/10 text-wv-primary">
              <Bot className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-wv-muted">
                AI Advisor
              </p>
              <p className="mt-1 text-sm font-semibold leading-5 text-wv-text">
                Focus this month on emergency coverage before raising investments.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSignal({
  icon,
  label,
  title,
  meta,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  meta: string;
}) {
  return (
    <div className="rounded-2xl border border-wv-border bg-white p-3 shadow-wv-low transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-wv-background text-wv-primary">
          {icon}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-wv-muted">
            {label}
          </p>
          <p className="mt-1 text-sm font-bold leading-5 text-wv-text">{title}</p>
          <p className="mt-1 text-xs text-wv-text-secondary">{meta}</p>
        </div>
      </div>
    </div>
  );
}

function TrustItem({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2">
      <LockKeyhole className="size-4 shrink-0" aria-hidden="true" />
      {children}
    </span>
  );
}

function FeatureCard({
  title,
  description,
  icon,
  compact = false,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  compact?: boolean;
}) {
  return (
    <article className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card">
      <div className="flex size-11 items-center justify-center rounded-md bg-wv-background text-wv-primary">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-bold text-wv-text">{title}</h3>
      <p
        className={`mt-2 text-sm leading-6 text-wv-text-secondary ${compact ? "" : "min-h-24"}`}
      >
        {description}
      </p>
    </article>
  );
}

function ImageStorySection({
  id,
  eyebrow,
  title,
  description,
  imageSrc,
  imageWidth,
  imageHeight,
  imageAlt,
  points,
  reverse = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  imageAlt: string;
  points: string[];
  reverse?: boolean;
}) {
  return (
    <section id={id} className="py-16 sm:py-20">
      <div className="mx-auto grid max-w-[var(--wv-content-width)] items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
        <div className={reverse ? "lg:order-2" : undefined}>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-wv-primary">
            {eyebrow}
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-wv-text">
            {title}
          </h2>
          <p className="mt-4 text-base leading-7 text-wv-text-secondary">
            {description}
          </p>
          <ul className="mt-6 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex gap-3 text-sm leading-6 text-wv-text-secondary">
                <CheckCircle2 className="mt-1 size-4 shrink-0 text-wv-success" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <img
          src={imageSrc}
          width={imageWidth}
          height={imageHeight}
          alt={imageAlt}
          className="w-full rounded-[var(--wv-radius-card)] object-cover shadow-wv-card"
          loading="lazy"
          decoding="async"
        />
      </div>
    </section>
  );
}
