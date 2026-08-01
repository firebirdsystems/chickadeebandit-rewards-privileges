/**
 * Retention on the points ledger was blocked on balance semantics: every
 * balance was a JS sum over EVERY ledger row (fetched whole on every load), so
 * expiring rows silently shrank a kid's spendable points. The manifest now
 * declares retain_days with a fold — the hub's retention runner accumulates an
 * expiring batch into points_rollup inside the same transaction as the delete —
 * and the client derives earnings in SQL as rollup + SUM(live tail).
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";
import { availablePointsFromEarned, spentPoints } from "../src/logic.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf-8"));
const migration = readFileSync(join(__dirname, "../migrations/003_points_rollup.sql"), "utf-8");
const client = readFileSync(join(__dirname, "../src/index.html"), "utf-8");

describe("points_ledger retention fold", () => {
  const retain = manifest.row_policies.points_ledger.retain_days;

  it("declares the fold into points_rollup", () => {
    expect(retain).toMatchObject({
      default: 730,
      timestamp_column: "earned_at",
      id_column: "event_id",
      override_key: "points_history",
      fold: {
        into_table: "points_rollup",
        key_columns: { member_id: "member_id" },
        sum_columns: { points: "points" },
        folded_through_column: "folded_through_at",
      },
    });
  });

  it("the rollup has a PRIMARY KEY over the fold key and a numeric accumulator", () => {
    expect(migration).toMatch(/PRIMARY KEY \(member_id\)/);
    expect(migration).toMatch(/points\s+INTEGER NOT NULL DEFAULT 0/);
    expect(migration).toMatch(/ON app_rewards_privileges__points_ledger\(earned_at, event_id\)/);
  });

  it("the rollup is governed and member-read like the ledger, and covered by the ratchet", () => {
    expect(manifest.row_policies.points_rollup).toEqual({ kind: "adult_writable", member_read_column: "member_id" });
    expect(manifest.member_references.points_rollup).toMatchObject({ column: "member_id", on_removed: "delete" });
  });

  it("redemption_requests deliberately carries NO retention — cost lives on the reward row, so expiring requests would inflate balances", () => {
    expect(manifest.row_policies.redemption_requests.retain_days).toBeUndefined();
    expect(manifest.retention?.redemption_requests).toBeUndefined();
  });

  it("the client aggregates in SQL instead of fetching the whole ledger", () => {
    expect(client).toMatch(/SELECT member_id, COALESCE\(SUM\(points\), 0\) AS earned FROM app_rewards_privileges__points_ledger GROUP BY member_id/);
    expect(client).toMatch(/SELECT member_id, points FROM app_rewards_privileges__points_rollup/);
    expect(client).not.toMatch(/SELECT event_id, member_id, points FROM app_rewards_privileges__points_ledger/);
  });
});

describe("availablePointsFromEarned", () => {
  const redemptions = [
    { member_id: "kid-1", status: "approved", cost_points: 25 },
    { member_id: "kid-1", status: "pending", cost_points: 10 },
    { member_id: "kid-1", status: "denied", cost_points: 99 },
    { member_id: "kid-2", status: "approved", cost_points: 5 },
  ];

  it("subtracts pending and approved redemptions from the aggregated earnings", () => {
    const earned = new Map([["kid-1", 100], ["kid-2", 3]]);
    expect(availablePointsFromEarned(earned, redemptions, "kid-1")).toBe(65);
    // Floors at zero, same as the ledger-summing derivation.
    expect(availablePointsFromEarned(earned, redemptions, "kid-2")).toBe(0);
    expect(availablePointsFromEarned(earned, redemptions, "kid-3")).toBe(0);
  });

  it("matches the old derivation's spent math", () => {
    expect(spentPoints(redemptions, "kid-1")).toBe(35);
  });
});
