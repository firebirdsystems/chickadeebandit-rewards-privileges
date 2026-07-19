-- Durable earned-points ledger. Reward balances used to be summed from
-- chore.completed bus events at read time, but the hub prunes app events after
-- ~30 days, so a kid saving toward an expensive reward would watch their balance
-- silently shrink. The Hub's automation dispatcher folds each chore.completed
-- into a row here (deduped by the triggering event id) so points persist.
CREATE TABLE IF NOT EXISTS app_rewards_privileges__points_ledger (
  event_id  TEXT NOT NULL,
  member_id TEXT NOT NULL,
  points    INTEGER NOT NULL DEFAULT 0,
  earned_at TEXT NOT NULL,
  PRIMARY KEY (event_id)
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_member
  ON app_rewards_privileges__points_ledger(member_id);
