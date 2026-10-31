-- Additive storage metadata for private Supabase ownership documents.
ALTER TABLE "spaces"
  ADD COLUMN "ownership_document_path" VARCHAR(500),
  ADD COLUMN "ownership_document_name" VARCHAR(255),
  ADD COLUMN "ownership_document_size" INTEGER,
  ADD COLUMN "ownership_document_mime_type" VARCHAR(100);
