CREATE TABLE IF NOT EXISTS app_rewards_privileges__rewards (
  id          TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cost_points INTEGER NOT NULL DEFAULT 10 CHECK (cost_points > 0),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS app_rewards_privileges__redemption_requests (
  id           TEXT NOT NULL,
  reward_id    TEXT NOT NULL,
  member_id    TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (reward_id) REFERENCES app_rewards_privileges__rewards(id)
);

CREATE TABLE IF NOT EXISTS app_rewards_privileges__redemption_decisions (
  id         TEXT NOT NULL,
  request_id TEXT NOT NULL,
  reward_id  TEXT NOT NULL,
  member_id  TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('approved', 'rejected')),
  decided_at TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (request_id),
  FOREIGN KEY (request_id) REFERENCES app_rewards_privileges__redemption_requests(id),
  FOREIGN KEY (reward_id) REFERENCES app_rewards_privileges__rewards(id)
);

CREATE INDEX IF NOT EXISTS idx_rewards_status
  ON app_rewards_privileges__rewards(status);

CREATE INDEX IF NOT EXISTS idx_redemption_requests_member
  ON app_rewards_privileges__redemption_requests(member_id, requested_at);

CREATE INDEX IF NOT EXISTS idx_redemption_decisions_member_status
  ON app_rewards_privileges__redemption_decisions(member_id, status);
