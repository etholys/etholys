-- API key governance: scopes and expiration

ALTER TABLE api_client
  ADD COLUMN IF NOT EXISTS scopes TEXT NOT NULL DEFAULT 'ai:read,ai:write,usage:read';

ALTER TABLE api_client
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS api_client_expires_at_idx
  ON api_client (expires_at);
