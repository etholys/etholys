ALTER TABLE api_client
  ADD COLUMN IF NOT EXISTS usage_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS usage_webhook_secret TEXT;

CREATE TABLE IF NOT EXISTS api_usage_alert_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES api_client (id) ON DELETE CASCADE,
  month_start DATE NOT NULL,
  threshold_percent INTEGER NOT NULL CHECK (threshold_percent > 0 AND threshold_percent <= 100),
  triggered_usage INTEGER NOT NULL CHECK (triggered_usage >= 0),
  monthly_limit INTEGER NOT NULL CHECK (monthly_limit > 0),
  webhook_url TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  http_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS api_usage_alert_event_unique_threshold_idx
  ON api_usage_alert_event (client_id, month_start, threshold_percent);

CREATE INDEX IF NOT EXISTS api_usage_alert_event_client_created_idx
  ON api_usage_alert_event (client_id, created_at DESC);
