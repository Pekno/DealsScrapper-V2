-- AlterTable
ALTER TABLE "public"."notifications" ADD COLUMN "dedupKey" TEXT;

-- CreateIndex
CREATE INDEX "notifications_userId_dedupKey_idx" ON "public"."notifications"("userId", "dedupKey");
