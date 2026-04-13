/*
  Warnings:

  - You are about to drop the column `category` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `channel` on the `notifications` table. All the data in the column will be lost.
  - Added the required column `categoryId` to the `articles` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."articles_category_idx";

-- AlterTable
ALTER TABLE "public"."articles" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."notifications" DROP COLUMN "channel",
ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "articles_categoryId_idx" ON "public"."articles"("categoryId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "public"."notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "public"."notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "public"."notifications"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."articles" ADD CONSTRAINT "articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
