import { Button } from "@/components/ui/button";
import { formatTitle } from "@/lib/formatters";
import { Bot, Volume2 } from "lucide-react";

import type { InariAdvisorResponse } from "@shared/inari/contracts";
import { ActionCard } from "@/components/inari/panels";

export type AdvisorResponseView = {
  answer: string;
  summary?: string;
  keyInsights: string[];
  suggestedNextActions: string[];
  followUpQuestions?: string[];
  relatedMetrics?: Array<{ label: string; value: string }>;
  confidenceLevel: "low" | "medium" | "high";
  mode: "llm" | "fallback";
  disclaimer: string;
  /** Present only for answers from the INARI ledger engine (inari.ask). */
  inari?: {
    engineLabel: string;
    guardrail: string;
    limitations: string[];
    assumptions: string[];
    evidence: string[];
    clarification: string | null;
    actions: NonNullable<InariAdvisorResponse["proposedActions"]>;
  };
};

export type AdvisorMessageView =
  | {
      id: string;
      role: "user";
      content: string;
      createdAt: Date;
      status?: "sending" | "complete" | "error";
    }
  | {
      id: string;
      role: "assistant";
      response: AdvisorResponseView;
      createdAt: Date;
      status?: "sending" | "complete" | "error";
    };

export type AdvisorMessageProps = {
  message: AdvisorMessageView;
  onFollowUp?: (question: string) => void;
  onSpeak?: (answer: string) => void;
  speaking?: boolean;
  muted?: boolean;
  disabled?: boolean;
};

export function AdvisorMessage({
  message,
  onFollowUp,
  onSpeak,
  speaking = false,
  muted = false,
  disabled = false,
}: AdvisorMessageProps) {
  if (message.role === "user") {
    return (
      <article className="ml-auto max-w-[88%] rounded-[var(--wv-radius-card)] border border-wv-primary/20 bg-wv-primary/10 p-4">
        <p className="text-xs font-semibold text-wv-muted">
          You · {formatTime(message.createdAt)}
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-wv-text">{message.content}</p>
      </article>
    );
  }

  const response = message.response;

  return (
    <article className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface p-5 shadow-wv-card">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-wv-background text-wv-primary">
            <Bot className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold text-wv-muted">
              INARI Advisor · {formatTime(message.createdAt)}
            </p>
            <h3 className="mt-1 text-lg font-bold text-wv-text">
              {response.summary ?? "Advisor response"}
            </h3>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-wv-background px-3 py-1 text-xs font-bold text-wv-primary">
            {response.inari ? response.inari.engineLabel : `${formatTitle(response.mode)} mode`}
          </span>
          <span className="rounded-full bg-wv-background px-3 py-1 text-xs font-semibold text-wv-text-secondary">
            {formatTitle(response.confidenceLevel)} confidence
          </span>
        </div>
      </div>

      <p className="mt-5 text-sm leading-7 text-wv-text-secondary">{response.answer}</p>

      {response.inari?.clarification ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="advisor-clarification">{response.inari.clarification}</p>
      ) : null}

      {response.relatedMetrics && response.relatedMetrics.length > 0 ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {response.relatedMetrics.map((metric) => (
            <div
              key={`${metric.label}-${metric.value}`}
              className="rounded-[var(--wv-radius-form)] bg-wv-background p-3"
            >
              <p className="text-xs font-semibold text-wv-muted">{metric.label}</p>
              <p className="mt-1 text-sm font-bold text-wv-text">{metric.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {response.inari && (response.inari.limitations.length > 0 || response.inari.assumptions.length > 0 || response.inari.evidence.length > 0) ? (
        <div className="mt-4 space-y-1 text-xs leading-5 text-wv-text-secondary" data-testid="advisor-evidence">
          {response.inari.evidence.map((e) => <p key={e}>Evidence: {e}</p>)}
          {response.inari.assumptions.map((e) => <p key={e}>Assumption: {e}</p>)}
          {response.inari.limitations.map((e) => <p key={e} className="text-amber-700">Limitation: {e}</p>)}
        </div>
      ) : null}

      {response.inari && response.inari.actions.length > 0 ? (
        <div className="mt-4 space-y-3">
          {response.inari.actions.map((a, i) => <ActionCard key={`${a.procedure}-${i}`} a={a} />)}
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 border-t border-wv-border pt-5 md:grid-cols-2">
        <MessageList title="Key insights" items={response.keyInsights} />
        <MessageList title="Suggested next actions" items={response.suggestedNextActions} />
      </div>

      {response.followUpQuestions && response.followUpQuestions.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {response.followUpQuestions.map((question) => (
            <button
              type="button"
              key={question}
              className="min-h-10 rounded-full border border-wv-border bg-wv-background px-3 py-2 text-left text-xs font-semibold text-wv-text-secondary transition-colors hover:border-wv-primary hover:text-wv-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wv-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onFollowUp?.(question)}
              disabled={disabled}
            >
              {question}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col justify-between gap-4 border-t border-wv-border pt-5 sm:flex-row sm:items-center">
        <p className="text-xs leading-5 text-wv-muted">{response.disclaimer}</p>
        {onSpeak ? (
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-wv-border text-wv-text"
            onClick={() => onSpeak(response.answer)}
            disabled={speaking || muted}
          >
            <Volume2 className="size-4" aria-hidden="true" />
            Play answer
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function MessageList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-bold text-wv-text">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-wv-text-secondary">
        {items.length > 0 ? (
          items.map((item) => <li key={item}>- {item}</li>)
        ) : (
          <li>No items returned.</li>
        )}
      </ul>
    </div>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
