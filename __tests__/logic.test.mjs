import { describe, expect, it } from "vitest";
import {
  availablePoints,
  canRedeem,
  combineRedemptions,
  pendingForReward,
  pointsFromLedger,
  rewardProgress,
  spentPoints, searchableFields, reviewsRedemptions, hasNoChildren, approvedPoints, canAffordApproval, decisionChoices, normalizeReward, stalledPointsSource } from "../src/logic.js";
import { readFileSync } from "node:fs";

const ledger = [
  { event_id: "e1", member_id: "kid-1", points: 5 },
  { event_id: "e2", member_id: "kid-1", points: 10 },
  { event_id: "e3", member_id: "kid-2", points: 20 },
];

describe("reward progress logic", () => {
  it("sums durable ledger points for one member", () => {
    expect(pointsFromLedger(ledger, "kid-1")).toBe(15);
    expect(pointsFromLedger(ledger, "kid-2")).toBe(20);
  });

  it("reserves approved and pending redemptions from available points", () => {
    const redemptions = [
      { member_id: "kid-1", status: "approved", cost_points: 6 },
      { member_id: "kid-1", status: "pending", cost_points: 6 },
      { member_id: "kid-2", status: "approved", cost_points: 20 },
    ];
    expect(spentPoints(redemptions, "kid-1")).toBe(12);
    expect(availablePoints(ledger, redemptions, "kid-1")).toBe(3);
  });

  it("derives redemption cost and status from rewards and adult decisions", () => {
    const rewards = [{ id: "r1", cost_points: 12, status: "active" }];
    const requests = [
      { id: "req-1", reward_id: "r1", member_id: "kid-1", cost_points: 1, status: "approved", requested_at: "2026-07-02T00:00:00.000Z" },
      { id: "req-2", reward_id: "missing", member_id: "kid-1", requested_at: "2026-07-02T00:00:00.000Z" },
    ];
    const decisions = [
      { id: "dec-1", request_id: "req-1", status: "approved", decided_at: "2026-07-02T01:00:00.000Z", decided_by: "adult-1" },
    ];

    expect(combineRedemptions(rewards, requests, decisions)).toEqual([
      expect.objectContaining({ id: "req-1", cost_points: 12, status: "approved", reward_available: true }),
      expect.objectContaining({ id: "req-2", cost_points: 0, status: "pending", reward_available: false }),
    ]);
  });

  it("calculates clamped progress and redeemability", () => {
    const reward = { cost_points: 20 };
    expect(rewardProgress(5, reward)).toBe(25);
    expect(rewardProgress(50, reward)).toBe(100);
    expect(canRedeem(19, reward)).toBe(false);
    expect(canRedeem(20, reward)).toBe(true);
  });

  it("detects pending requests for a reward", () => {
    const redemptions = [
      { member_id: "kid-1", reward_id: "r1", status: "pending" },
      { member_id: "kid-1", reward_id: "r2", status: "approved" },
    ];
    expect(pendingForReward(redemptions, "kid-1", "r1")).toBe(true);
    expect(pendingForReward(redemptions, "kid-1", "r2")).toBe(false);
  });
});

describe("searchableFields", () => {
  it("matches on the description, which says what the reward gets you", () => {
    expect(searchableFields({ title: "Late night", description: "stay up an extra hour on Friday" }))
      .toContain("stay up an extra hour on Friday");
  });
});

describe("reviewsRedemptions", () => {
  const adult = { id: "a1", role: "adult" };
  const child = { id: "c1", role: "child" };

  it("any adult reviews in a household, which is the default", () => {
    expect(reviewsRedemptions(adult)).toBe(true);
    expect(reviewsRedemptions(child)).toBe(false);
    expect(reviewsRedemptions(null)).toBe(false);
  });

  it("only the steward reviews in a shared space", () => {
    expect(reviewsRedemptions(adult, { tenantKind: "shared_space", isAdmin: false })).toBe(false);
    expect(reviewsRedemptions(adult, { tenantKind: "shared_space", isAdmin: true })).toBe(true);
  });

  it("being a household's admin does not make a child a reviewer", () => {
    expect(reviewsRedemptions(child, { tenantKind: "household", isAdmin: true })).toBe(false);
  });
});

describe("hasNoChildren", () => {
  it("is true for a loaded list of adults only", () => {
    expect(hasNoChildren([{ id: "a1", role: "adult" }, { id: "a2", role: "admin" }])).toBe(true);
  });

  it("is false once any member is not an adult", () => {
    expect(hasNoChildren([{ id: "a1", role: "adult" }, { id: "c1", role: "child" }])).toBe(false);
  });

  it("is false for an empty list, which means the members did not load", () => {
    expect(hasNoChildren([])).toBe(false);
  });
});

describe("answering a request", () => {
  const pending = (id, cost, extra = {}) => ({ id, member_id: "kid-1", cost_points: cost, status: "pending", reward_available: true, ...extra });

  it("offers both answers for a pending request on a reward still on offer", () => {
    expect(decisionChoices(pending("a", 10))).toEqual(["approved", "rejected"]);
  });

  it("still lets a request for a hidden reward be rejected, so its points come back", () => {
    expect(decisionChoices(pending("a", 10, { reward_available: false }))).toEqual(["rejected"]);
  });

  it("offers nothing once a request is answered", () => {
    expect(decisionChoices(pending("a", 10, { status: "approved" }))).toEqual([]);
    expect(decisionChoices(pending("a", 10, { status: "rejected" }))).toEqual([]);
    expect(decisionChoices(undefined)).toEqual([]);
  });

  it("withholds approval the member cannot pay for", () => {
    expect(decisionChoices(pending("a", 10), false)).toEqual(["rejected"]);
  });

  it("counts only approved redemptions as paid out", () => {
    const rows = [pending("a", 40, { status: "approved" }), pending("b", 40), pending("c", 5, { status: "rejected" })];
    expect(approvedPoints(rows, "kid-1")).toBe(40);
    expect(approvedPoints(rows, "kid-2")).toBe(0);
  });

  it("weighs each pending request against what is earned and already paid out", () => {
    const earned = new Map([["kid-1", 50]]);
    const first = pending("a", 40);
    const second = pending("b", 40);
    // Two holds the balance cannot cover together: either may be approved…
    expect(canAffordApproval(earned, [first, second], first)).toBe(true);
    expect(canAffordApproval(earned, [first, second], second)).toBe(true);
    // …and once one is, the other no longer fits.
    const approved = { ...first, status: "approved" };
    expect(canAffordApproval(earned, [approved, second], second)).toBe(false);
    expect(canAffordApproval(new Map(), [second], second)).toBe(false);
  });
});

describe("normalizeReward", () => {
  it("keeps a whole-number cost and the reward's own status", () => {
    expect(normalizeReward({ id: "r", cost_points: "25", status: "active" })).toMatchObject({ cost_points: 25, status: "active" });
    expect(normalizeReward({ id: "r", cost_points: 12.9, status: "archived" })).toMatchObject({ cost_points: 12, status: "archived" });
  });

  it("hides a reward whose stored cost is not a usable number", () => {
    for (const cost of ["<img src=x onerror=alert(1)>", "12abc", null, 0, -3, Infinity]) {
      const reward = normalizeReward({ id: "r", cost_points: cost, status: "active" });
      expect(reward.cost_points).toBe(0);
      expect(reward.status).toBe("archived");
    }
  });

  it("leaves no NaN in a balance when such a reward was requested", () => {
    const rewards = [normalizeReward({ id: "r", cost_points: "12abc", status: "active" })];
    const rows = combineRedemptions(rewards, [{ id: "q", reward_id: "r", member_id: "kid-1", requested_at: "x" }], []);
    expect(spentPoints(rows, "kid-1")).toBe(0);
    expect(decisionChoices(rows[0])).toEqual(["rejected"]);
  });
});

describe("stalledPointsSource", () => {
  const chores = { action_id: "credit_points", state: "unavailable", title: "Chores", publishers: ["Chores"] };
  const practice = { action_id: "credit_points", state: "on", title: "Practice", publishers: ["Practice Log"] };

  it("says nothing while any points automation is running", () => {
    expect(stalledPointsSource([chores, practice])).toBeNull();
    expect(stalledPointsSource([practice, chores])).toBeNull();
  });

  it("says nothing when the hub lists no points automation", () => {
    expect(stalledPointsSource([])).toBeNull();
    expect(stalledPointsSource(null)).toBeNull();
    expect(stalledPointsSource([{ action_id: "something_else", state: "off" }])).toBeNull();
  });

  it("names a switched-off automation ahead of a missing source app", () => {
    const off = { action_id: "credit_points", state: "off", title: "Practice", publishers: ["Practice Log"] };
    // The apps to install are the unavailable ones only; the one that is off is installed.
    expect(stalledPointsSource([chores, off])).toEqual({ state: "off", title: "Practice", publishers: ["Chores"] });
    expect(stalledPointsSource([chores])).toEqual({ state: "unavailable", title: "Chores", publishers: ["Chores"] });
  });
});

describe("member removal order", () => {
  // The hub cleans member_references in the manifest's own order, and a
  // decision row holds a foreign key to its request: requests first fails.
  it("cleans up decisions before the requests they point at", () => {
    const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
    const order = Object.keys(manifest.member_references);
    expect(order.indexOf("redemption_decisions")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("redemption_decisions")).toBeLessThan(order.indexOf("redemption_requests"));
  });

  // And by the foreign key itself, so a decision recorded under another
  // member's id cannot hold its request back.
  it("takes a request's decision with it", () => {
    const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
    expect(manifest.member_references.redemption_requests.dependent_tables)
      .toEqual([{ table: "redemption_decisions", foreign_key: "request_id" }]);
  });
});
