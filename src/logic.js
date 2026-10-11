/**
 * A reward as the page may use it. `cost_points` is declared INTEGER, but
 * SQLite stores whatever text it is handed and the column's CHECK passes it
 * (text compares greater than a number), so a row written straight through the
 * database can carry markup or a non-number there. The cost becomes a whole
 * number here, once, and a reward without a usable one is treated as hidden:
 * it cannot be requested, and a request already made for it can be rejected.
 */
export function normalizeReward(reward) {
  const cost = Number(reward?.cost_points);
  const usable = Number.isFinite(cost) && cost >= 1;
  return { ...reward, cost_points: usable ? Math.floor(cost) : 0, status: usable ? reward.status : "archived" };
}

/**
 * The automation that feeds points, when none is running: the one to name in
 * the notice. Several automations can credit points (chores, practice), and
 * points are arriving as long as any one of them is on, so the notice is for
 * the case where none is. One that is off is named ahead of one whose source
 * app is missing, since turning it on is the nearer fix. "Off" covers both a
 * switched-off automation and an optional one never turned on, so the notice
 * says "is off", not "was switched off". `publishers` are the apps whose
 * automation cannot run until they are installed.
 */
export function stalledPointsSource(automations) {
  const credits = (automations ?? []).filter(a => a?.action_id === "credit_points");
  if (credits.length === 0 || credits.some(a => a.state === "on")) return null;
  const named = credits.find(a => a.state === "off") ?? credits[0];
  const publishers = [...new Set(credits.filter(a => a.state !== "off").flatMap(a => a.publishers ?? []))];
  return { state: named.state, title: named.title, publishers };
}

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

/** Points already paid out: the member's approved redemptions. */
export function approvedPoints(redemptions, memberId) {
  return redemptions
    .filter(r => r.member_id === memberId && r.status === "approved")
    .reduce((sum, r) => sum + Math.max(0, Number(r.cost_points ?? 0)), 0);
}

/**
 * Whether approving a request stays within what its member has earned. Only
 * approved redemptions count against it: a pending request is a hold, and each
 * hold is weighed when it is answered. The child's page checks the balance
 * before asking, but a request can arrive from a stale page or straight
 * through the database, so the reviewer's page checks again.
 */
export function canAffordApproval(earnedByMember, redemptions, redemption) {
  const earned = Math.max(0, Number(earnedByMember.get(redemption.member_id) ?? 0));
  return earned - approvedPoints(redemptions, redemption.member_id) >= Math.max(0, Number(redemption.cost_points ?? 0));
}

/**
 * The answers a reviewer may give a request. A pending request can always be
 * rejected, which is what returns its held points: a request for a reward that
 * was hidden afterwards would otherwise hold them for good. Approving needs the
 * reward still on offer and the points to pay for it.
 */
export function decisionChoices(redemption, affordable = true) {
  if (!redemption || redemption.status !== "pending") return [];
  return redemption.reward_available && affordable ? ["approved", "rejected"] : ["rejected"];
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

// The hub's own test for an adult member (hub-sdk `isAdult`), repeated here so
// the role rules below can be unit-tested without the browser-only SDK.
function isAdultMember(member) {
  return !!member && (member.role === "adult" || member.role === "admin");
}

/**
 * Whether a member answers redemption requests and sees other members' points.
 * Mirrors the hub's rule for the request, decision and points tables: any
 * adult in a household, and only the steward in a shared space. An adult who
 * merely takes part in a space reads nobody else's requests or points, so a
 * balance shown to them would read 0 and a decision would be refused.
 */
export function reviewsRedemptions(member, { tenantKind = "household", isAdmin = false } = {}) {
  return tenantKind === "household" ? isAdultMember(member) : isAdmin === true;
}

/**
 * True when the member list loaded and holds no child. Children earn and
 * redeem the points, so without one nobody can. An empty list means the
 * members could not be read, which says nothing either way.
 */
export function hasNoChildren(members) {
  return members.length > 0 && !members.some(m => !isAdultMember(m));
}
