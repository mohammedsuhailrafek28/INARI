# Product: INARI

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

INARI is a personal finance intelligence application: a living money model built from a confirmed ledger. It connects financial ingestion, spending intelligence, financial rhythms, goals, commitments, scenarios, refund and reimbursement tracking, and an explainable advisor.

## Users

The brief establishes people exploring their personal finances and reviewers evaluating a synthetic-data demo. A narrower demographic, customer segment, or commercial positioning has not been established.

## Operating Context

Import a synthetic CSV, digital PDF, pasted SMS, or SMS .txt file; review evidence and possible duplicates; confirm the ledger; explore dashboard, spending, goals, recommendations, and advisor. Fictional personas are an alternative demo mode and must remain clearly separated from imported data. The advisor input supports normal typing and Wispr Flow dictation.

## Capabilities and Constraints

- Preserve the working release candidate at f6115b6 and all original WealthVerse/INARI routes and capabilities.
- The existing Express/tRPC financial engine is authoritative. Use one backend and one ledger; React may format amounts and scale visual marks, but must not reproduce financial calculations or create a second financial database.
- Import workflows retain preview/confirm, duplicate review, history, source evidence, and undo. Spending retains corrections, learned rules, reconciliation, subscriptions, manual cash, refunds, and reimbursements. Goals retain confirmed balances, contributions, and projections. Recommendations retain monthly reports, what-ifs, subscription cancellation scenarios, and the No-Cost EMI Reality Check.
- Imported-ledger advisor answers use deterministic inari.ask logic. No external LLM service or claims of a trained language model. Preserve confirmation before money-changing actions.
- Unknown balances remain “Not provided”. Financial figures and chart data must come from the active backend mode, with loading, error, and empty states.
- Synthetic data only; never real personal bank statements. Sessions use temporary per-browser demo identities, not real sign-in. Server storage is in memory and can disappear on restart.
- Educational scenario modeling; no specific securities recommendations or automatic financial actions.

## Brand Commitments

Retain INARI. The approved reference direction is Swathi's deep black, warm ivory, vermilion, editorial typography, elegant financial panels, sophisticated navigation, and restrained motion. Matching editable Swathi design source was absent: implement the selected patterns in clean React, without a minified production dependency, portfolio branding, or property-management imagery.

## Evidence on Hand

The explicit final integration brief and current implementation are the source of this record. Canonical synthetic acceptance data specifies 494 written transactions, income ₹85,102, expenses ₹57,476.04, surplus ₹27,625.96, and savings rate 32.46%; these are fixture expectations, never universal dashboard defaults. No testimonials, market claims, production identity service, or durable data persistence are established.

## Product Principles

- One financial truth across every page.
- Evidence and uncertainty remain visible.
- Review and explicit confirmation precede posting or money-changing actions.
- Keep the full working application connected while improving its presentation.

## Open Decisions

A production audience definition, hosting commitment, real authentication, and durable storage are outside this approved demo scope. No assumptions about those capabilities are made here.
