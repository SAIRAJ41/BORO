# Database

Database schema, migrations, and seeds go here (backend teammate).

See `plan.md` in the project root for:
- Canonical entity IDs and data shapes for all 20 views
- Space model (`community_hall`, `community_ground`, `school_playground`, `small_room`, `storeroom`)
- Tables to implement:
  - `users`
  - `spaces`
  - `availability_slots`
  - `bookings`
  - `condition_reports`
  - `incidents`
  - `score_events`
  - `ratings`
  - `waitlist` (FIFO sequential queue)
  - `notifications`
  - `disputes`
  - `audit_log` (append-only)
  - `settings`
- Business rules:
  - Advisory reliability score: NO auto-approvals for any tier, owners decide all booking requests.
  - Max 2 active bookings per user (`requested`, `approved`, `checked_in`, `overdue`).
  - Weekly space booking limit per user (default 3).
  - Purpose validation against `space.allowed_purposes`.
  - Overlap protection on same space and slot.
  - Score changes: +5 on-time clean return, -10 late return, -10 no-show, -30 confirmed damage. Clamp 0-120.
  - Reason mandatory for approve, reject, waitlist, cancel, dispute resolution, deduction confirmation, suspension.
  - Condition notes required for check-in and return.
