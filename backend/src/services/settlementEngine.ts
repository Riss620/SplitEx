export interface SettlementSuggestion {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  currency: string;
}

export interface UserBalance {
  userId: string;
  name: string;
  net: number;
}

/**
 * Computes minimal transactions to settle all debts in a group.
 * Assumes all net balances sum up to approximately 0.
 */
export const generateMinimalSettlements = (
  balances: UserBalance[],
  currency: string = 'INR'
): SettlementSuggestion[] => {
  // Separate into debtors (net < 0) and creditors (net > 0)
  const debtors = balances
    .filter((b) => b.net < -0.01)
    .map((b) => ({ ...b, net: Math.abs(b.net) })) // convert to positive for matching
    .sort((a, b) => b.net - a.net); // Sort descending (most debt first)

  const creditors = balances
    .filter((b) => b.net > 0.01)
    .sort((a, b) => b.net - a.net); // Sort descending (most credit first)

  const settlements: SettlementSuggestion[] = [];

  let dIdx = 0;
  let cIdx = 0;

  // Pair largest debtor with largest creditor
  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    if (debtor.net < 0.01) {
      dIdx++;
      continue;
    }
    if (creditor.net < 0.01) {
      cIdx++;
      continue;
    }

    const settleAmount = Math.min(debtor.net, creditor.net);
    
    settlements.push({
      fromUserId: debtor.userId,
      fromUserName: debtor.name,
      toUserId: creditor.userId,
      toUserName: creditor.name,
      amount: Number(settleAmount.toFixed(2)),
      currency,
    });

    debtor.net = Number((debtor.net - settleAmount).toFixed(2));
    creditor.net = Number((creditor.net - settleAmount).toFixed(2));

    if (debtor.net < 0.01) {
      dIdx++;
    }
    if (creditor.net < 0.01) {
      cIdx++;
    }
  }

  return settlements;
};
