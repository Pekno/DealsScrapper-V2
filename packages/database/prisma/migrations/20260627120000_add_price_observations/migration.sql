-- CreateTable
CREATE TABLE "public"."price_observations" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_observations_articleId_observedAt_idx" ON "public"."price_observations"("articleId", "observedAt");
