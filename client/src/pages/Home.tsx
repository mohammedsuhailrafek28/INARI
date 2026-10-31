import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  GitBranch,
  MessageSquare,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";

const features = [
  {
    title: "A ledger that makes sense.",
    text: "Import CSV, digital PDF or SMS alerts. Review the source evidence, catch duplicates and correct a category once to teach INARI the merchant.",
    href: "/import",
    label: "Open Import Center",
    icon: FileText,
  },
  {
    title: "See the rhythm behind the spend.",
    text: "Separate recurring commitments from everyday spending. Follow category trends, track refunds and reimbursements, and keep unknown balances unknown.",
    href: "/spending",
    label: "Explore spending",
    icon: Wallet,
  },
  {
    title: "Make room for what comes next.",
    text: "Confirm your goal balances. Compare contributions, income changes, subscription cuts and the real cost of an EMI before committing.",
    href: "/recommendations",
    label: "Explore scenarios",
    icon: GitBranch,
  },
];

export default function Home() {
  const [menu, setMenu] = useState(false);
  return (
    <div className="inari-landing">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <PublicNavbar
        links={[
          { label: "The model", href: "#model" },
          { label: "Capabilities", href: "#capabilities" },
          { label: "Your advisor", href: "#advisor" },
        ]}
        actions={[
          { label: "Open application", href: "/import", variant: "primary" },
        ]}
        mobileMenuOpen={menu}
        onMobileMenuClick={() => setMenu(!menu)}
      />
      <main id="main-content">
        <section className="landing-hero">
          <div className="hero-heading-row">
            <h1>
              YOUR MONEY.
              <br />A CLEARER
              <br />
              <span>WAY FORWARD.</span>
            </h1>
            <svg
              className="money-thread"
              viewBox="0 0 200 200"
              fill="none"
              aria-hidden="true"
            >
              <path d="M20 10v55c0 48 160-5 160 50s-160-5-160 45v30" />
              <circle cx="20" cy="10" r="5" />
              <circle cx="20" cy="190" r="5" />
            </svg>
          </div>
          <div className="hero-bottom">
            <div>
              <p>A living money model, built from your ledger.</p>
              <p className="hero-detail">
                Understand what comes in, what goes out and what your next
                decision could change. One connected view of your spending,
                goals and possibilities.
              </p>
            </div>
            <div className="hero-actions">
              <a className="landing-button" href="/import">
                Import a statement <ArrowUpRight size={20} />
              </a>
              <a className="text-link" href="/choose-profile">
                Explore a fictional persona <ArrowRight size={16} />
              </a>
              <span className="hero-safety">
                <ShieldCheck size={14} /> Synthetic-data demo · educational only
              </span>
            </div>
          </div>
        </section>
        <section id="model" className="landing-model">
          <div className="model-intro">
            <h2>
              A clearer picture.
              <br />
              Not another guess.
            </h2>
            <p>
              INARI turns scattered transactions into an explainable financial
              picture. Every page shares one ledger. Every financial result
              comes from the same engine.
            </p>
            <a className="text-link" href="/import">
              Build your money model <ArrowRight size={18} />
            </a>
          </div>
          <div
            className="model-visual"
            aria-label="Illustrative product flow, not live financial data"
          >
            <div className="model-visual-title">
              <span>THE LIVING MONEY MODEL</span>
              <span>ILLUSTRATIVE</span>
            </div>
            <div className="model-flow">
              <FileText />
              <div>
                <strong>Your statements</strong>
                <small>CSV · digital PDF · SMS</small>
              </div>
              <Check size={18} />
            </div>
            <div className="model-connector" />
            <div className="model-flow">
              <Wallet />
              <div>
                <strong>One confirmed ledger</strong>
                <small>Source evidence · duplicate review</small>
              </div>
              <Check size={18} />
            </div>
            <div className="model-branches">
              <span>Spending</span>
              <span>Goals</span>
              <span>Scenarios</span>
            </div>
            <div className="model-answer">
              <MessageSquare size={20} />
              <p>
                “What changes if my income drops?”
                <small>Your advisor answers from the same ledger.</small>
              </p>
            </div>
            <div className="model-foot">
              <span>Unknown balance?</span>
              <strong>Not provided. Never invented.</strong>
            </div>
          </div>
        </section>
        <section id="capabilities" className="landing-capabilities">
          <div className="section-heading">
            <h2>
              Less scattered.
              <br />
              More understood.
            </h2>
            <p>
              From the first imported transaction to the next considered
              decision.
            </p>
          </div>
          <div className="capability-list">
            {features.map(({ title, text, href, label, icon: Icon }) => (
              <article key={title}>
                <Icon size={28} strokeWidth={1.5} />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
                <a className="text-link" href={href}>
                  {label}
                  <ArrowUpRight size={18} />
                </a>
              </article>
            ))}
          </div>
        </section>
        <section id="advisor" className="landing-advisor">
          <div>
            <MessageSquare size={32} strokeWidth={1.5} />
            <h2>
              Ask naturally.
              <br />
              Understand clearly.
            </h2>
            <p>
              Ask about your imported spending, recurring payments, goals or a
              what-if. Type or dictate into the advisor with Wispr Flow. Answers
              include the evidence and the limits of what INARI knows.
            </p>
            <p className="advisor-method">
              Deterministic financial intelligence. No language model is used
              for imported-ledger answers. Money-changing actions wait for your
              confirmation.
            </p>
            <a className="landing-button" href="/avatar">
              Meet your advisor <ArrowUpRight size={20} />
            </a>
          </div>
          <blockquote>
            “Show me what deserves
            <br />
            my attention this month.”
            <footer>A useful question. Your own numbers.</footer>
          </blockquote>
        </section>
        <section className="landing-close">
          <h2>
            Start with what
            <br />
            you know.
          </h2>
          <div>
            <p>
              Bring a synthetic statement. Review before confirming. Explore
              your money with context.
            </p>
            <a className="landing-button" href="/import">
              Open Import Center <ArrowUpRight size={20} />
            </a>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <a href="/" className="brand-wordmark">
          INARI<span>●</span>
        </a>
        <nav aria-label="Footer navigation">
          <a href="/import">Import</a>
          <a href="/dashboard">Dashboard</a>
          <a href="/goals">Goals</a>
          <a href="/support">Support</a>
        </nav>
        <p>
          Educational scenario modeling. No specific securities recommendations or
          automatic financial actions. Synthetic data only; do not upload
          personal bank statements. Demo sessions use temporary identities and
          in-memory storage.
        </p>
        <small>
          © {new Date().getFullYear()} INARI · One ledger. A clearer way
          forward.
        </small>
      </footer>
    </div>
  );
}
