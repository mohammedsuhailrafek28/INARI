import type { Category, ImportBatchRecord, LedgerTransaction } from "../../../shared/inari/contracts";

/** Every method is scoped by `userKey` (`anon:<uuid>` | `user:<openId>`). There is no unscoped access path. */
export type CorrectionAudit = {
  id: string;
  transactionId: string;
  from: Category;
  to: Category;
  at: string; // ISO instant
  scope: "single" | "merchant";
};

export type StoredLearnedRule = {
  ruleId: string;
  merchantKey: string;
  category: Category;
  createdAt: string; // ISO instant
  appliedCount: number;
};

export type StoredBatch = Omit<ImportBatchRecord, "importedAt"> & { importedAt: string };

export type TransactionFilter = {
  month?: string; // YYYY-MM
  category?: Category;
  q?: string;
  needsReview?: boolean;
};

/** User-supplied facts that cannot be inferred from transactions. null = unknown. */
export type StoredGoal = {
  id: string;
  goalType: "emergency_fund" | "house" | "car" | "education" | "retirement" | "travel" | "wedding" | "gadget" | "debt_free" | "custom";
  name: string;
  targetAmount: number;
  currentAmount: number;
  timelineMonths: number | null;
  priority: "low" | "medium" | "high";
  monthlyContribution: number | null;
  createdAt: string;
  updatedAt: string;
};

export type StoredProfile = {
  emergencyFund: number | null;
  investments: number | null;
  creditCardDebt: number | null;
  age?: number;
  riskPreference?: "conservative" | "moderate" | "aggressive";
  /** true when the user explicitly asked to see the demo persona instead of imported data */
  useDemo: boolean;
  /** user's confirm/dismiss choices for detected recurring payments, keyed by subscription id */
  subscriptionDecisions?: Record<string, "confirmed" | "dismissed">;
  /** user-entered goals (never inferred from the ledger) */
  goals?: StoredGoal[];
};

export type LedgerStorageInfo = { kind: "memory" | "json"; durable: boolean; note: string };

export interface LedgerRepository {
  /** Deterministic order: postedOn desc, then id asc. */
  listTransactions(userKey: string, filter?: TransactionFilter): Promise<LedgerTransaction[]>;
  getTransaction(userKey: string, transactionId: string): Promise<LedgerTransaction | null>;
  existingFingerprints(userKey: string): Promise<Set<string>>;

  /** Atomic: batch metadata and all of its transactions are stored together, or nothing is. */
  commitBatch(userKey: string, batch: StoredBatch, transactions: LedgerTransaction[]): Promise<void>;
  listBatches(userKey: string): Promise<StoredBatch[]>;
  /** Removes the batch's transactions and marks it undone. Returns null if not found for this user. */
  undoBatch(userKey: string, batchId: string): Promise<StoredBatch | null>;

  updateTransactions(userKey: string, patches: Array<{ id: string; patch: Partial<LedgerTransaction> }>, audit?: CorrectionAudit[]): Promise<number>;
  listCorrectionAudit(userKey: string): Promise<CorrectionAudit[]>;

  listRules(userKey: string): Promise<StoredLearnedRule[]>;
  upsertRule(userKey: string, rule: StoredLearnedRule): Promise<void>;
  deleteRule(userKey: string, ruleId: string): Promise<boolean>;

  getProfile(userKey: string): Promise<StoredProfile | null>;
  setProfile(userKey: string, profile: StoredProfile): Promise<void>;

  /** Deletes everything owned by this user. Returns what was removed. */
  deleteAll(userKey: string): Promise<{ transactions: number; batches: number; rules: number }>;

  storageInfo(): LedgerStorageInfo;
}
