-- AlterTable
ALTER TABLE "spaces" ADD COLUMN     "listing_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
ADD COLUMN     "ownership_document_type" VARCHAR(100),
ADD COLUMN     "ownership_document_url" VARCHAR(500),
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMPTZ,
ADD COLUMN     "reviewed_by" VARCHAR(36),
ADD COLUMN     "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "spaces_listing_status_active_idx" ON "spaces"("listing_status", "active");

-- CreateIndex
CREATE INDEX "spaces_owner_id_listing_status_idx" ON "spaces"("owner_id", "listing_status");

-- AddForeignKey
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
