# BORO Backend Integration

## Private ownership-document storage

Ownership documents are stored in the private Supabase Storage bucket
`ownership-documents`. Browser code never receives the service-role key. The
server uses `@supabase/supabase-js` with the service-role key, stores a
listing-scoped random storage path and file metadata in PostgreSQL, and never
stores or exposes a public URL.

Required server environment variables:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key must exist only in the server environment and must never
be committed or exposed to client-side code.

## Upload and retrieval

- `POST /owner/spaces`
- `POST /owner/spaces/:id`
- `GET /owner/spaces/:id/document`
- `GET /admin/listings/:id/document`

Owner upload and update routes require an authenticated owner session and
verify listing ownership in the service layer. Admin retrieval requires an
authenticated admin session. Document retrieval returns a signed URL valid for
five minutes. Public discovery and ordinary user responses do not include
storage paths.

New listings require an ownership document before submission. A rejected
listing requires a replacement document when resubmitted. Uploading a
replacement does not approve the listing. A new document is uploaded before
the database update; if the update fails, the existing document remains
untouched.

Accepted formats are PDF, JPEG, and PNG. The upload is limited to 10 MB,
checks the extension and declared MIME type, and verifies the file signature
for the supported formats. Storage uploads use unique non-overwriting paths
under the listing ID.

## Local setup and deployment

1. Add the required environment variables to the server environment without
   printing them or committing them.
2. Create a private Supabase Storage bucket named `ownership-documents` in the
   Supabase Dashboard.
3. Generate the Prisma client:

   ```text
   npx prisma generate --config prisma7.config.ts
   ```

4. Review the additive migration SQL in
   `prisma/migrations/20261031210000_add_private_ownership_document_metadata/migration.sql`.
5. Apply the migration only through an approved deployment process.

The migration has not been applied by this milestone, and no real bucket or
file was created or modified.

## Validation

The isolated ownership-document suite mocks Supabase Storage and Prisma:

```text
node scripts/testOwnershipDocuments.js
```

Existing route, authentication, booking, data, Prisma validation, syntax, and
diff checks should also be run before review.

## Remaining limitations

- The admin listing review UI is not implemented.
- CSRF protection remains the existing application placeholder; a real
  server-side CSRF mechanism is still required before production deployment.
- Existing legacy `ownership_document_url` data is preserved for migration
  compatibility but is not used for new uploads or returned by normalized
  listing responses.
- The new migration must be reviewed and applied before live uploads can work.
