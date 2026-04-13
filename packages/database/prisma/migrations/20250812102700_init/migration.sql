-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "firstName" TEXT,
    "lastName" TEXT,
    "timezone" TEXT DEFAULT 'UTC',
    "locale" TEXT DEFAULT 'en',
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "marketingEmails" BOOLEAN NOT NULL DEFAULT false,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."filters" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "filterExpression" JSONB NOT NULL,
    "immediateNotifications" BOOLEAN NOT NULL DEFAULT true,
    "digestFrequency" TEXT NOT NULL DEFAULT 'daily',
    "maxNotificationsPerDay" INTEGER NOT NULL DEFAULT 50,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "matchesLast24h" INTEGER NOT NULL DEFAULT 0,
    "lastMatchAt" TIMESTAMP(3),

    CONSTRAINT "filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."articles" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "categoryPath" TEXT[],
    "currentPrice" DOUBLE PRECISION,
    "originalPrice" DOUBLE PRECISION,
    "discountPercentage" DOUBLE PRECISION,
    "discountAmount" DOUBLE PRECISION,
    "merchant" TEXT,
    "storeLocation" TEXT,
    "freeShipping" BOOLEAN NOT NULL DEFAULT false,
    "temperature" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "communityVerified" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "isCoupon" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'dealabs',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."matches" (
    "id" TEXT NOT NULL,
    "filterId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "content" JSONB NOT NULL,
    "metadata" JSONB,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "failed" BOOLEAN NOT NULL DEFAULT false,
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."scheduled_jobs" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "timeoutMs" INTEGER NOT NULL DEFAULT 300000,
    "totalExecutions" INTEGER NOT NULL DEFAULT 0,
    "successfulRuns" INTEGER NOT NULL DEFAULT 0,
    "lastExecutionAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "nextScheduledAt" TIMESTAMP(3),
    "avgExecutionTimeMs" INTEGER,
    "filterCount" INTEGER NOT NULL DEFAULT 0,
    "optimizedQuery" TEXT,
    "optimizationUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."scraping_jobs" (
    "id" TEXT NOT NULL,
    "scheduledJobId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttempt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "dealsFound" INTEGER,
    "dealsProcessed" INTEGER,
    "executionTimeMs" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scraping_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentSlug" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "scrapeUrl" TEXT NOT NULL,
    "description" TEXT,
    "dealCount" INTEGER NOT NULL DEFAULT 0,
    "avgTemperature" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "popularBrands" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."filter_categories" (
    "filterId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "filter_categories_pkey" PRIMARY KEY ("filterId","categoryId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_emailVerified_idx" ON "public"."users"("emailVerified");

-- CreateIndex
CREATE INDEX "users_lastLoginAt_idx" ON "public"."users"("lastLoginAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refreshToken_key" ON "public"."user_sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "public"."user_sessions"("userId");

-- CreateIndex
CREATE INDEX "user_sessions_refreshToken_idx" ON "public"."user_sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "user_sessions_expiresAt_idx" ON "public"."user_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "filters_userId_idx" ON "public"."filters"("userId");

-- CreateIndex
CREATE INDEX "filters_active_idx" ON "public"."filters"("active");

-- CreateIndex
CREATE INDEX "filters_lastMatchAt_idx" ON "public"."filters"("lastMatchAt");

-- CreateIndex
CREATE UNIQUE INDEX "articles_externalId_key" ON "public"."articles"("externalId");

-- CreateIndex
CREATE INDEX "articles_category_idx" ON "public"."articles"("category");

-- CreateIndex
CREATE INDEX "articles_merchant_idx" ON "public"."articles"("merchant");

-- CreateIndex
CREATE INDEX "articles_temperature_idx" ON "public"."articles"("temperature");

-- CreateIndex
CREATE INDEX "articles_currentPrice_idx" ON "public"."articles"("currentPrice");

-- CreateIndex
CREATE INDEX "articles_discountPercentage_idx" ON "public"."articles"("discountPercentage");

-- CreateIndex
CREATE INDEX "articles_scrapedAt_idx" ON "public"."articles"("scrapedAt");

-- CreateIndex
CREATE INDEX "articles_publishedAt_idx" ON "public"."articles"("publishedAt");

-- CreateIndex
CREATE INDEX "articles_expiresAt_idx" ON "public"."articles"("expiresAt");

-- CreateIndex
CREATE INDEX "articles_communityVerified_idx" ON "public"."articles"("communityVerified");

-- CreateIndex
CREATE INDEX "articles_isActive_isExpired_idx" ON "public"."articles"("isActive", "isExpired");

-- CreateIndex
CREATE INDEX "matches_notified_idx" ON "public"."matches"("notified");

-- CreateIndex
CREATE UNIQUE INDEX "matches_filterId_articleId_key" ON "public"."matches"("filterId", "articleId");

-- CreateIndex
CREATE INDEX "notifications_sent_idx" ON "public"."notifications"("sent");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "public"."notifications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_jobs_categoryId_key" ON "public"."scheduled_jobs"("categoryId");

-- CreateIndex
CREATE INDEX "scheduled_jobs_categoryId_idx" ON "public"."scheduled_jobs"("categoryId");

-- CreateIndex
CREATE INDEX "scheduled_jobs_isActive_idx" ON "public"."scheduled_jobs"("isActive");

-- CreateIndex
CREATE INDEX "scheduled_jobs_filterCount_idx" ON "public"."scheduled_jobs"("filterCount");

-- CreateIndex
CREATE INDEX "scraping_jobs_status_idx" ON "public"."scraping_jobs"("status");

-- CreateIndex
CREATE INDEX "scraping_jobs_scheduledJobId_idx" ON "public"."scraping_jobs"("scheduledJobId");

-- CreateIndex
CREATE INDEX "scraping_jobs_createdAt_idx" ON "public"."scraping_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "scraping_jobs_completedAt_idx" ON "public"."scraping_jobs"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "public"."categories"("slug");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "public"."categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parentSlug_idx" ON "public"."categories"("parentSlug");

-- CreateIndex
CREATE INDEX "categories_level_idx" ON "public"."categories"("level");

-- AddForeignKey
ALTER TABLE "public"."user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."filters" ADD CONSTRAINT "filters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."matches" ADD CONSTRAINT "matches_filterId_fkey" FOREIGN KEY ("filterId") REFERENCES "public"."filters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."matches" ADD CONSTRAINT "matches_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scraping_jobs" ADD CONSTRAINT "scraping_jobs_scheduledJobId_fkey" FOREIGN KEY ("scheduledJobId") REFERENCES "public"."scheduled_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."filter_categories" ADD CONSTRAINT "filter_categories_filterId_fkey" FOREIGN KEY ("filterId") REFERENCES "public"."filters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."filter_categories" ADD CONSTRAINT "filter_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
