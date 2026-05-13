-- Monthly hard cap for API clients

ALTER TABLE api_client
  ADD COLUMN IF NOT EXISTS monthly_request_limit INTEGER CHECK (monthly_request_limit IS NULL OR monthly_request_limit > 0);
