# Notice and attribution

INARI is derived from **WealthVerse** (https://github.com/mohammedsuhailrafek28/wealth-verse), baseline commit `cd75ef1`, MIT-licensed per its `package.json`. The WealthVerse repository itself was not modified; INARI is a separate working copy created from the tracked files of that commit (ignored local files, including local configuration, were intentionally not copied).

Third-party dependencies keep their own licenses (see `pnpm-lock.yaml`).

## Data policy for this repository
- Only synthetic or sanitised financial data may be committed or used in the public demo.
- Never commit credentials. If a credential is ever committed, rotate it and report it; do not rely on deleting the file.
- Anonymous per-browser demo identity (planned) is a demo isolation mechanism, **not** production authentication.
