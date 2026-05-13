-- Etholys API core schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ai_conversation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversation (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_message_conversation_id_created_at_idx
  ON ai_message (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS ai_conversation_updated_at_idx
  ON ai_conversation (updated_at DESC);

CREATE TABLE IF NOT EXISTS api_client (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'starter',
  rpm_limit INTEGER NOT NULL DEFAULT 60 CHECK (rpm_limit > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_client_is_active_idx
  ON api_client (is_active);

CREATE TABLE IF NOT EXISTS api_usage_minute (
  client_id UUID NOT NULL REFERENCES api_client (id) ON DELETE CASCADE,
  bucket_minute TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (client_id, bucket_minute)
);

CREATE INDEX IF NOT EXISTS api_usage_minute_bucket_idx
  ON api_usage_minute (bucket_minute DESC);
