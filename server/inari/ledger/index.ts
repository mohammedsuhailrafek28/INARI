import path from "node:path";
import { FileLedgerRepository } from "./fileLedgerRepository";
import type { LedgerRepository } from "./types";

export * from "./types";
export { FileLedgerRepository } from "./fileLedgerRepository";

let instance: LedgerRepository | null = null;

/** INARI_LEDGER_STORE=memory (default) | json. `json` file lives in .runtime/inari-data (gitignored). */
export function getLedgerRepository(): LedgerRepository {
  if (instance) return instance;
  instance =
    process.env.INARI_LEDGER_STORE === "json"
      ? new FileLedgerRepository({
          filePath: path.join(process.env.INARI_DATA_DIR ?? path.join(process.cwd(), ".runtime", "inari-data"), "ledger.json"),
        })
      : new FileLedgerRepository();
  return instance;
}

export function setLedgerRepositoryForTests(repo: LedgerRepository | null) {
  instance = repo;
}
