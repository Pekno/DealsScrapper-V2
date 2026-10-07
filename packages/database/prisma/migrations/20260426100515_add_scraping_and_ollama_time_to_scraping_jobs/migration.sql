/*
  Warnings:

  - You are about to drop the column `commentCount` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `communityVerified` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `discountAmount` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `discountPercentage` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `freeShipping` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `isCoupon` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `merchant` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `originalPrice` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `storeLocation` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `temperature` on the `articles` table. All the data in the column will be lost.
  - Made the column `updatedAt` on table `articles` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."articles_communityVerified_idx";

-- DropIndex
DROP INDEX "public"."articles_currentPrice_idx";

-- DropIndex
DROP INDEX "public"."articles_discountPercentage_idx";

-- DropIndex
DROP INDEX "public"."articles_expiresAt_idx";

-- DropIndex
DROP INDEX "public"."articles_merchant_idx";

-- DropIndex
DROP INDEX "public"."articles_publishedAt_idx";

-- DropIndex
DROP INDEX "public"."articles_temperature_idx";

-- DropIndex
DROP INDEX "public"."categories_slug_idx";

-- AlterTable
ALTER TABLE "public"."article_dealabs" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."article_leboncoin" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."article_vinted" ALTER COLUMN "condition" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."articles" DROP COLUMN "commentCount",
DROP COLUMN "communityVerified",
DROP COLUMN "discountAmount",
DROP COLUMN "discountPercentage",
DROP COLUMN "freeShipping",
DROP COLUMN "isCoupon",
DROP COLUMN "merchant",
DROP COLUMN "originalPrice",
DROP COLUMN "storeLocation",
DROP COLUMN "temperature",
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."scraping_jobs" ADD COLUMN     "ollamaExtractionTimeMs" INTEGER,
ADD COLUMN     "scrapingTimeMs" INTEGER;

-- AlterTable
ALTER TABLE "public"."sites" ALTER COLUMN "updatedAt" DROP DEFAULT;
