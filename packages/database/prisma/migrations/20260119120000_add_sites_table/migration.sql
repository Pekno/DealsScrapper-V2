-- CreateTable
CREATE TABLE "public"."sites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "categoryDiscoveryUrl" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "iconUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- Insert default sites
INSERT INTO "public"."sites" ("id", "name", "baseUrl", "categoryDiscoveryUrl", "color", "isActive", "updatedAt")
VALUES
    ('dealabs', 'Dealabs', 'https://www.dealabs.com', 'https://www.dealabs.com/groupe/', '#FF6B00', true, CURRENT_TIMESTAMP),
    ('vinted', 'Vinted', 'https://www.vinted.fr', 'https://www.vinted.fr/catalog', '#09B1BA', true, CURRENT_TIMESTAMP),
    ('leboncoin', 'LeBonCoin', 'https://www.leboncoin.fr', 'https://www.leboncoin.fr', '#FF6E14', true, CURRENT_TIMESTAMP);

-- Add siteId column to articles (nullable first for migration)
ALTER TABLE "public"."articles" ADD COLUMN "siteId" TEXT;

-- Migrate existing data: convert source to siteId
UPDATE "public"."articles" SET "siteId" = "source" WHERE "source" IN ('dealabs', 'vinted', 'leboncoin');
UPDATE "public"."articles" SET "siteId" = 'dealabs' WHERE "siteId" IS NULL;

-- Make siteId NOT NULL after data migration
ALTER TABLE "public"."articles" ALTER COLUMN "siteId" SET NOT NULL;

-- Add siteId column to categories (nullable first)
ALTER TABLE "public"."categories" ADD COLUMN "siteId" TEXT;

-- Set default siteId for existing categories
UPDATE "public"."categories" SET "siteId" = 'dealabs' WHERE "siteId" IS NULL;

-- Make siteId NOT NULL
ALTER TABLE "public"."categories" ALTER COLUMN "siteId" SET NOT NULL;

-- Drop old source column from articles (we now use siteId)
ALTER TABLE "public"."articles" DROP COLUMN IF EXISTS "source";

-- Add foreign key constraints
ALTER TABLE "public"."articles" ADD CONSTRAINT "articles_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "public"."sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "public"."sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX "articles_siteId_idx" ON "public"."articles"("siteId");
CREATE INDEX "categories_siteId_idx" ON "public"."categories"("siteId");

-- Add unique constraint for siteId + externalId on articles
DROP INDEX IF EXISTS "public"."articles_externalId_key";
CREATE UNIQUE INDEX "articles_siteId_externalId_key" ON "public"."articles"("siteId", "externalId");

-- Add unique constraint for siteId + sourceUrl on categories
CREATE UNIQUE INDEX "categories_siteId_sourceUrl_key" ON "public"."categories"("siteId", "scrapeUrl");

-- Add matchId column to notifications (for DEAL_MATCH type notifications)
ALTER TABLE "public"."notifications" ADD COLUMN IF NOT EXISTS "matchId" TEXT;

-- Add foreign key for matchId
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "public"."matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create index for matchId
CREATE INDEX IF NOT EXISTS "notifications_matchId_idx" ON "public"."notifications"("matchId");
