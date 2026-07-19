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
