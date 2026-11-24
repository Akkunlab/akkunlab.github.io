CREATE TABLE IF NOT EXISTS session (
  sid TEXT NOT NULL,
  vid TEXT NOT NULL,
  day TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  path TEXT NOT NULL,
  referrer TEXT NOT NULL DEFAULT '',
  utm TEXT NOT NULL DEFAULT '{}',
  device TEXT NOT NULL DEFAULT '',
  viewport TEXT NOT NULL DEFAULT '',
  events TEXT NOT NULL,
  PRIMARY KEY (sid, vid)
);

CREATE INDEX IF NOT EXISTS session_day ON session (day);
CREATE INDEX IF NOT EXISTS session_started_at ON session (started_at);

CREATE TABLE IF NOT EXISTS salt (
  day TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
