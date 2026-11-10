-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastDurationMs" INTEGER,
    "lastItemCount" INTEGER,
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "itemsFound" INTEGER,
    "created" INTEGER,
    "updated" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "error" TEXT,

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "region" TEXT,
    "city" TEXT,
    "district" TEXT,
    "locationText" TEXT,
    "cities" TEXT[],
    "geoScope" TEXT NOT NULL,
    "hasRiyadhCity" BOOLEAN NOT NULL DEFAULT false,
    "hasRiyadhRegion" BOOLEAN NOT NULL DEFAULT false,
    "isMultiLocation" BOOLEAN NOT NULL DEFAULT false,
    "assetCount" INTEGER,
    "startPrice" DECIMAL(16,2),
    "currentPrice" DECIMAL(16,2),
    "deposit" DECIMAL(16,2),
    "images" TEXT[],
    "organizer" TEXT,
    "normalizedOrganizer" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "region" TEXT,
    "city" TEXT,
    "district" TEXT,
    "locationText" TEXT,
    "cities" TEXT[],
    "assetCount" INTEGER,
    "startPrice" DECIMAL(16,2),
    "currentPrice" DECIMAL(16,2),
    "deposit" DECIMAL(16,2),
    "images" TEXT[],
    "organizer" TEXT,
    "normalizedOrganizer" TEXT,
    "crossRefs" TEXT[],
    "raw" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSuccessAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "region" TEXT,
    "city" TEXT,
    "district" TEXT,
    "geoScope" TEXT NOT NULL DEFAULT 'unknown',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "startPrice" DECIMAL(16,2),
    "currentPrice" DECIMAL(16,2),
    "deposit" DECIMAL(16,2),
    "images" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionChange" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SavedAuction" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedAuction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "params" JSONB NOT NULL DEFAULT '{}',
    "channels" TEXT[] DEFAULT ARRAY['in_app']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "auctionId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "channels" TEXT[],
    "delivered" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrapeRun_sourceId_startedAt_idx" ON "ScrapeRun"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "Auction_status_endAt_idx" ON "Auction"("status", "endAt");

-- CreateIndex
CREATE INDEX "Auction_geoScope_idx" ON "Auction"("geoScope");

-- CreateIndex
CREATE INDEX "Auction_category_idx" ON "Auction"("category");

-- CreateIndex
CREATE INDEX "Auction_firstSeenAt_idx" ON "Auction"("firstSeenAt");

-- CreateIndex
CREATE INDEX "Auction_normalizedTitle_idx" ON "Auction"("normalizedTitle");

-- CreateIndex
CREATE INDEX "Listing_auctionId_idx" ON "Listing"("auctionId");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_sourceId_externalId_key" ON "Listing"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_listingId_externalId_key" ON "Asset"("listingId", "externalId");

-- CreateIndex
CREATE INDEX "AuctionChange_auctionId_at_idx" ON "AuctionChange"("auctionId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "SavedAuction_auctionId_key" ON "SavedAuction"("auctionId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "ScrapeRun" ADD CONSTRAINT "ScrapeRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionChange" ADD CONSTRAINT "AuctionChange_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedAuction" ADD CONSTRAINT "SavedAuction_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

