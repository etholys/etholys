ALTER TABLE api_usage_alert_event
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS api_usage_alert_event_retry_due_idx
  ON api_usage_alert_event (delivery_status, next_retry_at);
