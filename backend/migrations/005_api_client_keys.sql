CREATE TABLE IF NOT EXISTS api_client_key (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES api_client (id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'default',
  api_key_hash TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_client_key_client_id_idx
  ON api_client_key (client_id);

CREATE INDEX IF NOT EXISTS api_client_key_client_active_idx
  ON api_client_key (client_id, is_active);

INSERT INTO api_client_key (client_id, name, api_key_hash, is_active, expires_at)
SELECT c.id, 'primary', c.api_key_hash, c.is_active, c.expires_at
FROM api_client c
WHERE c.api_key_hash IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM api_client_key k
    WHERE k.api_key_hash = c.api_key_hash
  );
