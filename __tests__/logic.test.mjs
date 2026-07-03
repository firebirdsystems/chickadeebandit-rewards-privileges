import { describe, expect, it } from "vitest";
import {
  availablePoints,
  canRedeem,
  combineRedemptions,
  pendingForReward,
  pointsFromChoreEvents,
  rewardProgress,
  spentPoints,
} from "../src/logic.js";

const events = [
  { type: "chore.completed", payload: { member_id: "kid-1", points: 5 } },
  { type: "chore.completed", payload: { member_id: "kid-1", points: 10 } },
  { type: "chore.completed", payload: { member_id: "kid-2", points: 20 } },
  { type: "chore.streak", payload: { member_id: "kid-1", points: 100 } },
];

describe("reward progress logic", () => {
  it("counts chore completion points for one member", () => {
    expect(pointsFromChoreEvents(events, "kid-1")).toBe(15);
    expect(pointsFromChoreEvents(events, "kid-2")).toBe(20);
  });

  it("reserves approved and pending redemptions from available points", () => {
    const redemptions = [
      { member_id: "kid-1", status: "approved", cost_points: 6 },
      { member_id: "kid-1", status: "pending", cost_points: 6 },
      { member_id: "kid-2", status: "approved", cost_points: 20 },
    ];
    expect(spentPoints(redemptions, "kid-1")).toBe(12);
    expect(availablePoints(events, redemptions, "kid-1")).toBe(3);
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
