import type { LucideIcon } from "lucide-react";
import {
  Bot,
  CircleDollarSign,
  Gauge,
  Goal,
  HelpCircle,
  Lightbulb,
  LockKeyhole,
  LogIn,
  Sparkles,
} from "lucide-react";

export type SupportCategory = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export type FaqItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

export const supportCategories: SupportCategory[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "Learn what INARI currently offers and how to begin.",
    icon: HelpCircle,
  },
  {
    id: "access",
    title: "Signing in and demo access",
    description: "Understand OAuth, demo mode, sessions, and sign-out behavior.",
    icon: LogIn,
  },
  {
    id: "health-score",
    title: "Financial health score",
    description: "See how the prototype explains financial wellness signals.",
    icon: Gauge,
  },
  {
    id: "spending",
    title: "Spending insights",
    description: "Review category breakdowns and unusual spending signals.",
    icon: CircleDollarSign,
  },
  {
    id: "goals",
    title: "Goals",
    description: "Understand current goal planning and progress behavior.",
    icon: Goal,
  },
  {
    id: "recommendations",
    title: "Recommendations",
    description: "Learn how educational recommendations are generated.",
    icon: Lightbulb,
  },
  {
    id: "advisor",
    title: "INARI Advisor",
    description: "Understand what the digital advisor can and cannot do.",
    icon: Bot,
  },
  {
    id: "security",
    title: "Privacy and security",
    description: "Follow safe practices for sessions and prototype access.",
    icon: LockKeyhole,
  },
  {
    id: "technical",
    title: "Technical issues",
    description: "Find help for loading, demo data, and route behavior.",
    icon: Sparkles,
  },
];

export const supportFaqs: FaqItem[] = [
  {
    id: "how-sign-in",
    category: "access",
    question: "How do I sign in?",
    answer:
      "Use the secure sign-in action on the login page. When OAuth is configured, it opens the configured OAuth flow and returns you to INARI after authentication.",
  },
  {
    id: "without-oauth",
    category: "access",
    question: "Can I use INARI without OAuth?",
    answer:
      "In local or demo environments, INARI can fall back to demo access. This lets the prototype run without a configured OAuth provider.",
  },
  {
    id: "demo-mode",
    category: "access",
    question: "What is demo mode?",
    answer:
      "Demo mode is a safe prototype path that uses local demo data and a demo user context so the app remains runnable for evaluation and development.",
  },
  {
    id: "passwords-otp",
    category: "access",
    question: "Does INARI support passwords or OTP?",
    answer:
      "No. This prototype does not support email passwords, mobile OTP, password reset, or standalone account creation. Access goes through OAuth or the existing demo fallback.",
  },
  {
    id: "sign-out",
    category: "access",
    question: "How do I sign out?",
    answer:
      "The authenticated product experience includes logout behavior backed by the existing session system. Public support pages remain accessible before or after sign-out.",
  },
  {
    id: "health-score-calculation",
    category: "health-score",
    question: "How is the financial health score calculated?",
    answer:
      "The score is generated from deterministic prototype logic using available profile, cashflow, spending, goal, alert, and recommendation signals. It is meant to be explainable, not a regulated credit or investment score.",
  },
  {
    id: "advisor-advice",
    category: "recommendations",
    question: "Are recommendations generated from real financial-advisor advice?",
    answer:
      "No. Recommendations are educational prototype outputs generated from deterministic INARI logic and demo context. They are not licensed financial advice.",
  },
  {
    id: "guaranteed-returns",
    category: "recommendations",
    question: "Does INARI guarantee returns?",
    answer:
      "No. INARI does not guarantee financial, savings, or investment outcomes. Users should consult qualified professionals before making major financial decisions.",
  },
  {
    id: "execute-actions",
    category: "recommendations",
    question: "Can INARI execute investments or transactions?",
    answer:
      "No. The current prototype does not move money, place trades, open accounts, connect live bank accounts, or execute financial transactions.",
  },
  {
    id: "profile-differences",
    category: "recommendations",
    question: "Why might recommendations differ between profiles?",
    answer:
      "Recommendations depend on the active profile context, including cashflow, spending breakdown, goals, alerts, and risk signals available to the current demo session.",
  },
  {
    id: "spending-categories",
    category: "spending",
    question: "How are spending categories calculated?",
    answer:
      "Spending categories come from the current prototype data and financial engine outputs. They are grouped for insight and demo purposes.",
  },
  {
    id: "unusual-expense",
    category: "spending",
    question: "What counts as an unusual expense?",
    answer:
      "Unusual expenses are deterministic signals produced from the available transaction and spending context. They highlight items that may deserve review.",
  },
  {
    id: "savings-opportunities",
    category: "spending",
    question: "How are savings opportunities estimated?",
    answer:
      "Savings opportunities are estimated from spending patterns, category concentration, recommendations, and current financial context. They are educational estimates only.",
  },
  {
    id: "create-goals",
    category: "goals",
    question: "Can I create or edit goals yet?",
    answer:
      "Goal planning is visible in the prototype, but full create and edit workflows may require future backend mutations and product work before they are production-ready.",
  },
  {
    id: "advisor-capabilities",
    category: "advisor",
    question: "What can the Avatar Advisor do?",
    answer:
      "The Avatar Advisor can answer supported finance questions using WealthContext, recommendations, alerts, memory, predictions, events, notifications, telemetry, and deterministic NLP intent handling.",
  },
  {
    id: "human-advisor",
    category: "advisor",
    question: "Is it a replacement for a human financial advisor?",
    answer:
      "No. The advisor is an educational prototype assistant. It is not a licensed financial advisor and should not replace qualified professional advice.",
  },
  {
    id: "advisor-memory",
    category: "advisor",
    question: "Does it remember previous interactions?",
    answer:
      "During the running app session, the in-memory Memory Layer can retain recent advisor conversation context. It is not persistent production memory yet.",
  },
  {
    id: "voice",
    category: "advisor",
    question: "Does it use voice input and output?",
    answer:
      "The prototype supports browser speech synthesis for spoken answers where available. Speech-to-text voice input is not implemented as a production feature yet.",
  },
  {
    id: "official-pages",
    category: "security",
    question: "How do I stay safe while using the prototype?",
    answer:
      "Use only official INARI pages, avoid sharing session links, and sign out on shared devices. This prototype does not ask for passwords or OTPs.",
  },
  {
    id: "loading-issues",
    category: "technical",
    question: "What should I do if a page does not load?",
    answer:
      "Refresh the page and check that the local development server is running. In demo mode, missing database or OAuth configuration should not prevent the main prototype from loading.",
  },
  {
    id: "start",
    category: "getting-started",
    question: "Where should I start?",
    answer:
      "Start from the landing page, choose Start Interactive Demo, select a persona, then explore the dashboard, spending insights, goals, recommendations, and Avatar Advisor.",
  },
];
