-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "areaSqm" DOUBLE PRECISION,
ADD COLUMN     "propertyType" TEXT,
ADD COLUMN     "status" TEXT,
ADD COLUMN     "usage" TEXT;

-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "hasLand" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "landAreaSqm" DOUBLE PRECISION,
ADD COLUMN     "landCount" INTEGER,
ADD COLUMN     "propertyTypes" TEXT[],
ADD COLUMN     "usages" TEXT[];

-- CreateIndex
CREATE INDEX "Auction_hasLand_idx" ON "Auction"("hasLand");

