ALTER TABLE "ForgeCourse" ADD COLUMN IF NOT EXISTS "presentationPdfPath" TEXT;
ALTER TABLE "ForgeCourse" ADD COLUMN IF NOT EXISTS "presentationPdfName" TEXT;
ALTER TABLE "ForgeCourse" ADD COLUMN IF NOT EXISTS "presentationEmbedUrl" TEXT;
ALTER TABLE "ForgeCourse" ADD COLUMN IF NOT EXISTS "presentationSlides" JSONB;
