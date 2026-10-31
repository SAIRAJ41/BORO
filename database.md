# BORO — Database & Backend Architecture Reference

This document provides full technical specifications for backend and database teammates implementing production persistence for the BORO community space sharing platform.
*NOTE: This specification reflects the actual production front-end codebase (`routes/`, `services/`, `middleware/`, `views/`, and `data/mock.js`). Where the code differs from `plan.md`, it is explicitly marked with `NOTE: differs from plan.md`.*

---

## 1. Front-End Wiring & Request Flow

```
[Browser / Client]
       │
       ▼  HTTP Request (Forms, Query Params, JSON)
[Express App (app.js)]
       │
       ▼  attachUser -> Session Hydration -> isAuthenticated -> requireRole()
[Route Handlers (routes/*.js)]
       │
       ├─► (Current Demo State): Reads / Writes directly to data/mock.js
       │
       └─► (Target Production State): Calls Service Layer (services/*.js)
              │
              ▼
       [Database / Persistence Engine (PostgreSQL / Redis)]
```

- **USE_MOCK Setting**: Located in `data/mock.js` (`const USE_MOCK = true;`). When set to `false`, mock fallbacks in `services/userService.js` are disabled, and the "Try a demo account" panel on `/login` is automatically hidden.
- **Teammate Swap Points**: In every route handler, swap points are flagged with:
  `// BACKEND: replace mockData... with service...`
  Views never read databases directly; all variables are passed explicitly via route `res.render(...)` calls.

---

## 2. Database Schema & Entity Specifications

### Table: `users`
*Core account table for community members, space owners, and system administrators.*
- `id` (VARCHAR(36) PRIMARY KEY): e.g. `USR-001`.
- `name` (VARCHAR(120) NOT NULL): Full legal or display name.
- `email` (VARCHAR(255) UNIQUE NOT NULL): Lowercase normalized email.
- `password_hash` (VARCHAR(255) NOT NULL): Bcrypt or Argon2id hashed password.
- `phone` (VARCHAR(32) NOT NULL): e.g. `+91 98201 11223`.
- `role` (VARCHAR(16) NOT NULL): ENUM (`user`, `owner`, `admin`).
- `score` (INT NOT NULL DEFAULT 100): Reliability score clamped between 0 and 120 (multiples of 5).
- `tier` (INT GENERATED / COMPUTED): 1 (>=80), 2 (50-79), 3 (<50).
- `initials` (VARCHAR(4) NOT NULL): 2 uppercase letters computed from name.
- `status` (VARCHAR(20) NOT NULL DEFAULT 'active'): ENUM (`active`, `pending`, `suspended`).
- `active_bookings` (INT NOT NULL DEFAULT 0): Dynamic count of concurrent active bookings.
- `joined_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW()).
- `created_at` / `updated_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW()).

### Table: `owner_verifications`
*Documentation records for space owner verification.*
- `id` (VARCHAR(36) PRIMARY KEY).
- `user_id` (VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE).
- `organisation` (VARCHAR(200) NULL): Society, Trust, or School name.
- `document_type` (VARCHAR(100) NOT NULL): e.g. 'Aadhaar Demo ID', 'Property Deed'.
- `document_url` (VARCHAR(500) NULL): S3/GCS uploaded document URL.
- `is_verified` (BOOLEAN NOT NULL DEFAULT FALSE).
- `applied_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW()).
- `verified_at` (TIMESTAMPTZ NULL).
- `verified_by` (VARCHAR(36) NULL REFERENCES users(id)).

### Table: `payout_methods`
*Owner disbursement settlement accounts (masked in UI).*
- `id` (VARCHAR(36) PRIMARY KEY).
- `owner_id` (VARCHAR(36) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE).
- `type` (VARCHAR(20) NOT NULL): ENUM (`upi`, `bank_transfer`).
- `masked_details` (VARCHAR(100) NOT NULL): e.g. `Demo Bank •••• 4092` or `rajesh@demo`.
- `account_number_enc` (TEXT NULL): Encrypted bank account number.
- `ifsc_code` (VARCHAR(20) NULL): Bank IFSC code.
- `upi_id` (VARCHAR(100) NULL): UPI VPA.
- `created_at` / `updated_at` (TIMESTAMPTZ DEFAULT NOW()).

### Table: `spaces`
*Community facilities listed for public access.*
- `id` (VARCHAR(36) PRIMARY KEY): e.g. `SP-001`.
- `owner_id` (VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT).
- `name` (VARCHAR(150) NOT NULL): Facility display title.
- `description` (TEXT NOT NULL).
- `space_type` (VARCHAR(50) NOT NULL): ENUM (`community_hall`, `community_ground`, `school_playground`, `small_room`, `storeroom`).
- `indoor_outdoor` (VARCHAR(20) NOT NULL): ENUM (`indoor`, `outdoor`).
- `capacity` (INT NOT NULL): Maximum occupant count.
- `sqft` (INT NOT NULL): Area in square feet.
- `price_per_hour` (NUMERIC(10,2) NOT NULL): Base hourly tariff in INR.
- `deposit_amount` (NUMERIC(10,2) NOT NULL): Refundable security deposit in INR (*NOTE: differs from plan.md which referred to escrow*).
- `locality` (VARCHAR(100) NOT NULL): Neighborhood or sector.
- `city` (VARCHAR(100) NOT NULL): e.g. 'Navi Mumbai', 'Mumbai'.
- `address` (TEXT NOT NULL): Full street address.
- `amenities` (JSONB NOT NULL DEFAULT '[]'): Array of strings (e.g. `["AC", "Audio System", "Stage"]`).
- `allowed_purposes` (JSONB NOT NULL DEFAULT '[]'): e.g. `["workshops", "meetings", "cultural", "social", "sports", "storage"]`.
- `rules` (TEXT NULL): Custodial guidelines.
- `photos` (JSONB NOT NULL DEFAULT '[]'): Array of image URLs.
- `active` (BOOLEAN NOT NULL DEFAULT TRUE).
- `verified` (BOOLEAN NOT NULL DEFAULT TRUE): Set to false for newly registered pending owners.
- `weather_dependent` (BOOLEAN NOT NULL DEFAULT FALSE): Free weather reschedule label for outdoor grounds.
- `created_at` / `updated_at` (TIMESTAMPTZ DEFAULT NOW()).

### Table: `availability_slots`
*Operational time windows for community spaces.*
- `id` (VARCHAR(36) PRIMARY KEY): e.g. `SLOT-101`.
- `space_id` (VARCHAR(36) NOT NULL REFERENCES spaces(id) ON DELETE CASCADE).
- `slot_date` (DATE NOT NULL).
- `start_time` (TIME NOT NULL).
- `end_time` (TIME NOT NULL).
- `is_booked` (BOOLEAN NOT NULL DEFAULT FALSE).
- `status` (VARCHAR(20) NOT NULL DEFAULT 'available'): ENUM (`available`, `reserved`, `blocked`, `maintenance`).

### Table: `bookings`
*Core reservation and custody lifecycle records.*
- `id` (VARCHAR(36) PRIMARY KEY): e.g. `BK-1001`.
- `ref` (VARCHAR(20) UNIQUE NOT NULL): Human-readable code e.g. `#BK-1001`.
- `user_id` (VARCHAR(36) NOT NULL REFERENCES users(id)).
- `space_id` (VARCHAR(36) NOT NULL REFERENCES spaces(id)).
- `slot_date` (DATE NOT NULL).
- `start_time` (VARCHAR(30) NOT NULL): e.g. '09:00' or ISO timestamp.
- `end_time` (VARCHAR(30) NOT NULL): e.g. '13:00' or ISO timestamp.
- `duration_hours` (INT NOT NULL): Number of hours booked.
- `status` (VARCHAR(25) NOT NULL): ENUM (`requested`, `approved`, `rejected`, `waitlisted`, `checked_in`, `returned`, `overdue`, `damaged`, `cancelled`, `closed`).
- `purpose` (VARCHAR(100) NOT NULL): Declared usage purpose.
- `group_size` (INT NOT NULL).
- `hourly_rate` (NUMERIC(10,2) NOT NULL): Rate locked at reservation time.
- `hourly_fee` (NUMERIC(10,2) NOT NULL): `hourly_rate * duration_hours`.
- `deposit_amount` (NUMERIC(10,2) NOT NULL): Security deposit locked at booking time.
- `deposit_status` (VARCHAR(25) NOT NULL DEFAULT 'held'): ENUM (`held`, `partially_deducted`, `deducted`, `refunded`).
- `total_amount` (NUMERIC(10,2) NOT NULL): `hourly_fee + deposit_amount`.
- `total_paid` (NUMERIC(10,2) NOT NULL): Total INR collected.
- `platform_fee` (NUMERIC(10,2) NOT NULL): 8% platform charge on hourly fee.
- `net_payout` (NUMERIC(10,2) NOT NULL): `hourly_fee - platform_fee`.
- `payment_method` (VARCHAR(25) NOT NULL): ENUM (`upi`, `card`, `net_banking`, `pay_at_venue`).
- `payment_status` (VARCHAR(25) NOT NULL): ENUM (`pending`, `paid`, `refunded`, `partially_deducted`).
- `paid_at` (TIMESTAMPTZ NULL).
- `decision_reason` (TEXT NULL): Mandatory reason logged on approve, reject, or waitlist.
- `pin_code` (VARCHAR(10) NULL): 4-digit access code (visible ONLY when approved/checked_in).
- `notes` (TEXT NULL): Special equipment or setup notes.
- `extension_hours` (INT NULL): Overtime extension hours requested.
- `extension_status` (VARCHAR(20) NULL): ENUM (`none`, `requested`, `approved`, `rejected`).
- `cancellation_deadline` (TIMESTAMPTZ NULL): 2 hours prior to start_time.
- `can_cancel` (BOOLEAN NOT NULL DEFAULT TRUE).
- `cancel_warning` (TEXT NULL).
- `cancelled_at` (TIMESTAMPTZ NULL).
- `cancel_reason` (TEXT NULL).
- `created_at` / `updated_at` (TIMESTAMPTZ DEFAULT NOW()).

### Table: `waitlist`
*FIFO priority waitlist queue for occupied slots.*
- `id` (VARCHAR(36) PRIMARY KEY): e.g. `WL-201`.
- `space_id` (VARCHAR(36) NOT NULL REFERENCES spaces(id) ON DELETE CASCADE).
- `slot_id` (VARCHAR(50) NOT NULL).
- `slot_date` (DATE NOT NULL).
- `user_id` (VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE).
- `position` (INT NOT NULL DEFAULT 1): Strict FIFO ordering index.
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW()).

### Table: `condition_reports`
*Pre-ingress and post-egress physical facility inspection records.*
- `id` (VARCHAR(36) PRIMARY KEY): e.g. `CR-001`.
- `booking_id` (VARCHAR(36) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE).
- `space_id` (VARCHAR(36) NOT NULL REFERENCES spaces(id)).
- `type` (VARCHAR(20) NOT NULL): ENUM (`checkin`, `checkout`).
- `reported_by` (VARCHAR(36) NOT NULL REFERENCES users(id)).
- `checklist` (JSONB NOT NULL): e.g. `{"cleanliness": true, "lights_fans": true, "furniture": true, "waste_cleared": true}`.
- `condition_notes` (TEXT NULL).
- `photos` (JSONB NOT NULL DEFAULT '[]'): Array of photo URLs.
- `verified_by_owner` (BOOLEAN NOT NULL DEFAULT TRUE).
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW()).

### Table: `incidents`
*Facility damage, excessive overrun, or rule violation settlements.*
- `id` (VARCHAR(36) PRIMARY KEY): e.g. `INC-001`.
- `booking_id` (VARCHAR(36) NOT NULL REFERENCES bookings(id)).
- `space_id` (VARCHAR(36) NOT NULL REFERENCES spaces(id)).
- `user_id` (VARCHAR(36) NOT NULL REFERENCES users(id)).
- `owner_id` (VARCHAR(36) NOT NULL REFERENCES users(id)).
- `reason` (TEXT NOT NULL): Detailed incident explanation.
- `severity` (VARCHAR(20) NOT NULL DEFAULT 'medium'): ENUM (`low`, `medium`, `high`, `critical`).
- `status` (VARCHAR(20) NOT NULL DEFAULT 'open'): ENUM (`open`, `settled`, `waived`, `disputed`).
- `deposit_held` (NUMERIC(10,2) NOT NULL): Security deposit locked for this booking.
- `deduction_total` (NUMERIC(10,2) NOT NULL DEFAULT 0.00).
- `refund_amount` (NUMERIC(10,2) NOT NULL): `deposit_held - deduction_total`.
- `deductions` (JSONB NOT NULL DEFAULT '[]'): Array of `{ item: string, amount: number }`.
- `photos` (JSONB NOT NULL DEFAULT '[]').
- `notes` (TEXT NULL).
- `created_at` / `updated_at` (TIMESTAMPTZ DEFAULT NOW()).

### Table: `score_events`
*Deterministic ledger of points awarded or deducted from reliability scores.*
- `id` (VARCHAR(36) PRIMARY KEY): e.g. `SE-101`.
- `user_id` (VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE).
- `booking_id` (VARCHAR(36) NULL REFERENCES bookings(id)).
- `delta` (INT NOT NULL): Multiple of 5 (e.g. `+5`, `-10`, `-15`, `-30`).
- `action` (VARCHAR(50) NOT NULL): e.g. 'clean_return', 'late_return', 'no_show', 'damage', 'dispute_resolution'.
- `reason` (TEXT NOT NULL): Explanation displayed on audit trail.
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW()).

### Table: `disputes`
*Arbitration cases filed by users contesting score penalties or incident deductions.*
- `id` (VARCHAR(36) PRIMARY KEY): e.g. `DISP-101`.
- `user_id` (VARCHAR(36) NOT NULL REFERENCES users(id)).
- `score_event_id` (VARCHAR(36) NULL REFERENCES score_events(id)).
- `booking_id` (VARCHAR(36) NULL REFERENCES bookings(id)).
- `reason` (TEXT NOT NULL): Applicant's written dispute justification.
- `status` (VARCHAR(20) NOT NULL DEFAULT 'open'): ENUM (`open`, `under_review`, `resolved`, `rejected`).
- `resolution_notes` (TEXT NULL).
- `resolved_by` (VARCHAR(36) NULL REFERENCES users(id)).
- `resolved_at` (TIMESTAMPTZ NULL).
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW()).

### Table: `ratings`
*Post-session community feedback and reviews.*
- `id` (VARCHAR(36) PRIMARY KEY).
- `space_id` (VARCHAR(36) NOT NULL REFERENCES spaces(id)).
- `booking_id` (VARCHAR(36) NOT NULL UNIQUE REFERENCES bookings(id)).
- `user_id` (VARCHAR(36) NOT NULL REFERENCES users(id)).
- `rating` (INT NOT NULL CHECK (rating >= 1 AND rating <= 5)).
- `review` (TEXT NULL).
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW()).

### Table: `notifications`
*Actionable alerts and reminders dispatched to participants.*
- `id` (VARCHAR(36) PRIMARY KEY): e.g. `NOTIF-001`.
- `user_id` (VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE).
- `type` (VARCHAR(40) NOT NULL): ENUM (`booking_approved`, `booking_rejected`, `reminder`, `score_credit`, `score_penalty`, `new_request`, `overdue`, `incident`, `waitlist_promoted`).
- `title` (VARCHAR(150) NOT NULL).
- `message` (TEXT NOT NULL).
- `read` (BOOLEAN NOT NULL DEFAULT FALSE).
- `action_url` (VARCHAR(255) NULL).
- `actions` (JSONB NOT NULL DEFAULT '[]').
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW()).

### Table: `audit_log`
*System-wide tamper-evident ledger for administrative and custodial governance.*
- `id` (VARCHAR(36) PRIMARY KEY): e.g. `AUD-001`.
- `actor` (VARCHAR(100) NOT NULL): e.g. `Rajesh Kumar (Owner)`, `Amit Verma (Admin)`, `SYSTEM`.
- `action` (VARCHAR(50) NOT NULL): e.g. `BOOKING_APPROVE`, `BOOKING_REJECT`, `DISPUTE_RESOLVE`, `OWNER_VERIFY`, `USER_SUSPEND`.
- `target` (VARCHAR(100) NOT NULL): Identifier code e.g. `#BK-1001`, `USR-006`.
- `reason` (TEXT NOT NULL): Mandatory operator justification.
- `details` (TEXT NULL): Contextual data.
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW()).

### Table: `settings`
*System thresholds and operational governance configuration.*
- `id` (INT PRIMARY KEY DEFAULT 1).
- `max_active_bookings_per_user` (INT NOT NULL DEFAULT 2).
- `grace_period_mins` (INT NOT NULL DEFAULT 15).
- `no_show_window_hours` (INT NOT NULL DEFAULT 2).
- `platform_fee_percent` (NUMERIC(5,2) NOT NULL DEFAULT 8.00).
- `points_clean_return` (INT NOT NULL DEFAULT 5).
- `points_late_return` (INT NOT NULL DEFAULT -10).
- `points_no_show` (INT NOT NULL DEFAULT -10).
- `points_damage` (INT NOT NULL DEFAULT -30).
- `points_min` (INT NOT NULL DEFAULT 0).
- `points_max` (INT NOT NULL DEFAULT 120).
- `updated_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW()).

---

## 3. Service Layer Contracts (`services/*.js`)

| Service File | Function Name & Arguments | Expected Return Shape | Routes / Views Calling It | Touched Tables | Status |
|---|---|---|---|---|---|
| `userService.js` | `authenticate(email, password)` | `{ id, name, email, role, initials, status } \| null` | `POST /login` | `users` | **WORKING_ON_MOCK** |
| `userService.js` | `create({ name, email, phone, password, role, organisation })` | `{ id: string }` | `POST /signup` | `users`, `owner_verifications` | **WORKING_ON_MOCK** |
| `userService.js` | `getDemoUser(role)` | `{ id, name, email, role, initials, status }` | `GET /demo/:role` | `users` | **WORKING_ON_MOCK** |
| `userService.js` | `getById(userId)` | `{ id, name, email, role, score, tier, status, initials, joined_at }` | `GET /profile`, `routes/user.js` | `users` | **STUB** |
| `userService.js` | `getProfile(userId)` | `{ user, verificationStatus, payoutMethod }` | `GET /profile` | `users`, `owner_verifications`, `payout_methods` | **STUB** |
| `userService.js` | `updatePayoutMethod(ownerId, data)` | `void` | `POST /owner/payout-method` | `payout_methods` | **STUB** |
| `userService.js` | `getAllUsers(query, page, limit)` | `{ users: [...], total, totalPages }` | `GET /admin/users` | `users` | **STUB** |
| `userService.js` | `getPendingOwners()` | `[{ id, name, email, phone, spaces_proposed, applied_at, documents }]` | `GET /admin/verify-owners` | `users`, `owner_verifications` | **STUB** |
| `userService.js` | `approveOwner(ownerId, reason)` | `void` | `POST /admin/owners/:id/verify` | `users`, `owner_verifications`, `audit_log` | **STUB** |
| `userService.js` | `rejectOwner(ownerId, reason)` | `void` | `POST /admin/owners/:id/reject` | `users`, `owner_verifications`, `audit_log` | **STUB** |
| `userService.js` | `suspend(userId, reason)` | `void` | `POST /admin/users/:id/suspend` | `users`, `audit_log` | **STUB** |
| `userService.js` | `unsuspend(userId, reason)` | `void` | `POST /admin/users/:id/suspend` | `users`, `audit_log` | **STUB** |
| `userService.js` | `getAdminCounts()` | `{ total_users, total_owners, pending_owners, total_spaces, active_bookings, completed_bookings, open_disputes, active_incidents }` | `GET /admin/overview` | All entities | **STUB** |
| `spaceService.js` | `getSpaces(filters, page, limit)` | `[{ id, name, space_type, indoor_outdoor, capacity, price_per_hour, locality, photos }]` | `GET /search`, `GET /` | `spaces` | **STUB** |
| `spaceService.js` | `getSpaceById(id)` | `{ space, owner, conditionReports, eligibility }` | `GET /spaces/:id` | `spaces`, `users`, `condition_reports` | **STUB** |
| `spaceService.js` | `getOwnerSpaces(ownerId)` | `[{ id, name, space_type, capacity, price_per_hour, active }]` | `GET /owner/my-spaces` | `spaces` | **STUB** |
| `spaceService.js` | `create(ownerId, data)` | `{ id: string }` | `POST /owner/spaces` | `spaces`, `audit_log` | **STUB** |
| `spaceService.js` | `update(spaceId, ownerId, data)` | `void` | `POST /owner/spaces/:id` | `spaces`, `audit_log` | **STUB** |
| `spaceService.js` | `addRating(spaceId, bookingId, userId, rating, review)` | `void` | `POST /bookings/:id/rate` | `ratings` | **STUB** |
| `bookingService.js` | `create(userId, spaceId, slotId, purpose, groupSize, paymentMethod)` | `{ id: string, ref: string, status: 'requested' }` | `POST /bookings` | `bookings`, `availability_slots`, `notifications` | **STUB** |
| `bookingService.js` | `getBookingById(id)` | `{ booking, space, user, payments }` | `GET /bookings/:id/receipt` | `bookings`, `spaces`, `users` | **STUB** |
| `bookingService.js` | `getUserBookings(userId, tab, page, limit)` | `[{ id, ref, space, slot_date, start_time, end_time, status, total_amount, pin_code }]` | `GET /my-bookings` | `bookings`, `spaces` | **STUB** |
| `bookingService.js` | `getUserHistory(userId, page, limit)` | `[{ id, ref, space, slot_date, status, total_paid, deposit_status }]` | `GET /history` | `bookings`, `spaces` | **STUB** |
| `bookingService.js` | `cancel(bookingId, userId, reason)` | `void` | `POST /bookings/:id/cancel` | `bookings`, `audit_log`, `notifications` | **STUB** |
| `bookingService.js` | `requestExtension(bookingId, userId, additionalHours)` | `void` | `POST /bookings/:id/extend` | `bookings`, `notifications` | **STUB** |
| `bookingService.js` | `approve(bookingId, ownerId, reason)` | `void` | `POST /owner/requests/:id/approve` | `bookings`, `audit_log`, `notifications` | **STUB** |
| `bookingService.js` | `reject(bookingId, ownerId, reason)` | `void` | `POST /owner/requests/:id/reject` | `bookings`, `audit_log`, `notifications` | **STUB** |
| `bookingService.js` | `waitlist(bookingId, ownerId, reason)` | `void` | `POST /owner/requests/:id/waitlist` | `bookings`, `waitlist`, `audit_log` | **STUB** |
| `bookingService.js` | `joinWaitlist(userId, spaceId, slotId)` | `{ id: string, position: number }` | `POST /waitlist/:spaceId/:slotId` | `waitlist` | **STUB** |
| `bookingService.js` | `leaveWaitlist(waitlistId, userId)` | `void` | `POST /waitlist/:id/leave` | `waitlist` | **STUB** |
| `bookingService.js` | `checkin(bookingId, conditionData, conditionNotes)` | `void` | `POST /owner/checkin/:id` | `bookings`, `condition_reports` | **STUB** |
| `bookingService.js` | `return(bookingId, conditionData, conditionNotes)` | `void` | `POST /owner/return/:id` | `bookings`, `condition_reports`, `score_events` | **STUB** |
| `bookingService.js` | `markNoShow(bookingId, reason)` | `void` | `POST /owner/today/:id/no-show` | `bookings`, `score_events`, `audit_log` | **STUB** |
| `bookingService.js` | `markPaymentReceived(bookingId, ownerId)` | `void` | `POST /owner/bookings/:id/mark-paid` | `bookings`, `audit_log` | **STUB** |
| `bookingService.js` | `getOwnerRequests(ownerId)` | `[{ id, user, space, total_amount, payment_status, payment_method }]` | `GET /owner/requests` | `bookings`, `users`, `spaces` | **STUB** |
| `bookingService.js` | `getOwnerCalendar(ownerId, week)` | `{ days: [...], bookingsByDay: {...} }` | `GET /owner/calendar` | `bookings`, `spaces` | **STUB** |
| `bookingService.js` | `getOwnerToday(ownerId)` | `{ checkins: [...], returns: [...], activeSessions: [...] }` | `GET /owner/today` | `bookings`, `spaces`, `users` | **STUB** |
| `bookingService.js` | `getOwnerHistory(ownerId, page, limit)` | `[{ id, ref, space, user, slot_date, duration_hours, net_payout }]` | `GET /owner/history` | `bookings`, `spaces`, `users` | **STUB** |
| `bookingService.js` | `getOwnerEarnings(ownerId)` | `{ totalEarnings, pendingPayouts, payoutHistory, ledger }` | `GET /owner/earnings` | `bookings`, `spaces`, `payout_methods` | **STUB** |
| `incidentService.js` | `createFromReturn(bookingId, data)` | `{ id: string }` | `POST /owner/today/:id/flag` | `incidents`, `bookings`, `audit_log` | **STUB** |
| `incidentService.js` | `confirm(incidentId, deductions, reason)` | `void` | `POST /owner/incidents/:id/confirm` | `incidents`, `bookings`, `score_events`, `audit_log` | **STUB** |
| `incidentService.js` | `waive(incidentId, reason)` | `void` | `POST /owner/incidents/:id/waive` | `incidents`, `bookings`, `audit_log` | **STUB** |
| `scoreService.js` | `getUserScore(userId)` | `{ score: number, tier: number }` | `GET /my-score`, sidebar | `users`, `score_events` | **STUB** |
| `scoreService.js` | `getScoreAuditTrail(userId)` | `[{ id, delta, reason, created_at }]` | `GET /my-score`, `GET /profile` | `score_events` | **STUB** |
| `scoreService.js` | `fileDispute(userId, auditEntryId, reason)` | `{ id: string }` | `POST /disputes` | `disputes`, `audit_log` | **STUB** |
| `scoreService.js` | `getDisputes()` | `[{ id, user, reason, status, created_at }]` | `GET /admin/disputes` | `disputes`, `users` | **STUB** |
| `scoreService.js` | `resolveDispute(disputeId, decision, reason)` | `void` | `POST /admin/disputes/:id/resolve` | `disputes`, `score_events`, `users`, `audit_log` | **STUB** |
| `notificationService.js` | `getUserNotifications(userId, filter)` | `[{ id, type, title, message, read, created_at }]` | `GET /notifications` | `notifications` | **STUB** |
| `notificationService.js` | `markRead(notifId)` | `void` | `POST /notifications/:id/read` | `notifications` | **STUB** |
| `notificationService.js` | `markAllRead(userId)` | `void` | `POST /notifications/read-all` | `notifications` | **STUB** |
| `auditService.js` | `log(actor, action, target, reason, details)` | `void` | All custodial state changes | `audit_log` | **STUB** |
| `auditService.js` | `getEntries(filters, page, limit)` | `[{ id, actor, action, target, reason, created_at }]` | `GET /admin/audit-log` | `audit_log` | **STUB** |
| `settingsService.js` | `getAll()` | `{ max_active_bookings_per_user, grace_period_mins, ... }` | `GET /admin/settings` | `settings` | **STUB** |
| `settingsService.js` | `update(data)` | `void` | `POST /admin/settings` | `settings`, `audit_log` | **STUB** |

---

## 4. Route Specifications & Access Control

| HTTP Method & Route | Allowed Role | Service Function Called | Connected Action & Mandatory Reason Requirement |
|---|---|---|---|
| `GET /login` | Public | None (checks `USE_MOCK`) | Renders login page with auth layout. |
| `POST /login` | Public | `userService.authenticate` | Validates credentials; rate limit; issues session. |
| `POST /logout` | Authenticated | None | Destroys session store record; clears `boro.sid`. |
| `GET /signup` | Public | None | Registration form with owner conditional fields. |
| `POST /signup` | Public | `userService.create` | Validates input; hashes password; creates user. |
| `GET /demo/:role` | Public (Mock) | `userService.getDemoUser` | Demo convenience switcher. Guarded by `USE_MOCK`. |
| `GET /profile` | `user`, `owner`, `admin` | `userService.getProfile` | Displays profile, tier status, and score events. |
| `POST /profile/verify` | Authenticated | `owner_verifications` insert | Submits identity documents for admin verification. |
| `GET /` & `GET /search` | Public | `spaceService.getSpaces` | Public search and filtering by capacity, price, and type. |
| `GET /spaces/:id` | Public | `spaceService.getSpaceById` | Space detail page, condition photos, eligibility card. |
| `POST /bookings` | `user` | `bookingService.create` | Validates active limit <= 2, purpose, locks deposit + fee. |
| `POST /waitlist/:spaceId/:slotId`| `user` | `bookingService.joinWaitlist` | Enqueues user in FIFO waitlist queue. |
| `POST /waitlist/:id/leave` | `user` | `bookingService.leaveWaitlist` | Removes user from slot waitlist. |
| `GET /bookings/:id/receipt` | Requester/Owner/Admin | `bookingService.getBookingById` | Tax and custodial breakdown receipt. |
| `GET /my-bookings` | `user` | `bookingService.getUserBookings` | Active, waitlisted, and past bookings tab view. |
| `POST /bookings/:id/cancel` | `user` | `bookingService.cancel` | Cancels reservation. Requires mandatory cancellation reason. |
| `POST /bookings/:id/extend` | `user` | `bookingService.requestExtension` | Requests 1-2 hours overtime extension. |
| `POST /bookings/:id/edit` | `user` | `bookingService.edit` | Modifies booking notes or group size. |
| `GET /my-score` | `user` | `scoreService.getScoreAuditTrail` | Reliability score breakdown and dispute filing form. |
| `POST /disputes` | `user` | `scoreService.fileDispute` | Files formal dispute. Requires mandatory explanation reason. |
| `GET /history` | `user` | `bookingService.getUserHistory` | Completed bookings custody history and settlements. |
| `POST /bookings/:id/rate` | `user` | `spaceService.addRating` | Rates space (1-5 stars) with optional review text. |
| `GET /notifications` | Authenticated | `notificationService.getUserNotifications` | Notification center. |
| `POST /notifications/:id/read` | Authenticated | `notificationService.markRead` | Marks specific notification read. |
| `POST /notifications/read-all` | Authenticated | `notificationService.markAllRead` | Marks all notifications read. |
| `GET /owner/requests` | `owner` | `bookingService.getOwnerRequests` | Incoming booking requests queue. |
| `POST /owner/requests/:id/approve` | `owner` | `bookingService.approve` | Approves request. Generates PIN code; audit log entry. |
| `POST /owner/requests/:id/reject` | `owner` | `bookingService.reject` | Rejects request. Releases deposit. Mandatory reason logged. |
| `POST /owner/requests/:id/waitlist` | `owner` | `bookingService.waitlist` | Moves request to waitlist. Mandatory reason logged. |
| `GET /owner/my-spaces` | `owner` | `spaceService.getOwnerSpaces` | Space inventory with active toggle. |
| `GET /owner/spaces/add` | `owner` (verified) | None | New space creation form (blocked if owner pending). |
| `POST /owner/spaces` | `owner` (verified) | `spaceService.create` | Inserts new space; writes audit log. |
| `GET /owner/spaces/:id/edit` | Space Owner | `spaceService.getSpaceById` | Edit space form. Enforces owner ID ownership. |
| `POST /owner/spaces/:id` | Space Owner | `spaceService.update` | Updates space attributes; writes audit log. |
| `GET /owner/calendar` | `owner` | `bookingService.getOwnerCalendar` | Weekly calendar matrix and slot status. |
| `GET /owner/today` | `owner` | `bookingService.getOwnerToday` | Today's check-ins, returns, and live sessions. |
| `POST /owner/checkin/:id` | `owner` | `bookingService.checkin` | Check-in verification checklist submission. *(NOTE: differs from plan.md due to route prefix)* |
| `POST /owner/return/:id` | `owner` | `bookingService.return` | Return checklist submission. Awards +5 clean score; releases deposit. |
| `POST /owner/today/:id/flag` | `owner` | `incidentService.createFromReturn` | Flags damage/incident. Freezes deposit; logs audit entry. |
| `POST /owner/today/:id/no-show` | `owner` | `bookingService.markNoShow` | Marks no-show. Deducts -10 score; releases slot. Mandatory reason. |
| `POST /owner/bookings/:id/mark-paid`| `owner` | `bookingService.markPaymentReceived` | Marks 'pay_at_venue' payment as collected. |
| `POST /owner/bookings/:id/approve-extension`| `owner` | `bookingService.approveExtension` | Approves overtime extension; adjusts payout. |
| `POST /owner/bookings/:id/reject-extension` | `owner` | `bookingService.rejectExtension` | Rejects overtime extension. Mandatory reason logged. |
| `GET /owner/incidents` | `owner` | `bookingService.getOwnerIncidents` | Damage reports and deposit deduction management. |
| `POST /owner/incidents/:id/confirm` | `owner` | `incidentService.confirm` | Confirms damage deduction. Deducts -30 score; logs audit entry. |
| `POST /owner/incidents/:id/waive` | `owner` | `incidentService.waive` | Waives incident; refunds deposit; logs audit entry. |
| `GET /owner/history` | `owner` | `bookingService.getOwnerHistory` | Past bookings custody history and payouts. |
| `GET /owner/earnings` | `owner` | `bookingService.getOwnerEarnings` | Revenue ledger, fee deductions, payout method setup. |
| `POST /owner/payout-method` | `owner` | `userService.updatePayoutMethod` | Configures masked bank account or UPI VPA. |
| `GET /admin/overview` | `admin` | `userService.getAdminCounts` | Platform high-level governance dashboard. |
| `GET /admin/verify-owners` | `admin` | `userService.getPendingOwners` | Pending space owner documents review queue. |
| `POST /admin/owners/:id/verify` | `admin` | `userService.approveOwner` | Verifies owner account; enables listing; logs audit entry. |
| `POST /admin/owners/:id/reject` | `admin` | `userService.rejectOwner` | Rejects owner verification. Mandatory reason logged. |
| `GET /admin/users` | `admin` | `userService.getAllUsers` | User search, reliability score inspection. |
| `POST /admin/users/:id/suspend` | `admin` | `userService.suspend` / `unsuspend` | Toggles account suspension. Mandatory reason logged. |
| `GET /admin/disputes` | `admin` | `scoreService.getDisputes` | Arbitrates applicant disputes. |
| `POST /admin/disputes/:id/resolve` | `admin` | `scoreService.resolveDispute` | Upholds or overturns score penalty. Mandatory reason logged. |
| `GET /admin/audit-log` | `admin` | `auditService.getEntries` | Tamper-evident operational audit logs. |
| `GET /admin/settings` | `admin` | `settingsService.getAll` | Platform fee, grace period, and score rule settings. |
| `POST /admin/settings` | `admin` | `settingsService.update` | Updates platform configuration; logs audit entry. |

---

## 5. Core Business Rules to Enforce

1. **Active Booking Definition & Limit**:
   - Active bookings are strictly defined as: `['requested', 'approved', 'checked_in', 'overdue']`.
   - Any user attempting to create a booking when `active_bookings >= 2` must be blocked with an HTTP 400 error.
   - For demo user Priya Mehta (`USR-001`), limit is set to at most 1 active booking.
2. **Weekly Limit per Space**: Max 2 bookings per week per user for any single community space.
3. **Purpose Verification**: Booking `purpose` must be contained within `space.allowed_purposes`.
4. **Strict Overlap Detection**: No two bookings for the same space may have overlapping `start_time` and `end_time` on the same `slot_date`.
5. **FIFO Waitlist**: If a slot is booked, subsequent users are queued in `waitlist` in chronological order. When a booking is cancelled, rank #1 is automatically notified and given a 2-hour window to claim.
6. **Mandatory Reasons**: Mandatory text explanations (`reason`) must be supplied for:
   - Rejections (`POST /owner/requests/:id/reject`)
   - Waitlist placements (`POST /owner/requests/:id/waitlist`)
   - Cancellations (`POST /bookings/:id/cancel`)
   - No-shows (`POST /owner/today/:id/no-show`)
   - Incident confirmations (`POST /owner/incidents/:id/confirm`)
   - Account suspensions (`POST /admin/users/:id/suspend`)
   - Dispute resolutions (`POST /admin/disputes/:id/resolve`)
   - Owner verification rejections (`POST /admin/owners/:id/reject`)
7. **No Auto-Approvals**: BORO never automatically approves bookings. Scores and tiers are strictly advisory to guide human custodian discretion.
8. **Cancellation Window**: Users can cancel up to 2 hours before `start_time`. Cancellations under 2 hours are blocked.
9. **Refund Policy on Reject or Cancel**:
   - Booking Rejected: 100% refund of hourly fee and deposit.
   - Cancelled > 2 hours: 100% refund of hourly fee and deposit.
10. **PIN Code Access Privacy**: The 4-digit `pin_code` / `access_pin` is strictly hidden and returns `null` unless the booking is in `approved` or `checked_in` status.
11. **Ownership Enforcement**: Owners can only view and manage bookings for spaces they own (`space.owner_id === owner.id`).
12. **Owner Verification Gate**: Owners with `status === 'pending'` or `verified === false` may sign in, but are blocked from listing spaces.
13. **Receipt Access Guard**: Receipts (`/bookings/:id/receipt`) may only be viewed by the booking applicant, the space owner, or platform administrators.

---

## 6. Status Transitions & Formulas

### Booking State Machine
```
[requested] ──────► [rejected] (100% refund, audit logged)
     │
     ├────────────► [waitlisted] (FIFO queue)
     │
     ▼
 [approved] ──────► [cancelled] (> 2h window, 100% refund)
     │
     ▼
[checked_in] ─────► [overdue] (> 15m overstay without consent)
     │
     ├────────────► [damaged] (incident flagged)
     │
     ▼
 [returned] ──────► [closed] (settlement finalized)
```

### Formulas
- **Reliability Score**:
  `score = clamp(0, 120, 100 + sum(confirmed_score_deltas))`
  - Clean on-time return: `+5` points
  - Late return (> 15m grace period): `-10` points
  - No-show reservation: `-10` points
  - Confirmed facility damage: `-30` points
  - All scores must remain exact multiples of 5.
- **Deposit & Settlement Reconciliation**:
  `deposit_held = deduction_total + refund_amount`
- **Financial Breakdown**:
  - `hourly_fee = price_per_hour * duration_hours`
  - `total_payable = hourly_fee + deposit_amount`
  - `platform_fee = hourly_fee * 0.08` (8%)
  - `net_payout = hourly_fee - platform_fee`

---

## 7. Authentication & Session Architecture

- **Session User Shape**:
  ```javascript
  req.session.user = {
    id: "USR-001",
    name: "Priya Mehta",
    email: "priya@demo.com",
    role: "user",        // 'user' | 'owner' | 'admin'
    initials: "PM",
    status: "active"     // 'active' | 'pending' | 'suspended'
  };
  ```
  *(Never attach password hash or sensitive financial credentials to session).*
- **Swap Points**: Refer to [`docs/AUTH_HANDOFF.md`](docs/AUTH_HANDOFF.md) for full auth handoff guidance.

---

## 8. Seed Data & CLI Scripts

### Seed Users
- `USR-001`: Priya Mehta (`priya@demo.com`, pass: `demo123`, role: `user`, score: 95, tier: 1, active bookings: 1)
- `USR-002`: Aarav Sharma (`aarav@demo.com`, pass: `demo123`, role: `user`, score: 75, tier: 2, active bookings: 2)
- `USR-003`: Rajesh Kumar (`rajesh@demo.com`, pass: `demo123`, role: `owner`, score: 100, tier: 1, active bookings: 0)
- `USR-004`: Vikram Malhotra (`vikram@demo.com`, pass: `demo123`, role: `owner`, score: 100, tier: 1, active bookings: 0)
- `USR-005`: Sunita Rao (`sunita@demo.com`, pass: `demo123`, role: `owner`, status: `pending`, unverified)
- `USR-006`: Rohan Desai (`rohan@demo.com`, pass: `demo123`, role: `user`, score: 45, tier: 3, active bookings: 1)
- `USR-007`: Ananya Iyer (`ananya@demo.com`, pass: `demo123`, role: `user`, score: 105, tier: 1, active bookings: 1)
- `USR-008`: Meera Nair (`meera@demo.com`, pass: `demo123`, role: `user`, score: 100, tier: 1, active bookings: 1)
- `USR-099`: Amit Verma (`admin@demo.com`, pass: `demo123`, role: `admin`, score: 100, tier: 1)

### Seed Spaces
- `SP-001`: Shanti Niketan Community Ground (Ground, ₹1,200/hr, deposit ₹3,000, outdoor)
- `SP-002`: Gulmohar Society Hall (Hall, ₹800/hr, deposit ₹2,500, indoor)
- `SP-003`: Vidya Mandir School Playground (Playground, ₹650/hr, deposit ₹2,000, outdoor)
- `SP-004`: Navprabhat Activity Room (Small Room, ₹350/hr, deposit ₹1,000, indoor)
- `SP-005`: Pragati Community Storeroom B (Storeroom, ₹200/hr, deposit ₹1,500, indoor)
- `SP-006`: Sahyadri Sports Ground (Ground, ₹1,500/hr, deposit ₹3,500, outdoor)
- `SP-007`: Kalyan Heritage Society Hall (Hall, ₹1,100/hr, deposit ₹3,000, indoor)
- `SP-008`: Adarsh School Athletic Field (Playground, ₹750/hr, deposit ₹2,200, outdoor)
- `SP-009`: Saraswati Study & Guild Room (Small Room, ₹400/hr, deposit ₹1,200, indoor)
- `SP-010`: Lokmanya Equipment Storeroom (Storeroom, ₹250/hr, deposit ₹1,000, indoor)

### Key Seed Bookings
- `BK-1001`: Priya Mehta, SP-002, Tomorrow 09:00-13:00, `approved`, PIN `4921`, paid UPI ₹5,700
- `BK-1002`: Aarav Sharma, SP-001, Today 09:00-12:00, `checked_in`, paid UPI ₹6,600
- `BK-1003`: Ananya Iyer, SP-002, Day +3 10:00-14:00, `requested`, Pay at venue, total payable ₹5,700
- `BK-1004`: Rohan Desai, SP-002, Today 08:00-12:00, `overdue`, fee ₹3,200, deposit ₹2,500
- `BK-1005`: Aarav Sharma, SP-001, Returned with incident INC-001 (damage ₹800, refund ₹2,200)

### Relative Date Helper
Mock data uses `getRelativeDate(dayOffset, hour, minute)` with `+05:30` (Asia/Kolkata) timezone so seed dates remain realistic relative to runtime execution date.

### Required Teammate Scripts
- `npm run seed`: Populate database with seed data.
- `npm run reset`: Wipe database and re-seed.
- `npm run check-data`: **ALREADY EXISTS**. Validates reliability score sums, active booking counts, deposit reconciliation math, and hourly fee consistency.

---

## 9. Background Jobs & Production Security Checklist

### Background Cron Tasks
1. **Overdue Session Scanner** (Every 15 min): Queries `bookings` where `end_time + 15 min < NOW()` and `status === 'checked_in'`. Updates status to `overdue`; dispatches alert to owner.
2. **Session Reminder Dispatcher** (Every hour): Sends reminders 24h and 2h prior to `start_time`.
3. **Waitlist Auto-Promoter** (On booking cancellation): Notifies FIFO position #1; reserves slot for 2 hours.

### Security Checklist
- [ ] Hash passwords with `bcrypt` (salt rounds >= 10).
- [ ] Implement persistent session store (Redis via `connect-redis`).
- [ ] Schema input validation on all POST routes using `zod` or `joi`.
- [ ] Wire CSRF protection (`csurf` or signed cookies) using hidden inputs `<input type="hidden" name="_csrf" value="...">`.
- [ ] Implement rate limiting on `POST /login` (max 5 requests per 15 min).
- [ ] Set secure cookie flags: `httpOnly: true`, `secure: true`, `sameSite: 'lax'`.
- [ ] Enforce multipart image upload validation with `multer` (max 5MB, jpeg/png/pdf only).

---

## 10. Step-by-Step Integration Order & Definition of Done

### Integration Steps
1. **Database Schema & Migrations**: Create tables and foreign keys in PostgreSQL.
2. **Auth & Sessions**: Implement `userService.authenticate` and `create` with bcrypt and persistent Redis sessions.
3. **Space Discovery & Viewing**: Wire `spaceService.getSpaces` and `getSpaceById`.
4. **Booking & Waitlist Pipeline**: Implement `bookingService.create`, `cancel`, and FIFO waitlist queuing.
5. **Owner Custodial Operations**: Wire check-in/return checklists, incident management, and deposit refunds.
6. **Admin Governance & Audit**: Connect owner verification, dispute resolution, and settings update.

### Definition of Done (DoD)
- [ ] All 38 routes in `scripts/testRoutes.js` return HTTP 200/302.
- [ ] All 8 test cases in `scripts/testAuth.js` pass with 0 errors.
- [ ] `npm run check-data` passes with 0 consistency errors.
- [ ] Setting `USE_MOCK = false` executes complete end-to-end user and owner journeys against PostgreSQL.

---

## 11. Form Fields Reference Table (POST Payloads)

| Endpoint | Field Names & Data Types | Required / Optional | Description |
|---|---|---|---|
| `POST /login` | `email` (string), `password` (string), `_csrf` (string) | Required | Authentication credentials |
| `POST /signup` | `name` (string), `email` (string), `phone` (string), `role` (enum), `password` (string), `confirm_password` (string), `organisation` (string), `id_proof` (file) | Role-conditional | Account creation |
| `POST /bookings` | `space_id` (string), `purpose` (string), `slot_date` (date), `start_time` (time), `end_time` (time), `group_size` (int), `payment_method` (enum) | Required | Booking request with demo payment |
| `POST /bookings/:id/cancel` | `reason` (string) | Required | Applicant cancellation with mandatory reason |
| `POST /bookings/:id/extend` | `additional_hours` (int: 1 or 2) | Required | Session overtime extension request |
| `POST /bookings/:id/edit` | `notes` (string), `group_size` (int) | Optional | Update booking instructions |
| `POST /bookings/:id/rate` | `rating` (int: 1-5), `review` (string) | Rating required | Space post-occupancy review |
| `POST /disputes` | `score_event_id` (string), `reason` (string) | Required | Formal penalty dispute filing |
| `POST /owner/spaces` | `name` (string), `space_type` (enum), `indoor_outdoor` (enum), `capacity` (int), `sqft` (int), `price_per_hour` (number), `deposit_amount` (number), `locality` (string), `city` (string), `address` (string), `amenities` (array/string), `allowed_purposes` (array/string), `rules` (string) | Required | Space creation payload |
| `POST /owner/spaces/:id` | Same as `POST /owner/spaces` | Required | Space update payload |
| `POST /owner/requests/:id/approve` | `reason` (string) | Optional/Mandatory | Approval check-in instructions |
| `POST /owner/requests/:id/reject` | `reason` (string) | **Mandatory** | Rejection justification |
| `POST /owner/requests/:id/waitlist` | `reason` (string) | **Mandatory** | Reason for waitlist assignment |
| `POST /owner/checkin/:id` | `cleanliness_verified` (bool), `sound_system_working` (bool), `lights_fans_functional` (bool), `furniture_arranged` (bool), `condition_notes` (string) | Checklist items required | Pre-occupancy condition checklist |
| `POST /owner/return/:id` | `cleanliness_verified` (bool), `sound_system_working` (bool), `lights_fans_functional` (bool), `furniture_arranged` (bool), `waste_disposed` (bool), `condition_notes` (string) | Checklist items required | Post-occupancy return checklist |
| `POST /owner/today/:id/flag` | `reason` (string), `severity` (enum) | Required | Flag incident during return |
| `POST /owner/today/:id/no-show` | `reason` (string) | **Mandatory** | Mark unfulfilled reservation |
| `POST /owner/bookings/:id/mark-paid` | None (form trigger) | None | Confirms venue cash/direct payment |
| `POST /owner/incidents/:id/confirm` | `deduction_amount` (number), `reason` (string) | Required | Confirm deposit deduction |
| `POST /owner/incidents/:id/waive` | `reason` (string) | **Mandatory** | Waive damage claim |
| `POST /owner/payout-method` | `payout_type` (enum), `account_number` (string), `ifsc_code` (string), `upi_id` (string) | Type-conditional | Payout disbursement setup |
| `POST /admin/owners/:id/verify` | `reason` (string) | Optional | Admin approval of owner documents |
| `POST /admin/owners/:id/reject` | `reason` (string) | **Mandatory** | Admin rejection of owner documents |
| `POST /admin/users/:id/suspend` | `reason` (string) | **Mandatory** | Operator suspension justification |
| `POST /admin/disputes/:id/resolve` | `decision` (enum), `reason` (string) | **Mandatory** | Dispute arbitration resolution |
| `POST /admin/settings` | `max_active_bookings_per_user` (int), `grace_period_mins` (int), `no_show_window_hours` (int), `platform_fee_percent` (number), `points_clean_return` (int), `points_late_return` (int), `points_no_show` (int), `points_damage` (int) | Required | System threshold configuration |

