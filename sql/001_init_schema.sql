-- Slime Express PostgreSQL schema
-- Only user_game_infos is required. Levels are served from local client assets / Luban JSON.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_game_infos (
    id TEXT PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', ''),
    open_id TEXT NOT NULL UNIQUE,
    progress_level_id INTEGER NOT NULL DEFAULT 0,
    nick_name TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    resources JSONB NOT NULL DEFAULT '{}'::jsonb,
    goods JSONB NOT NULL DEFAULT '{}'::jsonb,
    claimed_level_chests INTEGER[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rank list query: progress_level_id > 0 AND nick_name <> '' ORDER BY progress_level_id DESC
CREATE INDEX IF NOT EXISTS idx_user_game_infos_rank
    ON user_game_infos (progress_level_id DESC)
    WHERE progress_level_id > 0 AND nick_name <> '';
