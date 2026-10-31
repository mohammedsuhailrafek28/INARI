import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LedgerTransaction } from "../../../shared/inari/contracts";
import type {
  CorrectionAudit,
  LedgerRepository,
  LedgerStorageInfo,
  StoredBatch,
  StoredLearnedRule,
  TransactionFilter,
} from "./types";

type UserData = {
  transactions: LedgerTransaction[];
  batches: StoredBatch[];
  audit: CorrectionAudit[];
  rules: StoredLearnedRule[];
};
type FileShape = { version: 1; users: Record<string, UserData> };

const emptyUser = (): UserData => ({ transactions: [], batches: [], audit: [], rules: [] });

function assertUserKey(userKey: string) {
  if (typeof userKey !== "string" || !/^(anon|user):.{1,200}$/.test(userKey)) {
    throw new Error("Invalid ledger owner key");
  }
}

const clone = <T>(value: T): T => structuredClone(value);

/**
 * Ledger repository backed by a Map, optionally mirrored to a local JSON file.
 *
 * Durability (read this before trusting it):
 *  - `memory` mode: lost on every restart.
 *  - `json` mode: survives process restarts ONLY if the file's directory is on persistent storage.
 *    On ephemeral hosts (e.g. Render free plan) the disk is wiped on redeploy/spin-down, so treat as demo-grade.
 *  - Writes are serialized through one queue and replaced atomically (tmp + rename).
 */
export class FileLedgerRepository implements LedgerRepository {
  private users = new Map<string, UserData>();
  private loaded = false;
  private writeChain: Promise<void> = Promise.resolve();
  private readonly filePath: string | null;

  constructor(options: { filePath?: string | null } = {}) {
    this.filePath = options.filePath ?? null;
  }

  storageInfo(): LedgerStorageInfo {
    return this.filePath
      ? {
          kind: "json",
          durable: false,
          note: "Local JSON file. Survives process restarts only if the directory is persistent; ephemeral hosts wipe it. Demo-grade.",
        }
      : { kind: "memory", durable: false, note: "In-memory only. All imported data is lost when the server restarts." };
  }

  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.filePath) return;
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as FileShape;
      if (parsed?.version === 1 && parsed.users) {
        for (const [key, data] of Object.entries(parsed.users)) this.users.set(key, { ...emptyUser(), ...data });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        // Corrupt file: start empty rather than crash. The file is replaced on next write.
        this.users.clear();
      }
    }
  }

  private persist(): Promise<void> {
    if (!this.filePath) return Promise.resolve();
    const filePath = this.filePath;
    const snapshot: FileShape = { version: 1, users: Object.fromEntries(this.users) };
    const body = JSON.stringify(snapshot);
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(path.dirname(filePath), { recursive: true });
      const tmp = `${filePath}.tmp`;
      await writeFile(tmp, body, "utf8");
      await rename(tmp, filePath);
    });
    return this.writeChain;
  }

  private async data(userKey: string, create = false): Promise<UserData | undefined> {
    assertUserKey(userKey);
    await this.load();
    let data = this.users.get(userKey);
    if (!data && create) {
      data = emptyUser();
      this.users.set(userKey, data);
    }
    return data;
  }

  async listTransactions(userKey: string, filter: TransactionFilter = {}): Promise<LedgerTransaction[]> {
    const data = await this.data(userKey);
    if (!data) return [];
    const q = filter.q?.trim().toLowerCase();
    return clone(
      data.transactions
        .filter(t => !filter.month || t.postedOn.startsWith(filter.month))
        .filter(t => !filter.category || t.category === filter.category)
        .filter(t => !q || `${t.merchant ?? ""} ${t.narration}`.toLowerCase().includes(q))
        .filter(
          t =>
            !filter.needsReview ||
            t.categorySource === "unclassified" ||
            t.categoryConfidence < 0.6 ||
            t.possibleDuplicateOf !== null
        )
        .sort((a, b) => (a.postedOn === b.postedOn ? a.id.localeCompare(b.id) : b.postedOn.localeCompare(a.postedOn)))
    );
  }

  async getTransaction(userKey: string, transactionId: string) {
    const data = await this.data(userKey);
    const found = data?.transactions.find(t => t.id === transactionId);
    return found ? clone(found) : null;
  }

  async existingFingerprints(userKey: string) {
    const data = await this.data(userKey);
    return new Set(data?.transactions.map(t => t.fingerprint) ?? []);
  }

  async commitBatch(userKey: string, batch: StoredBatch, transactions: LedgerTransaction[]) {
    const data = (await this.data(userKey, true))!;
    if (data.batches.some(b => b.batchId === batch.batchId)) throw new Error("Batch already committed");
    const known = new Set(data.transactions.map(t => t.fingerprint));
    if (transactions.some(t => known.has(t.fingerprint))) throw new Error("Duplicate fingerprint in commit");
    data.batches.push(clone(batch));
    data.transactions.push(...clone(transactions));
    await this.persist();
  }

  async listBatches(userKey: string) {
    const data = await this.data(userKey);
    return clone((data?.batches ?? []).slice().sort((a, b) => b.importedAt.localeCompare(a.importedAt)));
  }

  async undoBatch(userKey: string, batchId: string) {
    const data = await this.data(userKey);
    const batch = data?.batches.find(b => b.batchId === batchId);
    if (!data || !batch) return null;
    data.transactions = data.transactions.filter(t => t.batchId !== batchId);
    batch.status = "undone";
    await this.persist();
    return clone(batch);
  }

  async updateTransactions(
    userKey: string,
    patches: Array<{ id: string; patch: Partial<LedgerTransaction> }>,
    audit: CorrectionAudit[] = []
  ) {
    const data = await this.data(userKey);
    if (!data) return 0;
    let updated = 0;
    for (const { id, patch } of patches) {
      const target = data.transactions.find(t => t.id === id);
      if (!target) continue;
      // Identity fields are immutable through this path.
      const { id: _id, fingerprint: _fp, batchId: _b, ...safe } = patch;
      Object.assign(target, safe);
      updated++;
    }
    data.audit.push(...clone(audit));
    if (updated || audit.length) await this.persist();
    return updated;
  }

  async listCorrectionAudit(userKey: string) {
    const data = await this.data(userKey);
    return clone(data?.audit ?? []);
  }

  async listRules(userKey: string) {
    const data = await this.data(userKey);
    return clone((data?.rules ?? []).slice().sort((a, b) => a.merchantKey.localeCompare(b.merchantKey)));
  }

  async upsertRule(userKey: string, rule: StoredLearnedRule) {
    const data = (await this.data(userKey, true))!;
    const index = data.rules.findIndex(r => r.merchantKey === rule.merchantKey);
    if (index >= 0) data.rules[index] = clone({ ...rule, ruleId: data.rules[index].ruleId });
    else data.rules.push(clone(rule));
    await this.persist();
  }

  async deleteRule(userKey: string, ruleId: string) {
    const data = await this.data(userKey);
    if (!data) return false;
    const before = data.rules.length;
    data.rules = data.rules.filter(r => r.ruleId !== ruleId);
    if (data.rules.length === before) return false;
    await this.persist();
    return true;
  }

  async deleteAll(userKey: string) {
    const data = await this.data(userKey);
    const removed = {
      transactions: data?.transactions.length ?? 0,
      batches: data?.batches.length ?? 0,
      rules: data?.rules.length ?? 0,
    };
    this.users.delete(userKey);
    await this.persist();
    return removed;
  }
}
