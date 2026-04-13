-- Schema Alignment Migration
-- Aligns database with current Prisma schema

-- =====================================================
-- 1. CREATE EXTENSION TABLES
-- =====================================================

-- ArticleDealabs extension table
CREATE TABLE IF NOT EXISTS "public"."article_dealabs" (
    "articleId" TEXT NOT NULL,
    "temperature" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "communityVerified" BOOLEAN NOT NULL DEFAULT false,
    "originalPrice" DOUBLE PRECISION,
    "discountPercentage" DOUBLE PRECISION,
    "merchant" TEXT,
    "freeShipping" BOOLEAN NOT NULL DEFAULT false,
    "isCoupon" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_dealabs_pkey" PRIMARY KEY ("articleId")
);

-- ArticleVinted extension table
CREATE TABLE IF NOT EXISTS "public"."article_vinted" (
    "articleId" TEXT NOT NULL,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "boosted" BOOLEAN NOT NULL DEFAULT false,
    "brand" TEXT,
    "size" TEXT,
    "color" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'Unknown',
    "sellerName" TEXT,
    "sellerRating" DOUBLE PRECISION,
    "buyerProtectionFee" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_vinted_pkey" PRIMARY KEY ("articleId")
);

-- ArticleLeBonCoin extension table
CREATE TABLE IF NOT EXISTS "public"."article_leboncoin" (
    "articleId" TEXT NOT NULL,
    "city" TEXT,
    "postcode" TEXT,
    "department" TEXT,
    "region" TEXT,
    "proSeller" BOOLEAN NOT NULL DEFAULT false,
    "sellerName" TEXT,
    "urgentFlag" BOOLEAN NOT NULL DEFAULT false,
    "topAnnonce" BOOLEAN NOT NULL DEFAULT false,
    "deliveryOptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shippingCost" DOUBLE PRECISION,
    "condition" TEXT,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_leboncoin_pkey" PRIMARY KEY ("articleId")
);

-- Create indexes for extension tables
CREATE INDEX IF NOT EXISTS "article_dealabs_temperature_idx" ON "public"."article_dealabs"("temperature");
CREATE INDEX IF NOT EXISTS "article_dealabs_expiresAt_idx" ON "public"."article_dealabs"("expiresAt");
CREATE INDEX IF NOT EXISTS "article_vinted_favoriteCount_idx" ON "public"."article_vinted"("favoriteCount");
CREATE INDEX IF NOT EXISTS "article_vinted_condition_idx" ON "public"."article_vinted"("condition");
CREATE INDEX IF NOT EXISTS "article_vinted_brand_idx" ON "public"."article_vinted"("brand");
CREATE INDEX IF NOT EXISTS "article_leboncoin_urgentFlag_idx" ON "public"."article_leboncoin"("urgentFlag");
CREATE INDEX IF NOT EXISTS "article_leboncoin_proSeller_idx" ON "public"."article_leboncoin"("proSeller");
CREATE INDEX IF NOT EXISTS "article_leboncoin_city_idx" ON "public"."article_leboncoin"("city");
CREATE INDEX IF NOT EXISTS "article_leboncoin_postcode_idx" ON "public"."article_leboncoin"("postcode");

-- =====================================================
-- 2. MIGRATE EXISTING DATA TO EXTENSION TABLES
-- =====================================================

-- Migrate dealabs articles to extension table
INSERT INTO "public"."article_dealabs" ("articleId", "temperature", "commentCount", "communityVerified", "originalPrice", "discountPercentage", "merchant", "freeShipping", "isCoupon", "expiresAt", "createdAt", "updatedAt")
SELECT
    "id",
    COALESCE("temperature", 0),
    COALESCE("commentCount", 0),
    COALESCE("communityVerified", false),
    "originalPrice",
    "discountPercentage",
    "merchant",
    COALESCE("freeShipping", false),
    COALESCE("isCoupon", false),
    "expiresAt",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "public"."articles"
WHERE "siteId" = 'dealabs'
ON CONFLICT ("articleId") DO NOTHING;

-- =====================================================
-- 3. FIX CATEGORIES TABLE COLUMN NAMES
-- =====================================================

-- Rename scrapeUrl to sourceUrl if scrapeUrl exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'scrapeUrl') THEN
        ALTER TABLE "public"."categories" RENAME COLUMN "scrapeUrl" TO "sourceUrl";
    END IF;
END $$;

-- Add parentId column if it doesn't exist
ALTER TABLE "public"."categories" ADD COLUMN IF NOT EXISTS "parentId" TEXT;

-- Migrate parentSlug to parentId (lookup by slug)
UPDATE "public"."categories" c
SET "parentId" = p."id"
FROM "public"."categories" p
WHERE c."parentSlug" = p."slug" AND c."parentId" IS NULL;

-- Add self-referencing foreign key for parentId
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'categories_parentId_fkey') THEN
        ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_parentId_fkey"
            FOREIGN KEY ("parentId") REFERENCES "public"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create index for parentId
CREATE INDEX IF NOT EXISTS "categories_parentId_idx" ON "public"."categories"("parentId");

-- Drop old parentSlug column (after migration)
ALTER TABLE "public"."categories" DROP COLUMN IF EXISTS "parentSlug";

-- Update unique constraint (drop old, create new)
DROP INDEX IF EXISTS "public"."categories_slug_key";
DROP INDEX IF EXISTS "public"."categories_siteId_sourceUrl_key";
CREATE UNIQUE INDEX IF NOT EXISTS "categories_siteId_sourceUrl_key" ON "public"."categories"("siteId", "sourceUrl");

-- =====================================================
-- 4. ADD MISSING COLUMNS TO ARTICLES
-- =====================================================

-- Add location column (for LeBonCoin)
ALTER TABLE "public"."articles" ADD COLUMN IF NOT EXISTS "location" TEXT;

-- Add updatedAt column
ALTER TABLE "public"."articles" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- =====================================================
-- 5. CLEANUP (Optional - Keep old columns for now for backward compatibility)
-- =====================================================
-- Note: Old columns (temperature, commentCount, etc.) are kept in articles table
-- They can be removed in a future migration after code is fully migrated to use extension tables

SELECT 'Schema alignment migration completed successfully' AS status;
