ALTER TABLE "Asset" ADD COLUMN "soldPrice" DECIMAL(16,2), ADD COLUMN "deedNumber" TEXT;
CREATE INDEX "Asset_deedNumber_idx" ON "Asset"("deedNumber");
