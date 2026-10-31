/**
 * Goals. User-entered targets, stored on the owner's profile. Nothing here is inferred from the ledger: the
 * current amount and the monthly contribution are whatever the user said, and projections are plain arithmetic
 * (remaining / monthly contribution), with no returns, interest or inflation.
 */
import { randomUUID } from "node:crypto";
import type { Goal, GoalInput, GoalsOutput as GoalsOutputT } from "../../shared/inari/contracts";
import { InariError } from "./errors";
import { loadImportedModel } from "./importedModel";
import { getLedgerRepository } from "./ledger";
import type { StoredGoal, StoredProfile } from "./ledger/types";

export const MAX_GOALS = 20;
const MAX_RUPEES = 1_000_000_000;

const toPaise = (rupees: number) => Math.round(rupees * 100);
const rupees = (paise: number) => paise / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

const TYPE_LABEL: Record<StoredGoal["goalType"], string> = {
  emergency_fund: "Emergency fund", house: "House", car: "Car", education: "Education", retirement: "Retirement",
  travel: "Travel", wedding: "Wedding", gadget: "Gadget", debt_free: "Become debt free", custom: "Custom goal",
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Months until the goal is reached at `contribution` per month, or null when that cannot be computed. */
export function monthsToGoal(targetAmount: number, currentAmount: number, contribution: number | null): number | null {
  const remaining = toPaise(targetAmount) - toPaise(currentAmount);
  if (remaining <= 0) return 0;
  if (!contribution || contribution <= 0) return null;
  return Math.ceil(remaining / toPaise(contribution));
}

/** Last day of the month that is `months` after `now`'s month (today's date when already complete). */
export function completionDate(months: number | null, now: Date): string | null {
  if (months === null) return null;
  if (months === 0) return isoDate(now);
  return isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months + 1, 0)));
}

export function describeGoal(g: StoredGoal, now: Date): Goal {
  const remainingP = Math.max(0, toPaise(g.targetAmount) - toPaise(g.currentAmount));
  const months = monthsToGoal(g.targetAmount, g.currentAmount, g.monthlyContribution);
  const requiredMonthly = remainingP > 0 && g.timelineMonths ? rupees(Math.ceil(remainingP / g.timelineMonths)) : null;
  let status: NonNullable<Goal["status"]>;
  const notes: string[] = [];
  if (remainingP === 0) status = "completed";
  else if (g.monthlyContribution === null || g.monthlyContribution <= 0) {
    status = "no_contribution";
    notes.push("No monthly contribution is set, so no completion date can be projected.");
  } else if (!g.timelineMonths) status = "no_deadline";
  else status = toPaise(g.monthlyContribution) >= toPaise(requiredMonthly ?? 0) ? "on_track" : "behind";
  if (status === "behind") notes.push("The monthly contribution is below what the deadline needs.");
  notes.push("Amounts are as entered by you; no investment returns or interest are assumed.");
  return {
    id: g.id, goalType: g.goalType, name: g.name, targetAmount: g.targetAmount, currentAmount: g.currentAmount,
    timelineMonths: g.timelineMonths, priority: g.priority,
    progressPercent: g.targetAmount > 0 ? round1(Math.min(100, (g.currentAmount / g.targetAmount) * 100)) : 0,
    projectedCompletion: completionDate(months, now),
    remainingAmount: rupees(remainingP), monthlyContribution: g.monthlyContribution, requiredMonthly, status, notes,
  };
}

const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]", "g");
const cleanName = (s: string) => s.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();

function validate(input: GoalInput) {
  const checks: Array<[string, number]> = [["target amount", input.targetAmount], ["current amount", input.currentAmount], ["monthly contribution", input.monthlyContribution ?? 0]];
  for (const [label, v] of checks) {
    if (!Number.isFinite(v) || v < 0 || v > MAX_RUPEES) throw new InariError("INVALID_INPUT", `The ${label} is not valid.`);
  }
  if (toPaise(input.targetAmount) <= 0) throw new InariError("INVALID_INPUT", "The target amount must be more than zero.");
}

const withGoals = (current: StoredProfile | null, goals: StoredGoal[]): StoredProfile => ({
  emergencyFund: null, investments: null, creditCardDebt: null, useDemo: false, ...current, goals,
});

export async function storedGoalsFor(userKey: string): Promise<StoredGoal[]> {
  return (await getLedgerRepository().getProfile(userKey))?.goals ?? [];
}

export async function listGoalsFor(userKey: string, now = new Date()): Promise<Goal[]> {
  return (await storedGoalsFor(userKey)).map(g => describeGoal(g, now));
}

export async function upsertGoalFor(userKey: string, input: GoalInput, now = new Date()): Promise<string> {
  validate(input);
  const repo = getLedgerRepository();
  const current = await repo.getProfile(userKey);
  const goals = [...(current?.goals ?? [])];
  const at = now.toISOString();
  const fields = {
    goalType: input.goalType,
    name: cleanName(input.name ?? "") || TYPE_LABEL[input.goalType],
    targetAmount: rupees(toPaise(input.targetAmount)),
    currentAmount: rupees(toPaise(input.currentAmount)),
    timelineMonths: input.timelineMonths ?? null,
    priority: input.priority,
    monthlyContribution: input.monthlyContribution === undefined ? null : rupees(toPaise(input.monthlyContribution)),
  };
  let id: string;
  if (input.id) {
    const i = goals.findIndex(g => g.id === input.id);
    if (i < 0) throw new InariError("NOT_FOUND", "Goal not found.");
    id = input.id;
    goals[i] = { ...fields, id, createdAt: goals[i].createdAt, updatedAt: at };
  } else {
    if (goals.length >= MAX_GOALS) throw new InariError("CONFLICT", `You can keep up to ${MAX_GOALS} goals. Delete one first.`);
    id = `goal_${randomUUID()}`;
    goals.push({ ...fields, id, createdAt: at, updatedAt: at });
  }
  await repo.setProfile(userKey, withGoals(current, goals));
  return id;
}

export async function deleteGoalFor(userKey: string, id: string): Promise<void> {
  const repo = getLedgerRepository();
  const current = await repo.getProfile(userKey);
  const goals = current?.goals ?? [];
  if (!goals.some(g => g.id === id)) throw new InariError("NOT_FOUND", "Goal not found.");
  await repo.setProfile(userKey, withGoals(current, goals.filter(g => g.id !== id)));
}

/** Goals plus a plain affordability check against the verified monthly surplus (null when no complete month exists). */
export async function goalsOverview(userKey: string, now = new Date()): Promise<GoalsOutputT> {
  const [stored, model] = await Promise.all([storedGoalsFor(userKey), loadImportedModel(userKey)]);
  const items = stored.map(g => describeGoal(g, now));
  const totalP = stored.filter(g => toPaise(g.currentAmount) < toPaise(g.targetAmount)).reduce((sum, g) => sum + toPaise(g.monthlyContribution ?? 0), 0);
  const m = model?.metrics ?? null;
  const surplusP = m ? toPaise(m.monthlyIncome) - toPaise(m.monthlyExpenses) : null;
  const warnings: string[] = [];
  if (surplusP !== null && totalP > Math.max(0, surplusP)) warnings.push("Your monthly goal contributions are more than your monthly surplus from imported data.");
  if (surplusP === null && totalP > 0) warnings.push("Affordability cannot be checked until a complete month of transactions is imported.");
  return {
    implementation: "implemented",
    items,
    dataSource: model ? "imported" : "demo",
    summary: { totalMonthlyContributions: rupees(totalP), monthlySurplus: surplusP === null ? null : rupees(surplusP), withinSurplus: surplusP === null ? null : totalP <= Math.max(0, surplusP) },
    warnings,
  };
}
