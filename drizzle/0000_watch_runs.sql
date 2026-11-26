CREATE TABLE watch_runs (
  id TEXT PRIMARY KEY NOT NULL,
  problem_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('agent', 'solver')),
  creator_bucket TEXT NOT NULL,
  write_hash TEXT,
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  last_seq INTEGER NOT NULL DEFAULT 0 CHECK (last_seq BETWEEN 0 AND 64),
  events TEXT NOT NULL DEFAULT '[]'
);
--> statement-breakpoint
CREATE INDEX watch_runs_started ON watch_runs (started_at);
--> statement-breakpoint
CREATE INDEX watch_runs_creator_started ON watch_runs (creator_bucket, started_at);
--> statement-breakpoint
CREATE INDEX watch_runs_active ON watch_runs (updated_at) WHERE status = 'running';
