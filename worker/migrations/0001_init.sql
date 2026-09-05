PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  points INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY,
  slot_a_label TEXT,
  slot_a_value TEXT,
  slot_b_label TEXT,
  slot_b_value TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'settled', 'cancelled')),
  created_at TEXT,
  settled_at TEXT
);

CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES rounds(id),
  participant_id TEXT NOT NULL REFERENCES participants(id),
  stake INTEGER NOT NULL,
  guess_a TEXT NOT NULL,
  guess_b TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (round_id, participant_id)
);

CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES rounds(id),
  slot TEXT NOT NULL CHECK (slot IN ('a', 'b')),
  winner_participant_ids TEXT,
  points_awarded INTEGER,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS point_history (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id),
  delta INTEGER,
  reason TEXT,
  round_id TEXT REFERENCES rounds(id),
  created_at TEXT
);

-- 外部キー参照列のインデックス
CREATE INDEX IF NOT EXISTS idx_bets_round_id ON bets(round_id);
CREATE INDEX IF NOT EXISTS idx_bets_participant_id ON bets(participant_id);
CREATE INDEX IF NOT EXISTS idx_settlements_round_id ON settlements(round_id);
CREATE INDEX IF NOT EXISTS idx_point_history_participant_id ON point_history(participant_id);
CREATE INDEX IF NOT EXISTS idx_point_history_round_id ON point_history(round_id);

-- 初期設定値
INSERT INTO settings (key, value) VALUES ('initial_points', '1000');
