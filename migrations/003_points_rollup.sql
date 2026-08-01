-- Fold-before-expire rollup for the points ledger. Every balance is derived by
-- summing points_ledger against redemptions, so plain retention would silently
-- shrink a kid's spendable points as rows aged out. The manifest declares
-- retain_days with a `fold` on points_ledger: before the retention runner
-- deletes an expired batch it adds the batch's SUM(points) into this table's
-- per-member row, inside the same transaction — the balance becomes
-- rollup + SUM(live ledger) and never moves when history expires.
--
-- Written ONLY by the hub's retention runner (trusted SQL). The row policy is
-- the same adult_writable + member_read_column as the ledger itself: adults
-- already mint points at will, so adult-editable adds no new capability, and
-- kids read only their own row.
CREATE TABLE IF NOT EXISTS app_rewards_privileges__points_rollup (
  member_id         TEXT NOT NULL,
  points            INTEGER NOT NULL DEFAULT 0,
  folded_through_at TEXT,
  PRIMARY KEY (member_id)
);

-- Sweep index for the ledger's retention window (earned_at, then its PK).
CREATE INDEX IF NOT EXISTS app_rewards_privileges__points_ledger_retention_idx
  ON app_rewards_privileges__points_ledger(earned_at, event_id);
