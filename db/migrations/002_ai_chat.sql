-- Chat com IA: conversas e mensagens (idempotente se rodar depois da API já ter criado via IF NOT EXISTS)
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
