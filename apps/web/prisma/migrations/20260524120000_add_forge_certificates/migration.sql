CREATE TABLE "ForgeCertificate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verifyCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ForgeCertificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ForgeCertificate_verifyCode_key" ON "ForgeCertificate"("verifyCode");
CREATE UNIQUE INDEX "ForgeCertificate_courseId_userId_key" ON "ForgeCertificate"("courseId", "userId");
CREATE INDEX "ForgeCertificate_companyId_idx" ON "ForgeCertificate"("companyId");
CREATE INDEX "ForgeCertificate_verifyCode_idx" ON "ForgeCertificate"("verifyCode");

ALTER TABLE "ForgeCertificate" ADD CONSTRAINT "ForgeCertificate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeCertificate" ADD CONSTRAINT "ForgeCertificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ForgeCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeCertificate" ADD CONSTRAINT "ForgeCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
