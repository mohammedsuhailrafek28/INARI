# INARI SLM / transfer-learning forensic audit

## Verdict

**SLM fine-tuning and transfer learning have not been performed for INARI.**

No model was trained, fine-tuned, evaluated, saved, deployed or used by INARI. No dataset was downloaded. The only FinEE material in the project is a *plan* in a README. Nothing in this report is inferred from the README alone; the searches below were run against the repository, the git history, other local directories and the machine's model cache.

## Lifecycle checklist

| Stage | Status | Evidence |
|---|---|---|
| Planned | **Yes** | `data/training/README.md`, `data/README.md` row for `training/`, `PS04_GAP_ANALYSIS.md:266` (optional "merchant→category suggestions", "embeddings for merchant similarity", "all with deterministic Node fallbacks") |
| Dataset identified | **Yes** | Candidate `Ranjit0034/finee-dataset` (Hugging Face, Apache-2.0), named in `data/training/README.md` and `NOTICE.md:16` |
| Dataset downloaded | **No** | `data/training/` contains only `README.md` ("Status: **not downloaded**"). No `finee*` file exists in the repo, in `INARI-backup`, `wealthverse-*`, `Documents`, `Downloads`, or the Hugging Face cache |
| Data screened (PII) | **No** | README lists screening as a *future* step; no screened sample exists |
| Training configured | **No** | No training script, config, LoRA/PEFT adapter config, tokenizer or notebook is tracked (`git ls-files` filter for `.ipynb`, `train*`, `lora`, `peft`, `adapter`, `finetune`, `tokenizer`: only `data/training/README.md` matches) |
| Training executed | **No** | No trainer state, log, loss curve or GPU job record. `git log --all` (122 commits) has no commit message mentioning SLM, fine-tune, training, FinEE or LoRA beyond the README. |
| Checkpoint saved | **No** | No `.safetensors`, `.gguf`, `.onnx`, `.ckpt`, `.pt`, `.pkl`, `.joblib` in the repo or its backups |
| Evaluation executed | **No** | No accuracy / precision / recall / F1 for any INARI model exists. The only "accuracy" numbers in this audit are rule-system scores from `INARI_NLP_EVALUATION.md` |
| Model deployed | **No** | No inference endpoint, no model-loading code, no ML dependency in `package.json` (only `pdfjs-dist` was added for PDF text) |
| Model used by INARI | **No** | `inari.ask` returns `engine:{kind:"deterministic",llmUsed:false}` on every call; `categorize.ts` header says "rules + user feedback, NOT a trained or fine-tuned model" |

## What I searched

1. **Repository** (tracked): by filename (`*.safetensors|gguf|onnx|pt|pth|bin|ckpt|h5|pkl|joblib`, `lora`, `peft`, `adapter`, `finee`, `tokenizer`, `train`, `finetune`, `huggingface`, `*.ipynb`) and by content (`transformers|huggingface|hf_hub|peft|lora|finee|torch|onnx|sentence-transformers|embedding|fine-?tun|distilbert|xlm|bert|slm`). Hits: documentation only (`NOTICE.md`, `data/README.md`, `data/training/README.md`, `PS04_GAP_ANALYSIS.md`, `docs/FRONTEND_HANDOFF.md`, `server/inari/categorize.ts` comments).
2. **Git history**: all refs (122 commits), files ever added matching `train|model|lora|finee|notebook|colab`: only `data/training/README.md` and `server/inari/importedModel.ts` (the latter is the ledger→legacy-engine adapter, not an ML model). Local stash contains the PDF WIP only.
3. **Untracked/ignored files** in the repo: only `dist/` and `.claude/`.
4. **Other local directories** that could hold INARI work: `Documents/INARI-backup`, `Documents/wealthverse-frontend`, `Documents/wealthverse-project`, `Documents/wealthverse-project (1)`, `Documents/ML-PROJECT`, `Documents/DS-project`: no SLM, FinEE, adapter or checkpoint files.
5. **Machine model cache** `~/.cache/huggingface/hub`: contains SAM2, CLIP/SigLIP, `all-MiniLM-L6-v2` and similar models. These belong to other projects (cv-shield and others); **nothing in INARI imports or references any of them** (content grep above). They must not be described as INARI components.
6. **Environment**: Python has `torch`, `onnxruntime`, `scikit-learn` installed but **not** `transformers`, `peft`, `datasets`, `accelerate` or `bitsandbytes`; `nvidia-smi` shows an NVIDIA GPU exists (driver 595.95). So fine-tuning has not been run with the usual Hugging Face stack on this machine, and the capability to run it would need installation.

## What about the legacy WealthVerse ML/NLP?

- `server/wealth/nlp/*`: rule-based intent classifier, synonym dictionary and entity extractor. No pretrained model.
- `server/wealth/predictions/*`: forecasting by simple arithmetic over the persona context (no trained model).
- `server/wealth/advisorEngine.ts` / `server/_core/llm.ts`: **can** call an external chat-completions endpoint (`model: "gpt-4o-mini"` via `BUILT_IN_FORGE_API_URL/KEY`) when a key is configured. That is *inference through a third-party API*, not transfer learning, and is disabled in the deployment config (no key in `render.yaml`). INARI's own router never calls it (`inari.noexternal.test.ts`).
- `server/_core/voiceTranscription.ts`: client for an external transcription service, unused by INARI.

## Honest wording for the submission

Allowed: "INARI uses deterministic rules and user feedback for categorisation and intent; an SLM for merchant/intent classification is planned future work."
Not allowed: "fine-tuned", "transfer learning", "trained on FinEE", "SLM-powered", or any accuracy figure for a model.

---

# Proposal (NOT performed): SLM / transfer-learning feasibility

This section is a proposal only. No experiment was run for it.

**Task worth doing.** Narrow intent classification of dictated finance utterances (≈15 labels: spending_question, what_if, manual_entry, refund_status, reimbursement_status, emi_check, subscription_query, goal_progress, monthly_review, category_correction, unsafe_request, unknown…) plus optionally entity tags (amount, category, merchant, date). This targets the measured weakness: ~40% out-of-sample accuracy of the regex router.

**Candidate models.**

| Option | Size | Why | Footprint |
|---|---|---|---|
| `distilbert-base-multilingual-cased` or `xlm-roberta-base` fine-tuned as a classifier | 135M–280M | Handles Hindi/Hinglish script if data exist | ~270–560 MB fp32; ONNX int8 ≈ 70–150 MB; ~10–40 ms CPU per utterance |
| `all-MiniLM-L6-v2` embeddings + logistic regression / kNN (already cached on this machine, from another project) | 22M | Fastest path, no GPU, few-shot friendly | ~90 MB; ~5–15 ms |
| 0.5–1B instruction model (e.g. Qwen2.5-0.5B) + LoRA | 500M | Generative slot filling | 1+ GB; slower; harder to keep deterministic and guardrailed |

Recommended order: MiniLM embeddings + linear head first (hours), DistilBERT/XLM-R fine-tune second.

**Dataset reality.**
- **FinEE** (`Ranjit0034/finee-dataset`, Apache-2.0 claimed): it targets *SMS/transaction field extraction*, not dictated-intent classification, and the README here says it may contain anonymised real ICICI SMS. It is a poor fit for the intent task and carries PII-screening cost. Its licence claim and provenance must be verified before use.
- For dictated intents there is **no suitable public dataset**; the realistic source is a few hundred to ~2,000 synthetic utterances written by the team (templates + paraphrase + Hinglish variants), labelled by hand, with a separate held-out set written by someone who did not write the templates.
- The existing 172-row public SMS dataset (`data/parser-tests/sms`, with its own LICENSE/ATTRIBUTION) could evaluate SMS field extraction, not intents.

**Hardware.** An NVIDIA GPU is present, but `transformers`, `peft` and `datasets` are not installed. A 22M–135M classifier fine-tunes in minutes to an hour on this GPU, or in a few hours on CPU.

**Independent evaluation plan.** (1) Freeze a held-out set (≥150 utterances) written by a different person, never used for tuning. (2) Report accuracy, macro-F1 and a confusion matrix, comparing: current regex router; classifier alone; classifier + regex fallback. (3) Report per-slice results (number words, corrections, Hinglish, unsafe requests). (4) Safety gate: the model may only *route*; amounts must still pass through `FactBook`/`guardText`, and any low-confidence or unsafe label falls back to the deterministic path. (5) Keep inference local (ONNX Runtime in Node or a Python sidecar) — no financial text sent to third parties.

**Expected advantages vs. rules.** Better robustness to paraphrase and word order (the 1/7 manual-entry and 1/5 what-if slices), possible Hinglish. Not an advantage: arithmetic and grounding, which should remain deterministic.

**Risks.** Single-service Render deployment would grow by the runtime and model (~100–500 MB); cold-start latency; a model can mislabel unsafe requests that regexes currently catch; evaluation data written by the same author inflate scores.

**Realism before submission.** A *training run* with synthetic data is feasible in a few hours, but doing it credibly (dataset creation, independent held-out set, integration with guardrails, deployment size, regression testing) is **not realistic** within the remaining hackathon window without displacing demo readiness work. If attempted, limit it to the embeddings+linear-head baseline as a clearly labelled experiment, off by default, and report its measured accuracy honestly; otherwise present it as roadmap.
