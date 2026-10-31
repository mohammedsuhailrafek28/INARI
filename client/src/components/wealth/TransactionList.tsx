import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyINR, formatDate, formatTitle } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export type TransactionListItem = {
  id: number | string;
  description: string;
  category: string;
  amount: number;
  type: string;
  date: Date | string;
};

export type TransactionListProps = {
  transactions: TransactionListItem[];
  className?: string;
};

export function TransactionList({ transactions, className }: TransactionListProps) {
  return (
    <Card className={cn("rounded-[var(--wv-radius-card)] border-wv-border bg-wv-surface py-0 shadow-wv-card", className)}>
      <CardContent className="p-0">
        <ul className="divide-y divide-wv-border" aria-label="Recent transactions">
          {transactions.map((transaction) => {
            const type = formatTitle(transaction.type);
            const isIncome = transaction.type === "income";
            return (
              <li key={transaction.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-wv-text">
                    {transaction.description}
                  </p>
                  <p className="mt-1 break-words text-xs text-wv-muted">
                    {formatTitle(transaction.category)} · {formatDate(transaction.date)} · {type}
                  </p>
                </div>
                <p
                  className={cn(
                    "shrink-0 text-sm font-bold tabular-nums",
                    isIncome ? "text-wv-success" : "text-wv-text"
                  )}
                  aria-label={`${type} ${formatCurrencyINR(transaction.amount)}`}
                >
                  {isIncome ? "+" : "-"}
                  {formatCurrencyINR(Math.abs(transaction.amount))}
                </p>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
