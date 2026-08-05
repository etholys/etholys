-- Etholys Meet — transcrição ao vivo estruturada por participante.
-- Aplicar em produção e depois executar: npx prisma generate

CREATE TABLE IF NOT EXISTS "MeetTranscriptSegment" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "participantId" TEXT,
  "participantName" TEXT NOT NULL,
  "language" TEXT,
  "text" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetTranscriptSegment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MeetTranscriptSegment_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "MeetSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeetTranscriptSegment_sessionId_messageId_key"
  ON "MeetTranscriptSegment"("sessionId", "messageId");
CREATE INDEX IF NOT EXISTS "MeetTranscriptSegment_sessionId_startedAt_idx"
  ON "MeetTranscriptSegment"("sessionId", "startedAt");
CREATE INDEX IF NOT EXISTS "MeetTranscriptSegment_participantId_idx"
  ON "MeetTranscriptSegment"("participantId");
