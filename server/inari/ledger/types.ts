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

  /** Deletes everything owned by this user. Returns what was removed. */
  deleteAll(userKey: string): Promise<{ transactions: number; batches: number; rules: number }>;

  storageInfo(): LedgerStorageInfo;
}
