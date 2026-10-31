import { Spinner } from "@/components/ui/spinner";

export function RouteLoadingFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-wv-background px-4 text-wv-text"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-[var(--wv-radius-card)] border border-wv-border bg-wv-surface px-6 py-5 text-center shadow-wv-card">
        <Spinner className="mx-auto size-5 text-wv-primary" />
        <p className="mt-3 text-sm font-medium text-wv-text-secondary">
          Loading INARI
        </p>
      </div>
    </div>
  );
}
