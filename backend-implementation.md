# Backend Implementation – BORO

## 1. Overview

Implemented the initial backend database infrastructure and service layer for BORO, a community space-sharing platform.

The implementation uses Node.js, Express, Prisma ORM, and PostgreSQL (Supabase).

## 2. Technology Stack

- **Runtime:** Node.js
- **Backend framework:** Express.js
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma 7.10.1
- **Database adapter:** `@prisma/adapter-pg`
- **Password hashing:** bcryptjs
- **Environment configuration:** dotenv
- **TypeScript execution:** tsx (for Prisma configuration and seeding)

## 3. Database Setup

- Configured a Supabase PostgreSQL database.
- Established and verified the database connection using the Supabase Session Pooler.
- Configured Prisma 7 with a separate Prisma configuration file (`prisma7.config.ts`).
- Defined the database models and relationships in `prisma/schema.prisma`.
- Generated the Prisma client.
- Created and applied database migrations.
- Added the weekly space-booking limit setting to the database schema.

## 4. Database Seeding

Implemented `prisma/seed.ts` to populate the database with initial demonstration data.

Seeded data includes:

- 9 users
- 10 spaces
- 11 bookings
- 1 waitlist entry
- 2 incidents
- 6 notifications

The database seed script executed successfully.

## 5. Prisma Client Setup

Created `lib/prisma.js` to initialize and export the Prisma client using the PostgreSQL adapter. This provides a shared database client for backend services.

## 6. Backend Service Layer

Implemented the following service modules under `services/`:

### 6.1 User Service – `userService.js`

- User authentication and creation.
- User retrieval and profile management.
- Payout method management.
- User listing and owner verification management.
- Owner approval and rejection.
- User suspension and unsuspension.
- Administrative dashboard counts.

### 6.2 Space Service – `spaceService.js`

- Retrieve spaces with filtering and pagination.
- Retrieve individual space details.
- Retrieve spaces belonging to an owner.
- Create and update spaces.
- Retrieve condition history.
- Add ratings and reviews.
- Record relevant administrative audit activity.

### 6.3 Booking Service – `bookingService.js`

- Booking creation and retrieval.
- User booking history.
- Booking cancellation and extension requests.
- Waitlist joining and leaving.
- Owner booking and calendar operations.
- Check-in, return, no-show, and payment-related operations.
- Owner earnings and booking history operations.

### 6.4 Incident Service – `incidentService.js`

- Create incidents from return-condition reports.
- Confirm incidents and apply deductions.
- Waive incidents.
- Update related booking and deposit information.
- Record audit activity.

### 6.5 Score Service – `scoreService.js`

- Retrieve user reliability scores and tiers.
- Retrieve score audit history.
- File disputes against score events.
- Resolve disputes and apply score adjustments.

### 6.6 Notification Service – `notificationService.js`

- Retrieve user notifications.
- Filter notifications by read status.
- Mark individual notifications as read.
- Mark all user notifications as read.

### 6.7 Audit Service – `auditService.js`

- Record audit events.
- Retrieve audit entries.
- Filter audit records using available criteria.
- Support administrative activity tracking.

### 6.8 Settings Service – `settingsService.js`

- Retrieve platform settings.
- Update configurable platform settings.
- Map application settings to database fields.

## 7. Configuration and Dependencies

- Updated `package.json` and `package-lock.json` with the required backend dependencies.
- Updated `.gitignore` to exclude files that should not be committed, including environment configuration.
- Kept database credentials in the local `.env` file rather than source code.

## 8. Verification Performed

The following checks were completed:

- Supabase database connection verified successfully.
- Prisma schema validation completed.
- Prisma client generation completed.
- Database migrations applied successfully.
- Database seeding completed successfully.
- Basic space retrieval tested successfully.
- User retrieval and administrative count operations tested successfully.

## 9. Current Status

The initial database infrastructure, Prisma setup, seed script, and backend service modules have been implemented.

**Pending work:**

- Align service methods with route-level contracts.
- Complete backend and frontend integration.
- Resolve runtime compatibility issues, if any.
- Perform end-to-end testing of the complete application.
- Implement image upload and storage for space photos, condition reports and incident evidence.

---

_This document records the backend implementation completed on the BORO project branch `feature/backend`._
