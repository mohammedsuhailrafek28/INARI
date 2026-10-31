# Training data (placeholder — nothing downloaded)

Candidate: **Ranjit0034/finee-dataset** (Hugging Face, Apache-2.0).

Status: **not downloaded.** The repository stores its data as Git-LFS pointers (the train file alone is ~198 MB). Downloading, PII screening and sampling are deferred until the CSV → ledger → snapshot → simulation path is finished; SLM fine-tuning is explicitly out of scope until then.

Before any use:
1. Fetch only a small sample over HTTP range requests into an isolated directory; do not run code from the dataset.
2. The dataset may include anonymised real ICICI SMS. Screen for names, phone numbers, full account/card numbers, UPI VPAs and e-mail addresses; drop rows that fail.
3. Keep the sample in `data/training/` only. It must never be used as an evaluation set for the parsers in `data/parser-tests/`.
4. Do not describe any model trained on it as "fine-tuned" until a training run has actually been executed and evaluated.
