/** Helpers for balances the user has not supplied. Kept dependency-free so every engine can import it. */
export type KnownBalance = "emergencyFund" | "investments" | "creditCardDebt";
export type KnownFlags = { emergencyFund: boolean; investments: boolean; creditCardDebt: boolean };

/** `known` omitted means every balance is known (legacy demo profiles). */
export const isKnown = (metrics: { known?: KnownFlags }, key: KnownBalance) => metrics.known?.[key] !== false;
