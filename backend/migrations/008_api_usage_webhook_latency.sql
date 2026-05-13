ALTER TABLE api_usage_alert_event
  ADD COLUMN IF NOT EXISTS delivery_duration_ms INTEGER CHECK (delivery_duration_ms >= 0);

CREATE INDEX IF NOT EXISTS api_usage_alert_event_sent_at_idx
  ON api_usage_alert_event (sent_at DESC);
