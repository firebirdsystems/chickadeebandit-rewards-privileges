CREATE TABLE IF NOT EXISTS app_rewards_privileges__rewards (
  id          TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind        TEXT NOT NULL DEFAULT 'privilege',
  cost_points INTEGER NOT NULL DEFAULT 10,
  status      TEXT NOT NULL DEFAULT 'active',
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS app_rewards_privileges__redemptions (
  id           TEXT NOT NULL,
  reward_id    TEXT NOT NULL,
  member_id    TEXT NOT NULL,
  cost_points  INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  requested_at TEXT NOT NULL,
  decided_at   TEXT,
  decided_by   TEXT,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_rewards_status
  ON app_rewards_privileges__rewards(status);

CREATE INDEX IF NOT EXISTS idx_redemptions_member_status
  ON app_rewards_privileges__redemptions(member_id, status);
