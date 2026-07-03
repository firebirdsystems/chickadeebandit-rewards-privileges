export function pointsFromChoreEvents(events, memberId) {
  return events
    .filter(ev => ev.type === "chore.completed" && ev.payload?.member_id === memberId)
    .reduce((sum, ev) => sum + Math.max(0, Number(ev.payload?.points ?? 0)), 0);
}

export function spentPoints(redemptions, memberId) {
  return redemptions
    .filter(r => r.member_id === memberId && (r.status === "approved" || r.status === "pending"))
    .reduce((sum, r) => sum + Math.max(0, Number(r.cost_points ?? 0)), 0);
}

export function availablePoints(events, redemptions, memberId) {
  return Math.max(0, pointsFromChoreEvents(events, memberId) - spentPoints(redemptions, memberId));
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
