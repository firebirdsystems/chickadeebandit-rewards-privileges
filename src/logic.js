export function pointsFromLedger(ledger, memberId) {
  return ledger
    .filter(row => row.member_id === memberId)
    .reduce((sum, row) => sum + Math.max(0, Number(row.points ?? 0)), 0);
}

export function spentPoints(redemptions, memberId) {
  return redemptions
    .filter(r => r.member_id === memberId && (r.status === "approved" || r.status === "pending"))
    .reduce((sum, r) => sum + Math.max(0, Number(r.cost_points ?? 0)), 0);
}

export function availablePoints(ledger, redemptions, memberId) {
  return Math.max(0, pointsFromLedger(ledger, memberId) - spentPoints(redemptions, memberId));
}

/**
 * Balance from pre-aggregated earnings: `earnedByMember` maps member_id to
 * rollup opening points + SUM of the live ledger tail, both computed in SQL.
 * The client no longer fetches ledger rows at all — the ledger expires at the
 * retention window and the runner folds expiring rows into the rollup in the
 * same transaction, so this total never moves when history ages out.
 */
export function availablePointsFromEarned(earnedByMember, redemptions, memberId) {
  const earned = Math.max(0, Number(earnedByMember.get(memberId) ?? 0));
  return Math.max(0, earned - spentPoints(redemptions, memberId));
}

export function combineRedemptions(rewards, requests, decisions) {
  const rewardsById = new Map(rewards.map(reward => [reward.id, reward]));
  const decisionsByRequest = new Map(decisions.map(decision => [decision.request_id, decision]));

  return requests.map(request => {
    const reward = rewardsById.get(request.reward_id);
    const decision = decisionsByRequest.get(request.id);
    return {
      id: request.id,
      request_id: request.id,
      reward_id: request.reward_id,
      member_id: request.member_id,
      cost_points: Math.max(0, Number(reward?.cost_points ?? 0)),
      status: decision?.status ?? "pending",
      requested_at: request.requested_at,
      decided_at: decision?.decided_at,
      decided_by: decision?.decided_by,
      decision_id: decision?.id,
      reward_available: reward?.status === "active",
    };
  });
}

export function rewardProgress(points, reward) {
  const cost = Math.max(0, Number(reward?.cost_points ?? 0));
  if (cost === 0) return 100;
  return Math.min(100, Math.round((Math.max(0, points) / cost) * 100));
}

export function canRedeem(points, reward) {
  return Math.max(0, points) >= Math.max(0, Number(reward?.cost_points ?? 0));
}

export function pendingForReward(redemptions, memberId, rewardId) {
  return redemptions.some(r =>
    r.member_id === memberId &&
    r.reward_id === rewardId &&
    r.status === "pending"
  );
}

/**
 * Fields the in-app search matches against (see hub-sdk `searchMatch`).
 * The description spells out what a reward actually gets you, which
 * is what a child scans the catalogue for.
 */
export function searchableFields(item) {
  return [item.title, item.description];
}
