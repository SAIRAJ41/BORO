# SpaceShare — Community Space Sharing Platform — Build Plan

> [!IMPORTANT]
> **Scope: Front-End Only Delivery.**
> This project builds the complete, production-grade frontend UI using Node.js, Express, EJS templates, Tailwind CSS, and lightweight vanilla JS.
> The backend and database will be implemented by teammates. Clear blank stubs are maintained in `/services`, `/middleware/auth.js`, and `/database`. All route handlers obtain data from a single `mockData` call at the top. All action buttons and forms submit to named POST placeholder routes with `// BACKEND TODO` comments and return flash notifications.

---

## 1. Project Summary & Terminology Rule

**SpaceShare** is a community space-sharing web platform where owners list underused neighborhood spaces (society halls, community grounds, school playgrounds after hours, small meeting rooms, and storerooms) and verified community members book time slots.

### Terminology Rule
The word **"hall" appears only as the space type label** (e.g. `community_hall` displays as "Community Hall"). Everywhere else in the UI, navigation, buttons, copy, and code, use **"space"** (e.g., *spaces*, *SpaceCard*, *My Spaces*, *Add Space*, routes like `/spaces/:id`).

---

## 2. Screen List

| # | Design Reference Folder | Screen Title | Route | Role / Access |
|---|---|---|---|---|
| 1 | *(Custom)* | Login & "Try Demo" Panel | `GET /login` | Public |
| 2 | *(Custom)* | User & Owner Sign Up | `GET /signup` | Public |
| 3 | *(Custom)* | Profile & Verification (demo ID proof) | `GET /profile` | User / Owner |
| 4 | `search_discover_halls` | Search & Discover Spaces | `GET /search` | Public / User |
| 5 | `hall_details_booking` | Space Detail, Slot Picker & Demo Payment | `GET /spaces/:id` | Public / User |
| 6 | *(Custom)* | Booking Demo Payment Receipt | `GET /bookings/:id/receipt` | User |
| 7 | `my_bookings` | My Bookings (Active, Waitlisted, Past) | `GET /my-bookings` | User |
| 8 | `my_score_reliability` | My Score & Reliability Dashboard | `GET /my-score` | User |
| 9 | `booking_history_timelines` | User Booking History & Timelines | `GET /history` | User |
| 10 | `notifications_alerts` | Notifications & Alert Preferences | `GET /notifications` | User / Owner |
| 11 | `owner_requests` | Owner — Booking Requests & Decisions | `GET /owner/requests` | Owner |
| 12 | `my_halls` | Owner — My Spaces Management | `GET /owner/my-spaces` | Owner |
| 13 | `my_halls` *(modal/sub)* | Owner — Add New Space Listing | `GET /owner/spaces/add` | Owner (Verified) |
| 14 | `my_halls` *(modal/sub)* | Owner — Edit Space Listing | `GET /owner/spaces/:id/edit` | Owner (Verified) |
| 15 | `owner_calendar` | Owner — Calendar & Conflict Matrix | `GET /owner/calendar` | Owner |
| 16 | `today_s_operations` | Owner — Today's Check-ins & Returns | `GET /owner/today` | Owner |
| 17 | `incidents_deductions` | Owner — Incidents & Deposit Deductions | `GET /owner/incidents` | Owner |
| 18 | `custodial_history` | Owner — History & Custodial Archives | `GET /owner/history` | Owner |
| 19 | `owner_earnings` | Owner — Revenue, Payouts & Performance | `GET /owner/earnings` | Owner |
| 20 | *(Custom)* | Admin — Overview Metrics | `GET /admin/overview` | Admin |
| 21 | *(Custom)* | Admin — Owner Verification Queue | `GET /admin/verify-owners` | Admin |
| 22 | *(Custom)* | Admin — Users Management | `GET /admin/users` | Admin |
| 23 | *(Custom)* | Admin — Dispute Resolution | `GET /admin/disputes` | Admin |
| 24 | *(Custom)* | Admin — Audit Log (Searchable) | `GET /admin/audit-log` | Admin |
| 25 | *(Custom)* | Admin — Fairness Settings | `GET /admin/settings` | Admin |
| 26 | *(Custom)* | 403 Forbidden Error Page | `403` | Public |
| 27 | *(Custom)* | 404 Not Found Error Page | `404` | Public |
| 28 | *(Custom)* | 500 Server Error Page | `500` | Public |

---

## 3. Full Route Table

### 3a. GET Routes (Page Views)
*Every route handler retrieves data from a single call at the top, passing raw numbers and ISO dates to views where view helpers format currency and timestamps.*

| Method | Path | Page / Description | Data Passed to View | Backend Service Stub to Supply |
|---|---|---|---|---|
| GET | `/login` | Login page with 1-click Demo panel | `demoUsers`, `flash` | — |
| GET | `/signup` | Sign-up (User / Owner pending) | `flash` | — |
| GET | `/demo/:role` | Sets mock session user from `mock.js` and redirects | `flash` | `userService.getDemoUser(role)` |
| GET | `/profile` | Profile & Verification (demo ID proof) | `user`, `verificationStatus`, `payoutMethod`, `flash` | `userService.getProfile(userId)` |
| GET | `/search` | Search & Discover with multi-filters | `spaces`, `filters`, `filterOptions`, `pagination`, `flash` | `spaceService.getSpaces(filters, page, limit)` |
| GET | `/spaces/:id` | Space Detail, slot picker, demo payment form | `space`, `availableSlots`, `conditionHistory`, `eligibility`, `flash` | `spaceService.getSpaceById(id)`, `spaceService.getConditionHistory(spaceId)`, `bookingService.getAvailableSlots(spaceId, date)` |
| GET | `/bookings/:id/receipt` | Demo payment receipt view | `booking`, `space`, `flash` | `bookingService.getBookingById(id)` |
| GET | `/my-bookings` | My Bookings (tabs: all/upcoming/waitlist/completed) | `stats`, `bookings`, `activeTab`, `pagination`, `flash` | `bookingService.getUserBookings(userId, tab, page, limit)`, `bookingService.getUserBookingStats(userId)` |
| GET | `/my-score` | Reliability score, tiers, breakdown, dispute log | `score`, `tiers`, `penalties`, `auditTrail`, `flash` | `scoreService.getUserScore(userId)` |
| GET | `/history` | User completed bookings 5-stage lifecycle | `stats`, `completedBookings`, `pagination`, `flash` | `bookingService.getUserHistory(userId, page, limit)` |
| GET | `/notifications` | Notifications center and alert settings | `notifications`, `unreadCount`, `activeTab`, `alertSettings`, `flash` | `notificationService.getUserNotifications(userId, tab)` |
| GET | `/owner/requests` | Booking requests awaiting owner decision | `stats`, `requests`, `flash` | `bookingService.getOwnerRequests(ownerId)` |
| GET | `/owner/my-spaces` | Owner spaces list with status & slots | `stats`, `spaces`, `ownerVerified`, `flash` | `spaceService.getOwnerSpaces(ownerId)` |
| GET | `/owner/spaces/add` | Space creation form with type-specific fields | `spaceTypeOptions`, `facilityOptions`, `purposeOptions`, `flash` | `spaceService.getFormOptions()` |
| GET | `/owner/spaces/:id/edit` | Space editing form | `space`, `spaceTypeOptions`, `facilityOptions`, `purposeOptions`, `flash` | `spaceService.getSpaceById(id)`, `spaceService.getFormOptions()` |
| GET | `/owner/calendar` | Weekly booking schedule with conflict highlights | `stats`, `week`, `events`, `conflicts`, `spaces`, `flash` | `bookingService.getOwnerCalendar(ownerId, week)` |
| GET | `/owner/today` | Operations: Check-ins & Returns with ConditionForm | `checkins`, `returns`, `activeAudit`, `flash` | `bookingService.getOwnerToday(ownerId)` |
| GET | `/owner/incidents` | Incident reports, deposit deductions, ledger | `stats`, `activeIncident`, `ledger`, `flash` | `incidentService.getOwnerIncidents(ownerId)` |
| GET | `/owner/history` | Custodial archive, condition logs, payouts | `stats`, `archivedBookings`, `pagination`, `flash` | `bookingService.getOwnerHistory(ownerId, page, limit)` |
| GET | `/owner/earnings` | Monthly revenue, payouts list, performance | `stats`, `facilities`, `satisfaction`, `payouts`, `payoutMethod`, `flash` | `bookingService.getOwnerEarnings(ownerId)` |
| GET | `/admin/overview` | Platform counts & health overview | `counts`, `recentActivity`, `flash` | `userService.getAdminCounts()` |
| GET | `/admin/verify-owners` | Pending owner applications queue | `pendingOwners`, `flash` | `userService.getPendingOwners()` |
| GET | `/admin/users` | User directory with scores & suspension controls | `users`, `query`, `pagination`, `flash` | `userService.getAllUsers(query, page, limit)` |
| GET | `/admin/disputes` | Member score disputes requiring review | `disputes`, `flash` | `scoreService.getDisputes()` |
| GET | `/admin/audit-log` | Searchable append-only platform audit log | `entries`, `filters`, `pagination`, `flash` | `auditService.getEntries(filters, page, limit)` |
| GET | `/admin/settings` | Platform governance & fairness parameters | `settings`, `flash` | `settingsService.getAll()` |

---

### 3b. POST Routes (Forms & Actions — Named Stubs)
*Every action route below exists in the router, contains a `// BACKEND TODO:` comment indicating the required logic, audit log writing, and redirects back with a flash message: `"Not connected yet"`.*

| Method | Path | Action Triggered | Target Redirect | Backend Logic / Stubs Required |
|---|---|---|---|---|
| POST | `/login` | Public login form submit | `/search` or `/owner/requests` or `/admin/overview` | `userService.authenticate(email, password)` |
| POST | `/signup` | Sign-up form (User or pending Owner) | `/login` | `userService.create(data)` |
| POST | `/logout` | End session | `/login` | `req.session.destroy()` |
| POST | `/bookings` | Create new booking (with demo payment: `payment_method`) | `/my-bookings` | `bookingService.create(userId, spaceId, slotId, purpose, groupSize, paymentMethod)` — validates max 2 active bookings, purpose match, overlap check |
| POST | `/bookings/:id/edit` | Edit purpose or group size of pending booking | `/my-bookings` | `bookingService.edit(bookingId, userId, data)` |
| POST | `/bookings/:id/cancel` | Cancel booking (warns if <2h) | `/my-bookings` | `bookingService.cancel(bookingId, userId, reason)` + `auditService.log()` |
| POST | `/bookings/:id/extend` | Request time extension | `/my-bookings` | `bookingService.requestExtension(bookingId, userId, additionalHours)` |
| POST | `/bookings/:id/rate` | Submit review and rating for completed space | `/history` | `spaceService.addRating(spaceId, bookingId, userId, rating, review)` |
| POST | `/waitlist/:spaceId/:slotId` | Join waitlist for reserved slot (FIFO) | `/spaces/:spaceId` | `bookingService.joinWaitlist(userId, spaceId, slotId)` (strictly time-ordered) |
| POST | `/waitlist/:id/leave` | Leave waitlist queue | `/my-bookings` | `bookingService.leaveWaitlist(waitlistId, userId)` |
| POST | `/disputes` | File reliability score dispute | `/my-score` | `scoreService.fileDispute(userId, auditEntryId, reason)` |
| POST | `/notifications/:id/read` | Mark individual notification read | `/notifications` | `notificationService.markRead(notifId)` |
| POST | `/notifications/read-all` | Mark all notifications read | `/notifications` | `notificationService.markAllRead(userId)` |
| POST | `/owner/requests/:id/approve` | Approve booking (requires reason) | `/owner/requests` | `bookingService.approve(bookingId, ownerId, reason)` + `auditService.log()` |
| POST | `/owner/requests/:id/reject` | Reject booking (requires reason) | `/owner/requests` | `bookingService.reject(bookingId, ownerId, reason)` + `auditService.log()` |
| POST | `/owner/requests/:id/waitlist` | Move request to waitlist (requires reason) | `/owner/requests` | `bookingService.waitlist(bookingId, ownerId, reason)` + `auditService.log()` |
| POST | `/owner/spaces` | Create new space | `/owner/my-spaces` | `spaceService.create(ownerId, data)` (owner verified check) |
| POST | `/owner/spaces/:id` | Update existing space | `/owner/my-spaces` | `spaceService.update(spaceId, ownerId, data)` (ownership check) |
| POST | `/owner/checkin/:id` | Record check-in + ConditionForm (condition notes) | `/owner/today` | `bookingService.checkin(bookingId, conditionData, conditionNotes)` + `auditService.log()` |
| POST | `/owner/return/:id` | Record return + ConditionForm (+5 if on time & clean, else confirm late -10) | `/owner/today` | `bookingService.return(bookingId, conditionData, conditionNotes)` + `scoreService.adjust()` + `auditService.log()` |
| POST | `/owner/today/:id/flag` | Flag condition issue during return | `/owner/today` | `incidentService.createFromReturn(bookingId, data)` + `auditService.log()` |
| POST | `/owner/today/:id/no-show` | Mark user as no-show | `/owner/today` | `bookingService.markNoShow(bookingId, reason)` + `scoreService.adjust(-10)` + `auditService.log()` |
| POST | `/owner/bookings/:id/mark-paid` | Mark Pay at venue as paid | `/owner/requests` or `/owner/today` | `bookingService.markPaymentReceived(bookingId, ownerId)` + `auditService.log()` |
| POST | `/owner/bookings/:id/approve-extension` | Approve extension request | `/owner/requests` or `/owner/today` | `bookingService.approveExtension(bookingId, ownerId)` + `auditService.log()` |
| POST | `/owner/bookings/:id/reject-extension` | Reject extension request | `/owner/requests` or `/owner/today` | `bookingService.rejectExtension(bookingId, ownerId, reason)` + `auditService.log()` |
| POST | `/owner/payout-method` | Save payout method (UPI / Bank transfer) | `/owner/earnings` | `userService.updatePayoutMethod(ownerId, data)` |
| POST | `/owner/incidents/:id/confirm` | Confirm deposit deduction & score penalty | `/owner/incidents` | `incidentService.confirm(incidentId, deductions, reason)` + `scoreService.adjust(-30)` + `auditService.log()` |
| POST | `/owner/incidents/:id/waive` | Waive deduction with warning | `/owner/incidents` | `incidentService.waive(incidentId, reason)` + `auditService.log()` |
| POST | `/admin/verify-owners/:id/approve`| Approve pending owner | `/admin/verify-owners` | `userService.approveOwner(ownerId, reason)` + `auditService.log()` |
| POST | `/admin/verify-owners/:id/reject` | Reject pending owner | `/admin/verify-owners` | `userService.rejectOwner(ownerId, reason)` + `auditService.log()` |
| POST | `/admin/users/:id/suspend` | Suspend user account | `/admin/users` | `userService.suspend(userId, reason)` + `auditService.log()` |
| POST | `/admin/users/:id/unsuspend` | Restore user account | `/admin/users` | `userService.unsuspend(userId, reason)` + `auditService.log()` |
| POST | `/admin/disputes/:id/resolve` | Resolve dispute (accept/dismiss) | `/admin/disputes` | `scoreService.resolveDispute(disputeId, decision, reason)` + `auditService.log()` |
| POST | `/admin/settings` | Update platform fairness rules | `/admin/settings` | `settingsService.update(data)` + `auditService.log()` |

---

## 4. Definition of "Active Booking" & Canonical Recount

> **Rule:** An **active booking** is defined strictly as having status:
> `requested` | `approved` | `checked_in` | `overdue`
> Inactive / past statuses (`returned`, `closed`, `cancelled`, `rejected`) do not count toward the active booking limit.

### Canonical Users & Active Booking Counts
- `USR-001` — **Priya Mehta** (Role: `user`, Score: 95, Tier: 1 "Normal Access", Initials: `PM`)
  - Active Bookings: **1** (`BK-1001` `approved` 09:00–13:00 on `SP-002`). *Can test booking a second space!*
  - Score derivation: Base 100 - 10 (late return) + 5 (clean return) = 95.
- `USR-002` — **Aarav Sharma** (Role: `user`, Score: 75, Tier: 2 "Owner Approval", Initials: `AS`)
  - Active Bookings: **1** (`BK-1002` `approved` with check-in due today on `SP-001`).
  - Score derivation: Base 100 - 30 (confirmed damage) + 5 (clean return) = 75.
- `USR-003` — **Rajesh Kumar** (Role: `owner`, Status: `verified`, Initials: `RK`)
  - Owns spaces: `SP-001`, `SP-002`, `SP-003`, `SP-007`, `SP-008`.
  - Payout method: `{ type: "bank_transfer", masked_details: "Demo Bank •••• 4092" }`.
- `USR-004` — **Vikram Malhotra** (Role: `owner`, Status: `verified`, Initials: `VM`)
  - Owns spaces: `SP-004`, `SP-005`, `SP-006`, `SP-009`, `SP-010`.
  - Payout method: `{ type: "upi", masked_details: "vikram@demo" }`.
- `USR-005` — **Sunita Rao** (Role: `owner`, Status: `pending`, Initials: `SR`)
  - Documents submitted: `["Aadhaar Demo ID", "Property Tax Receipt"]`.
- `USR-006` — **Rohan Desai** (Role: `user`, Score: 45, Tier: 3 "Owner Review with Advisory Warning", Initials: `RD`)
  - Active Bookings: **1** (`BK-1004` `overdue` on `SP-002`, now minus 35 minutes).
  - Note on Tier 3: The space owner decides with a stronger advisory warning. No admin booking review.
  - Score derivation: Base 100 - 30 (damage) - 15 (late fee & penalties) - 10 (late return) = 45.
- `USR-007` — **Ananya Iyer** (Role: `user`, Score: 105, Tier: 1 "Normal Access", Initials: `AI`)
  - Active Bookings: **1** (`BK-1003` `requested` on `SP-002`).
  - Score derivation: Base 100 + 5 (clean return) = 105.
- `USR-099` — **Amit Verma** (Role: `admin`, Initials: `AV`)

### Rajesh's Spaces Populate Today & Incidents
- `BK-1002` (User: `USR-002` Aarav, `approved`, check-in due today on `SP-001` Shanti Niketan Ground).
- `BK-1004` (User: `USR-006` Rohan, `overdue` return on `SP-002` Gulmohar Society Hall, now minus 35 minutes) appears on Rajesh's **Today's Operations** page (`/owner/today`).
- `BK-1005` (User: `USR-002` Aarav, damaged pavilion turf/latch on `SP-001` Shanti Niketan Ground) appears on Rajesh's **Incidents & Deductions** page (`/owner/incidents`).
- Pending Requests queue on Rajesh's space `SP-002` has 3 requests representing all 3 tiers:
  - `BK-1003`: Ananya Iyer (Tier 1, Score: 105)
  - `BK-1009`: Aarav Sharma (Tier 2, Score: 75)
  - `BK-1010`: Rohan Desai (Tier 3, Score: 45 — shows prominent owner warning banner)
- Calendar conflict on `SP-002`: Two overlapping `requested` bookings contending for the same slot.

---

## 5. Complete Data Shapes Per Page (Raw Numbers & ISO Dates)

*All numbers are raw integers. All timestamps are raw ISO strings. View helpers format them in EJS templates (`formatCurrency`, `formatDate`, `formatTime`).*

### 5a. Search & Discover (`GET /search`)
```js
{
  spaces: [
    {
      id: "SP-001",
      name: "Shanti Niketan Community Ground",
      space_type: "community_ground",
      indoor_outdoor: "outdoor",
      capacity: 200,
      price_per_hour: 500,
      deposit_amount: 2000,
      facilities: ["parking", "floodlights", "water", "toilets", "boundary_wall"],
      allowed_purposes: ["sports", "event", "meeting"],
      rating: 4.8,
      review_count: 42,
      hygiene_score: 9,
      photos: [{ url: "/images/spaces/ground-1.jpg", caption: "Main outfield" }],
      verified: true
    }
  ],
  filters: {
    space_type: null,
    indoor_outdoor: null,
    date: null,
    time_start: null,
    time_end: null,
    capacity_min: null,
    facilities: [],
    price_max: null,
    purpose: null
  },
  filterOptions: {
    spaceTypes: [
      { value: "community_hall", label: "Community Hall" },
      { value: "community_ground", label: "Community Ground" },
      { value: "school_playground", label: "School Playground" },
      { value: "small_room", label: "Small Room" },
      { value: "storeroom", label: "Storeroom" }
    ],
    facilityList: ["kitchen", "av_system", "parking", "wifi", "ramp", "ac", "floodlights", "boundary_wall", "toilets"],
    purposeList: ["sports", "study", "meeting", "event", "storage"]
  },
  pagination: { page: 1, limit: 12, total: 10, totalPages: 1 }
}
```

### 5b. Space Detail & Demo Payment (`GET /spaces/:id`)
```js
{
  space: {
    id: "SP-002",
    name: "Gulmohar Society Hall",
    description: "Centrally air-conditioned community hall equipped with audio system, modular seating, and pantry.",
    address: "Gulmohar Co-op Housing Society, Plot 14, Sector 19A, Nerul, Navi Mumbai",
    area: "Nerul, Navi Mumbai",
    space_type: "community_hall",
    indoor_outdoor: "indoor",
    capacity: 120,
    price_per_hour: 800,
    deposit_amount: 2500,
    min_duration_hours: 2,
    facilities: ["kitchen", "av_system", "parking", "wifi", "ramp", "ac"],
    allowed_purposes: ["meeting", "event", "study"],
    rules: [
      { text: "No open flames or indoor fireworks" },
      { text: "Noise curfew 10:00 PM (keep sound under 60dB)" },
      { text: "Sweep and clear trash prior to checkout" }
    ],
    photos: [
      { url: "/images/spaces/hall-1.jpg", caption: "Main assembly hall" },
      { url: "/images/spaces/hall-kitchen.jpg", caption: "Serving pantry" }
    ],
    owner_id: "USR-003",
    verified: true,
    rating: 4.9,
    review_count: 84,
    hygiene_score: 10
  },
  availableSlots: [
    {
      id: "SLOT-101",
      date: "2026-11-01T00:00:00.000+05:30",
      start_time: "09:00",
      end_time: "13:00",
      duration_hours: 4,
      status: "reserved", // booked by Priya BK-1001
      hourly_fee: 3200,    // 800 * 4
      deposit_amount: 2500,
      total_payable: 5700, // 3200 + 2500
      booked_by: { name: "Priya M.", ref: "#BK-1001" },
      waitlist_count: 1 // Aarav WL-201
    },
    {
      id: "SLOT-102",
      date: "2026-11-01T00:00:00.000+05:30",
      start_time: "14:00",
      end_time: "18:00",
      duration_hours: 4,
      status: "available",
      hourly_fee: 3200,
      deposit_amount: 2500,
      total_payable: 5700,
      booked_by: null,
      waitlist_count: 0
    }
  ],
  conditionHistory: [
    {
      date: "2026-10-20T00:00:00.000+05:30",
      result: "Spotless",
      inspector: "Rajesh Kumar (Owner)",
      details: "Pantry sanitised, chairs stacked, zero scuffs",
      passed: true
    }
  ],
  eligibility: {
    eligible: true,
    active_bookings_count: 1,
    max_active_bookings: 2,
    weekly_bookings_this_space: 1,
    max_weekly_bookings_per_space: 3,
    can_book: true,
    can_waitlist: false,
    ineligible_reasons: [] // e.g. "Weekly limit of 3 bookings for this space reached", "Selected purpose 'storage' not allowed"
  },
  paymentMethods: [
    { value: "upi", label: "UPI (Demo)" },
    { value: "card", label: "Credit / Debit Card (Demo)" },
    { value: "net_banking", label: "Net Banking (Demo)" },
    { value: "pay_at_venue", label: "Pay at Venue (Demo — deposit payable to owner at check-in)" }
  ]
}
```

### 5c. Demo Payment Receipt (`GET /bookings/:id/receipt`)
```js
{
  booking: {
    id: "BK-1001",
    ref: "#BK-1001",
    created_at: "2026-10-28T14:20:00.000Z",
    paid_at: "2026-10-28T14:21:00.000Z",
    payment_method: "upi",
    payment_status: "paid",
    duration_hours: 4,
    hourly_rate: 800,
    hourly_fee: 3200,
    deposit_amount: 2500,
    deposit_status: "held",
    total_paid: 5700,
    pin_code: "9214",
    purpose: "Neighborhood Music Rehearsal",
    group_size: 35
  },
  space: {
    id: "SP-002",
    name: "Gulmohar Society Hall",
    address: "Gulmohar Co-op Housing Society, Sector 19A, Nerul"
  }
}
```

### 5d. My Bookings (`GET /my-bookings`)
```js
{
  stats: {
    active_count: 1,
    max_active: 2,
    deposit_held: 2500,
    next_checkin: "2026-11-01T09:00:00.000Z",
    score: 95
  },
  bookings: [
    {
      id: "BK-1001",
      ref: "#BK-1001",
      space_id: "SP-002",
      space_name: "Gulmohar Society Hall",
      space_photo: "/images/spaces/hall-1.jpg",
      space_type: "community_hall",
      slot_date: "2026-11-01T00:00:00.000Z",
      start_time: "09:00",
      end_time: "13:00",
      duration_hours: 4,
      status: "approved",
      purpose: "Neighborhood Music Rehearsal",
      group_size: 35,
      deposit_amount: 2500,
      deposit_status: "held", // held | refunded | partially_deducted
      payment_method: "upi",
      payment_status: "paid",
      decision_reason: "Approved. Please maintain acoustic panels in corner.",
      waitlist_position: null,
      cancellation_deadline: "2026-11-01T07:00:00.000Z", // 2h prior
      pin_code: "9214",
      can_cancel: true,
      cancel_warning: null // or string if < 2 hours
    }
  ],
  activeTab: "all",
  pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
}
```

### 5e. My Score & Reliability (`GET /my-score`)
```js
{
  score: {
    current: 95,
    baseline: 100,
    max: 120,
    tier: 1,
    tier_name: "Normal Access",
    last_evaluated: "2026-10-24T04:12:00.000Z"
  },
  tiers: [
    {
      level: 1,
      name: "Normal Access",
      range: "80 – 120 pts",
      description: "Eligible for standard owner approval flow.",
      perks: ["Standard deposit rate", "Standard queue placement"]
    },
    {
      level: 2,
      name: "Owner Approval Required",
      range: "50 – 79 pts",
      description: "Requires explicit owner review.",
      perks: ["Owner reviews past history", "Standard deposit rate"]
    },
    {
      level: 3,
      name: "Manual Review Required",
      range: "0 – 49 pts",
      description: "Requires administrator review before space access.",
      perks: ["Manual check-in walkthrough", "Admin clearance"]
    }
  ],
  penalties: [
    { action: "Clean on-time return", points: 5, description: "Check-out on schedule, condition verified spotless" },
    { action: "Late return", points: -10, description: "Overstay past 15 min grace period without owner consent" },
    { action: "No-show reservation", points: -10, description: "Failure to check in without 2h advance cancellation" },
    { action: "Confirmed facility damage", points: -30, description: "Damage discovered during return inspection" }
  ],
  auditTrail: [
    {
      id: "SCR-001",
      impact: 5,
      date: "2026-10-18T14:35:00.000Z",
      reason: "On-time clean return inspected spotless",
      booking_ref: "#BK-1006",
      space_name: "Shanti Niketan Community Ground",
      status: "verified"
    }
  ]
}
```

### 5f. User History & Timelines (`GET /history`)
```js
{
  stats: {
    completed_count: 1,
    clean_ratio_pct: 100,
    total_deposits_returned: 2000,
    reliability_points_earned: 5
  },
  completedBookings: [
    {
      id: "BK-1006",
      ref: "#BK-1006",
      space_id: "SP-001",
      space_name: "Shanti Niketan Community Ground",
      space_photo: "/images/spaces/ground-1.jpg",
      event_label: "Weekend Cricket Match",
      slot_date: "2026-10-18T00:00:00.000Z",
      start_time: "08:00",
      end_time: "12:00",
      duration_hours: 4,
      payment_method: "card",
      payment_status: "paid",
      deposit_amount: 2000,
      deposit_status: "refunded",
      score_change: 5,
      lifecycle: [
        { stage: 1, name: "Requested", date: "2026-10-12T10:14:00.000Z", description: "Booking request submitted", icon: "check" },
        { stage: 2, name: "Approved", date: "2026-10-12T11:00:00.000Z", description: "Owner approved request", icon: "check" },
        { stage: 3, name: "Checked-in", date: "2026-10-18T08:00:00.000Z", description: "Pre-event condition signed", icon: "key" },
        { stage: 4, name: "Returned", date: "2026-10-18T12:00:00.000Z", description: "Ground inspected, spotless", icon: "clipboard" },
        { stage: 5, name: "Settlement", date: "2026-10-18T14:35:00.000Z", description: "Deposit ₹2000 refunded in full, +5 pts", icon: "shield-check" }
      ]
    }
  ],
  pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
}
```

### 5g. Notifications & Alerts (`GET /notifications`)
```js
// User Notifications (e.g. Priya USR-001)
{
  notifications: [
    {
      id: "NTF-302",
      recipient_id: "USR-001",
      type: "booking_approved",
      title: "Gulmohar Society Hall Confirmed",
      message: "Your booking for Nov 01, 09:00 AM was approved by Rajesh Kumar. Access code will be available 1 hour before scheduled start.",
      read: false,
      created_at: "2026-10-28T14:21:00.000+05:30",
      actions: [
        { label: "View Receipt", href: "/bookings/BK-1001/receipt", style: "primary" },
        { label: "View Booking", href: "/my-bookings", style: "secondary" }
      ]
    },
    {
      id: "NTF-303",
      recipient_id: "USR-001",
      type: "reminder",
      title: "Upcoming Session Tomorrow",
      message: "Gulmohar Society Hall is scheduled for tomorrow at 09:00 AM. Access code unlocks at 08:00 AM.",
      read: true,
      created_at: "2026-10-30T10:00:00.000+05:30",
      actions: []
    },
    {
      id: "NTF-304",
      recipient_id: "USR-001",
      type: "score_credit",
      title: "+5 Reliability Points Credited",
      message: "On-time clean return confirmed for Shanti Niketan Community Ground.",
      read: true,
      created_at: "2026-10-18T14:35:00.000+05:30",
      actions: [{ label: "View Score", href: "/my-score", style: "secondary" }]
    }
  ],
  unreadCount: 1,
  activeTab: "all",
  alertSettings: {
    label: "Alert Dispatch Channels (demo)",
    twoHourWarningSms: true,
    codeDispatchSms: true,
    waitlistReleasePush: true,
    phone: "+91 98765 •••••"
  }
}

// Owner Notifications (e.g. Rajesh USR-003):
// - New Request: BK-1003 by Ananya Iyer
// - Overdue Return: BK-1004 by Rohan Desai (overdue 35 mins)
// - New Incident: INC-501 by Aarav Sharma (turf & padlock damage)
```

### 5h. Owner Requests (`GET /owner/requests`)
```js
{
  stats: {
    pending_count: 3, // Tier 1 (Ananya), Tier 2 (Aarav), Tier 3 (Rohan)
    avg_requester_reliability: 75,
    deposit_total: 2500
  },
  requests: [
    {
      id: "REQ-201",
      booking_id: "BK-1003",
      ref: "#REQ-201",
      user_id: "USR-007",
      user_name: "Ananya Iyer",
      user_initials: "AI",
      user_verified: true,
      user_tier: 1,
      user_score: 105,
      user_past_bookings: 8,
      user_incidents: 0,
      space_id: "SP-002",
      space_name: "Gulmohar Society Hall",
      slot_date: "2026-11-03T00:00:00.000+05:30",
      start_time: "10:00",
      end_time: "14:00",
      duration_hours: 4,
      purpose: "Classical Music Workshop",
      group_size: 40,
      hourly_fee: 3200,
      deposit_amount: 2500,
      total_payable: 5700,
      payment_method: "pay_at_venue",
      payment_status: "pending",
      notes: "Microphone stand and 40 chairs required"
    }
  ]
}
```

### 5i. Owner My Spaces (`GET /owner/my-spaces`)
```js
{
  ownerVerified: true, // false triggers "Pending verification" banner and disables add
  stats: {
    active_spaces_count: 3,
    total_capacity: 470,
    avg_rating: 4.88,
    utilization_pct: 82
  },
  spaces: [
    {
      id: "SP-001",
      name: "Shanti Niketan Community Ground",
      space_type: "community_ground",
      capacity: 200,
      price_per_hour: 500,
      deposit_amount: 2000,
      rating: 4.8,
      review_count: 42,
      facilities: ["parking", "floodlights", "water", "toilets"],
      slots_summary: "Morning (06:00-10:00), Evening (16:00-20:00)",
      verified: true
    },
    {
      id: "SP-002",
      name: "Gulmohar Society Hall",
      space_type: "community_hall",
      capacity: 120,
      price_per_hour: 800,
      deposit_amount: 2500,
      rating: 4.9,
      review_count: 84,
      facilities: ["kitchen", "av_system", "parking", "wifi", "ac"],
      slots_summary: "Morning (09:00-13:00), Afternoon (14:00-18:00)",
      verified: true
    },
    {
      id: "SP-003",
      name: "Vidya Mandir School Playground",
      space_type: "school_playground",
      capacity: 150,
      price_per_hour: 400,
      deposit_amount: 1500,
      rating: 4.7,
      review_count: 36,
      facilities: ["parking", "toilets", "boundary_wall"],
      slots_summary: "After hours (17:00-20:00)",
      verified: true
    }
  ]
}
```

### 5j. Owner Calendar (`GET /owner/calendar`)
```js
{
  stats: {
    scheduled_hours: 48,
    active_reservations: 4,
    conflicts_count: 1,
    turnovers_count: 3
  },
  week: {
    start: "2026-10-25T00:00:00.000Z",
    end: "2026-10-31T00:00:00.000Z",
    label: "October 25 – 31, 2026"
  },
  spaces: [
    { id: "SP-001", name: "Shanti Niketan Community Ground" },
    { id: "SP-002", name: "Gulmohar Society Hall" },
    { id: "SP-003", name: "Vidya Mandir School Playground" }
  ],
  events: [
    {
      id: "EVT-101",
      booking_ref: "#BK-1002",
      space_id: "SP-001",
      user_name: "Aarav Sharma",
      day_index: 6, // 0 = Sun, 6 = Sat
      start_time: "09:00",
      end_time: "13:00",
      status: "checked_in",
      label: "Cricket Tournament"
    }
  ],
  conflicts: [
    {
      id: "CONF-001",
      space_name: "Gulmohar Society Hall",
      date: "2026-11-01T00:00:00.000Z",
      time_window: "14:00 – 18:00",
      booking_a: { ref: "#BK-1001", user_name: "Priya Mehta", status: "approved", score: 95, tier: 1 },
      booking_b: { ref: "#WL-201", user_name: "Aarav Sharma", status: "waitlisted", score: 74, tier: 2 }
    }
  ]
}
```

### 5k. Owner Today's Operations (`GET /owner/today`)
```js
{
  checkins: [
    {
      id: "CHK-001",
      booking_id: "BK-1002",
      booking_ref: "#BK-1002",
      user_name: "Aarav Sharma",
      user_initials: "AS",
      space_name: "Shanti Niketan Community Ground",
      space_type: "community_ground",
      time: "09:00",
      pin_code: "4402",
      deposit_held: 2000,
      payment_method: "upi",
      payment_status: "paid",
      status: "checked_in"
    }
  ],
  returns: [
    {
      id: "RET-001",
      booking_id: "BK-1004", // Rohan on Rajesh's space SP-002
      booking_ref: "#BK-1004",
      user_name: "Rohan Desai",
      user_initials: "RD",
      space_name: "Gulmohar Society Hall",
      space_type: "community_hall",
      scheduled_return_time: "13:00",
      deposit_held: 2500,
      status: "overdue",
      is_late: true,
      condition_notes: "35 mins overdue. Door unlocked but renter absent."
    }
  ],
  activeAudit: {
    booking_id: "BK-1004",
    booking_ref: "#BK-1004",
    space_name: "Gulmohar Society Hall",
    space_type: "community_hall",
    deposit_held: 2500,
    baseline_checklist: [
      { label: "Cleanliness of floors & surfaces", status: "Passed (Sanitized)" },
      { label: "Furniture positioned in baseline layout", status: "120 chairs arranged" },
      { label: "Lighting & A/V working", status: "Operational" }
    ],
    return_checklist: [
      { label: "Cleanliness verified (no trash left behind)", checked: true, status: "Verified" },
      { label: "Furniture returned to baseline configuration", checked: false, status: "Check Required" },
      { label: "Lights & A/V returned undamaged", checked: true, status: "Verified" }
    ]
  }
}
```

### 5l. Owner Incidents & Deductions (`GET /owner/incidents`)
```js
{
  stats: {
    active_incidents_count: 1,
    deductions_settled_total: 3500,
    arbitration_pending_count: 1,
    score_adjustments_total: -45
  },
  activeIncident: {
    id: "INC-501",
    booking_id: "BK-1005", // Aarav on Rajesh's space SP-001
    ref: "#INC-501",
    space_name: "Shanti Niketan Community Ground",
    user_name: "Aarav Sharma",
    user_initials: "AS",
    user_tier: 2,
    user_score: 74,
    date: "2026-10-30T14:05:00.000Z",
    description: "Deep tire tracks on turf pitch and broken gate latch",
    timeline: [
      { time: "13:00", event: "Scheduled checkout deadline" },
      { time: "13:40", event: "Gate inspection by owner Rajesh Kumar" },
      { time: "13:50", event: "Damage discovered: tire ruts & damaged padlock" }
    ],
    photos: [
      { url: "/images/incidents/ground-damage-1.jpg", caption: "Turf surface rut", timestamp: "13:52 UTC" },
      { url: "/images/incidents/ground-damage-2.jpg", caption: "Broken padlock hasp", timestamp: "13:55 UTC" }
    ],
    deposit_held: 2000,
    deductions: [
      { label: "Turf Re-levelling & Grass Seed", detail: "Professional roller and fill", amount: 800 },
      { label: "Gate Padlock & Hasp Replacement", detail: "Hardware callout", amount: 400 }
    ],
    total_deductions: 1200,
    refund_amount: 800, // deposit_held (2000) - total_deductions (1200) = 800 (reconciled!)
    score_penalty: -30, // flat -30 for damage
    status: "pending"
  },
  ledger: [
    {
      ref: "#INC-499",
      date: "2026-10-24T00:00:00.000+05:30",
      space_name: "Gulmohar Society Hall",
      user_name: "Rohan Desai (#BK-1007 — closed)",
      reason: "Broken switchboard faceplate",
      deposit_amount: 2500,
      deduction_amount: 500,
      refund_amount: 2000,
      score_delta: -30,
      status: "Finalized"
    }
  ]
}
```

### 5m. Owner History / Custodial Archive (`GET /owner/history`)
```js
{
  stats: {
    total_archived: 42,
    clean_return_rate_pct: 98,
    managed_spaces_count: 3
  },
  archivedBookings: [
    {
      id: "BK-1006",
      ref: "#BK-1006",
      space_name: "Shanti Niketan Community Ground",
      user_name: "Priya Mehta",
      user_initials: "PM",
      event_label: "Weekend Cricket Match",
      slot_date: "2026-10-18T00:00:00.000Z",
      duration_hours: 4,
      gross_revenue: 2000,
      platform_fee: 160,
      net_payout: 1840,
      deposit_amount: 2000,
      deposit_status: "refunded",
      cleanliness_audit: "100% Spotless",
      score_change: 5,
      lifecycle: [/* 5-stage lifecycle objects */]
    }
  ],
  pagination: { page: 1, limit: 10, total: 42, totalPages: 5 }
}
```

### 5n. Owner Earnings (`GET /owner/earnings`)
```js
{
  stats: {
    total_revenue_net: 42800,
    avg_rating: 4.92,
    completed_bookings_count: 28,
    deposit_processed_total: 36500,
    deposit_retained_total: 1200
  },
  facilities: [
    {
      name: "Gulmohar Society Hall",
      type_label: "Community Hall",
      capacity: 120,
      revenue_net: 21400,
      share_pct: 50,
      rating: 4.90,
      sessions_count: 14
    },
    {
      name: "Shanti Niketan Community Ground",
      type_label: "Community Ground",
      capacity: 200,
      revenue_net: 14300,
      share_pct: 33,
      rating: 4.80,
      sessions_count: 9
    },
    {
      name: "Vidya Mandir School Playground",
      type_label: "School Playground",
      capacity: 150,
      revenue_net: 7100,
      share_pct: 17,
      rating: 4.70,
      sessions_count: 5
    }
  ],
  satisfaction: [
    { criterion: "Cleanliness & Handover", score: 4.95, max: 5.0 },
    { criterion: "Accuracy of Listing Details", score: 4.90, max: 5.0 },
    { criterion: "Communication & Check-in", score: 4.98, max: 5.0 }
  ],
  payoutMethod: {
    type: "bank_transfer",
    masked_details: "HDFC Bank •••• 4092"
  },
  payouts: [
    {
      id: "PAY-89211",
      date: "2026-10-24T00:00:00.000Z",
      space_name: "Gulmohar Society Hall",
      user_name: "Ananya Iyer",
      duration_hours: 4,
      gross_amount: 3200,
      platform_fee: 256, // 8%
      net_payout: 2944,
      payout_method: "bank_transfer",
      status: "settled" // settled | processing | pending
    }
  ]
}
```

### 5o. Profile & Verification (`GET /profile`)
```js
{
  user: {
    id: "USR-001",
    name: "Priya Mehta",
    email: "priya@demo.com",
    role: "user",
    score: 95,
    tier: 1,
    initials: "PM",
    joined_at: "2025-01-15T00:00:00.000Z"
  },
  verificationStatus: {
    is_verified: true,
    document_type: "Aadhaar Demo ID",
    verified_at: "2025-01-16T00:00:00.000Z"
  },
  payoutMethod: null // populated if role === 'owner'
}
```

### 5p. Admin Pages Data Shapes

#### Admin Overview (`GET /admin/overview`)
```js
{
  counts: {
    total_users: 148,
    total_owners: 12,
    pending_owners: 1,
    total_spaces: 10,
    active_bookings: 4, // Priya (1) + Aarav (1) + Rohan (1) + Ananya (1)
    completed_bookings: 142,
    open_disputes: 1,
    active_incidents: 1
  },
  recentActivity: [
    { action: "approve_booking", actor: "Rajesh Kumar", target: "Booking #BK-1001", timestamp: "2026-10-28T14:21:00.000Z" }
  ]
}
```

#### Admin Owner Verification Queue (`GET /admin/verify-owners`)
```js
{
  pendingOwners: [
    {
      id: "USR-005",
      name: "Sunita Rao",
      email: "sunita@example.com",
      phone: "+91 98765 43210",
      spaces_proposed: 2,
      applied_at: "2026-10-20T00:00:00.000Z",
      documents: ["Aadhaar Demo ID", "Property Tax Receipt"]
    }
  ]
}
```

#### Admin Users Directory (`GET /admin/users`)
```js
{
  users: [
    {
      id: "USR-001",
      name: "Priya Mehta",
      email: "priya@demo.com",
      role: "user",
      score: 95,
      tier: 1,
      active_bookings: 1,
      incidents: 0,
      status: "active", // active | suspended
      initials: "PM",
      joined_at: "2025-01-15T00:00:00.000Z"
    },
    {
      id: "USR-006",
      name: "Rohan Desai",
      email: "rohan@example.com",
      role: "user",
      score: 45,
      tier: 3,
      active_bookings: 1,
      incidents: 1,
      status: "active",
      initials: "RD",
      joined_at: "2025-03-10T00:00:00.000Z"
    }
  ],
  query: "",
  pagination: { page: 1, limit: 10, total: 8, totalPages: 1 }
}
```

#### Admin Disputes (`GET /admin/disputes`)
```js
{
  disputes: [
    {
      id: "DSP-001",
      booking_id: "BK-1004",
      user_id: "USR-006",
      user_name: "Rohan Desai",
      space_name: "Gulmohar Society Hall",
      score_impact: -10,
      reason: "Late return due to electrical lock jam, key handover delayed by on-site watchman",
      filed_at: "2026-10-30T15:00:00.000Z",
      status: "open" // open | resolved
    }
  ]
}
```

#### Admin Searchable Audit Log (`GET /admin/audit-log`)
```js
{
  entries: [
    { id: "AUD-901", timestamp: "2026-10-31T00:10:00.000Z", actor: "System", action: "flag_overdue", target: "Booking #BK-1004", reason: "Scheduled slot exceeded by 15 mins", details: "Space: Gulmohar Society Hall" },
    { id: "AUD-902", timestamp: "2026-10-30T15:00:00.000Z", actor: "Rohan Desai (User)", action: "file_dispute", target: "Dispute #DSP-001", reason: "Late return contested due to watchman delay", details: "Score impact -10" },
    { id: "AUD-903", timestamp: "2026-10-30T14:10:00.000Z", actor: "Rajesh Kumar (Owner)", action: "flag_incident", target: "Incident #INC-501", reason: "Turf surface tire ruts and broken padlock", details: "Space: Shanti Niketan Ground" },
    { id: "AUD-904", timestamp: "2026-10-28T14:21:00.000Z", actor: "Rajesh Kumar (Owner)", action: "approve_booking", target: "Booking #BK-1001", reason: "Approved music rehearsal with noise guidelines", details: "Space: Gulmohar Society Hall" },
    { id: "AUD-905", timestamp: "2026-10-28T14:20:00.000Z", actor: "Priya Mehta (User)", action: "create_booking", target: "Booking #BK-1001", reason: "Neighborhood Music Rehearsal", details: "Demo payment: UPI" },
    { id: "AUD-906", timestamp: "2026-10-25T11:00:00.000Z", actor: "Amit Verma (Admin)", action: "verify_owner", target: "User #USR-004", reason: "Property deeds verified", details: "Vikram Malhotra" },
    { id: "AUD-907", timestamp: "2026-10-22T09:30:00.000Z", actor: "Rohan Desai (User)", action: "cancel_booking", target: "Booking #BK-1008", reason: "Rescheduled sports day", details: "Space: Shanti Niketan Ground" },
    { id: "AUD-908", timestamp: "2026-10-20T16:00:00.000Z", actor: "Sunita Rao (Owner)", action: "submit_owner_verification", target: "User #USR-005", reason: "Aadhaar and tax documents uploaded", details: "Pending review" },
    { id: "AUD-909", timestamp: "2026-10-18T14:35:00.000Z", actor: "Rajesh Kumar (Owner)", action: "return_space", target: "Booking #BK-1006", reason: "Clean on-time return confirmed", details: "+5 reliability score awarded" },
    { id: "AUD-910", timestamp: "2026-10-15T10:00:00.000Z", actor: "Amit Verma (Admin)", action: "update_settings", target: "Fairness Settings", reason: "Updated cancellation penalty threshold to 2 hours", details: "System config" }
  ],
  filters: { action: null, actor: null, dateFrom: null, dateTo: null, search: "" },
  pagination: { page: 1, limit: 10, total: 10, totalPages: 1 }
}
```

#### Admin Fairness Settings (`GET /admin/settings`)
```js
{
  settings: {
    max_active_bookings: 2,
    score_start: 100,
    score_max: 120,
    score_min: 0,
    clean_return_bonus: 5,
    late_penalty: -10,
    noshow_penalty: -10,
    damage_penalty: -30,
    tier1_min: 80,
    tier2_min: 50,
    cancellation_warning_hours: 2,
    weekly_space_booking_limit_per_user: 3,
    platform_fee_pct: 8,
    tiers: [
      { level: 1, name: "Normal Access", range: "80 – 120 pts", description: "Eligible for standard owner approval flow." },
      { level: 2, name: "Owner Approval Required", range: "50 – 79 pts", description: "Requires explicit owner review." },
      { level: 3, name: "Owner Review with Advisory Warning", range: "0 – 49 pts", description: "Owner decides with a prominent advisory warning banner." }
    ],
    penalties: [
      { action: "Clean on-time return", points: 5, description: "Check-out on schedule, condition verified spotless" },
      { action: "Late return", points: -10, description: "Overstay past 15 min grace period without owner consent" },
      { action: "No-show reservation", points: -10, description: "Failure to check in without 2h advance cancellation" },
      { action: "Confirmed facility damage", points: -30, description: "Damage discovered during return inspection" }
    ]
  }
}
```

---

## 6. Demo Payment System (No Real Money)

- **Simulation Only**: No financial credentials (credit cards, UPI IDs, bank passwords) are ever stored. Only payment method enum and masked identifiers are retained.
- **Config Toggle**: `USE_MOCK=true` in environment/config controls mock data mode.
- **User Checkout Flow**:
  1. Space Detail page displays full cost breakdown:
     - Space Hourly Tariff: `price_per_hour * hours`
     - Refundable Security Deposit: `deposit_amount`
     - **Total Payable Now**: `hourly_fee + deposit_amount`
  2. Radio selector: `UPI`, `Card`, `Net banking`, `Pay at venue`.
  3. Action button: `"Pay now (demo)"`.
  4. Subtle modal/inline spinner: `"Processing demo payment..."` → flash message on redirect: `"Payment successful (demo). Saving connects with the backend."`.
  5. Other POST action stubs flash: `"Not connected yet"`.
  6. Cancellation / Rejection refund: Rejecting a request or cancelling an approved booking displays clear refund status: `"Refund issued: Full payment & deposit returned (demo)"`.
  7. Pay at venue deposit: For `pay_at_venue`, the deposit is collected directly by the owner at physical check-in and recorded in the check-in condition report.
- **Receipt Security & Ownership Check**:
  - `GET /bookings/:id/receipt`: Server verifies `booking.user_id === currentUser.id || currentUser.id === space.owner_id || currentUser.role === 'admin'`. Non-owners receive a custom 403 Forbidden page.
- **Owner Side**:
  - `payment_status` badge displayed on all Requests cards (`paid` or `pending`).
  - For `pay_at_venue` reservations, owner has `"Mark payment received"` button (`POST /owner/bookings/:id/mark-paid`).
  - Deposit held displayed on Today's Operations card.
  - Owner payout setting on Earnings & Profile: UPI or Bank Transfer (e.g. `Demo Bank •••• 4092`).
  - Owner earnings payout ledger records `payout_method` and `status`.

---

## 7. Pass-Through Session & Auth Middleware

```js
// In middleware/auth.js:
// During frontend demo mode, if session is empty, auto-set to Priya Mehta (User)
// so all routes are immediately browseable and testable.
module.exports = {
  attachUser: (req, res, next) => {
    if (!req.session.user) {
      req.session.user = mockData.users[0]; // Priya Mehta
    }
    res.locals.currentUser = req.session.user;
    next();
  },
  isAuthenticated: (req, res, next) => next(),
  requireRole: (...roles) => (req, res, next) => next()
};
```
Fast role switching is provided via:
- `GET /demo/user` → sets Priya Mehta (`USR-001`), redirects to `/search`
- `GET /demo/owner` → sets Rajesh Kumar (`USR-003`), redirects to `/owner/requests`
- `GET /demo/admin` → sets Amit Verma (`USR-099`), redirects to `/admin/overview`

---

## 8. ConditionForm Checklists & Return Workflow

### 8a. Checklists per Space Type
- **`community_hall` and `small_room`**:
  - Cleanliness of floors and surfaces
  - Furniture and seating positioned in baseline layout
  - Lighting, switchboards, and ventilation working
- **`community_ground` and `school_playground`**:
  - Outfield litter and trash completely cleared
  - Goal posts, nets, and boundaries intact
  - Ground surface and turf undamaged
  - Main entry gates and security padlock locked
- **`storeroom`**:
  - Stored items properly organized
  - Shelving racks and storage bins intact
  - Secure door latch and padlock verified

*Outdoor space badge:*
`"Weather dependent — free reschedule available"` (rendered for `community_ground`, `school_playground`, or `indoor_outdoor === 'outdoor'`).

### 8b. Return & Score Adjustments
- Check-in and return require **condition notes** and a checklist, **not** a mandatory reason dialog (reason dialog is reserved for approve/reject/waitlist/deductions/disputes/suspension).
- On return:
  - If returned on time and checklist verified clean: `scoreService.adjust(+5)` is credited.
  - If overdue/late: The `-10` penalty is presented to the owner for manual confirmation with condition notes before applying (score remains advisory; owner explicitly confirms or waives).

---

## 9. Design System, Tokens, Accessibility & Status Badges

### 9a. Fidelity Modern Design Tokens
- Single font: **`Inter`** across all headings, titles, labels, and copy.
- **Color Palette & Utility Classes**:
  - Primary: `bg-primary` (`#333434`), `hover:bg-primary-hover` (`#1e1f1f`)
  - Primary Container: `bg-primary-container` (`#4a4a4a`)
  - Secondary: `bg-secondary` (`#5d5e5f`)
  - Ink (Primary Text): `text-ink` (`#071d2e`)
  - Ink Secondary: `text-ink-secondary` (`#444748`)
  - Ink Muted: `text-ink-muted` (`#52585c` — contrast 5.2:1 passing WCAG AA)
  - Line (Border): `border-line` (`#c4c7c7`), `border-line-subtle` (`#e8ecf2`)
  - Surface Background: `bg-surface` (`#f7f9ff`)
  - Surface Card (White): `bg-surface-card` (`#ffffff`)
  - Surface Tint: `bg-surface-tint` (`#edf4ff`)
  - Surface Container: `bg-surface-container` (`#e3efff`)
  - Inverse Surface (Dark Navy): `bg-inverse` (`#1e3244`), `text-inverse-ink` (`#e8f2ff`)
- **Button Variants**:
  - **Primary**: Filled charcoal `bg-primary text-white hover:bg-primary-hover` (used for "View Details & Book", "Upload Closing Photos", "Approve Permit")
  - **Secondary**: Light blue tint `bg-surface-container text-ink hover:bg-surface-high`
  - **Inverted**: Dark navy `bg-inverse text-white hover:bg-[#152330]`
  - **Outlined**: Transparent `border border-line text-ink-secondary hover:bg-surface-tint`
  - **Destructive**: `bg-error text-white hover:bg-[#961515]` (**strictly** for destructive actions: delete, flag incident)
  - **Ghost**: Transparent `text-ink-secondary hover:text-ink hover:underline`
- **Border Radii**:
  - Small: `rounded-sm` (4px)
  - Inputs & Standard Buttons: `rounded-md` (8–12px)
  - Main Cards: `rounded-lg` (16px)
  - Hero & Image sections: `rounded-xl` (24px)
  - Badges & Avatars: `rounded-full` (9999px)

### 9b. Status Badge Palette (Using Token Classes)
- `approved`: `text-status-success bg-status-success-tint`
- `checked_in`: `text-status-success bg-status-success-tint`
- `returned` / `closed`: `text-ink-secondary bg-surface-container`
- `waitlisted`: `text-status-info bg-status-info-tint`
- `requested`: `text-status-info bg-status-info-tint`
- `overdue`: `text-status-warning bg-status-warning-tint`
- `damaged` / `rejected`: `text-status-danger bg-status-danger-tint`
- **`cancelled`**: **`text-ink-muted bg-[#e8ecf2]`** *(Neutral grey, never red)*

### 9c. Accessibility, Focus States & Skip Link
- Skip link:
  ```html
  <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-md focus:ring-2 focus:ring-[#edf4ff]">
    Skip to main content
  </a>
  ```
- Focus states:
  - On light surfaces: `focus:outline-none focus:ring-2 focus:ring-[#333434] focus:ring-offset-2`
  - On dark surfaces: `focus:outline-none focus:ring-2 focus:ring-[#edf4ff] focus:ring-offset-2`
- Custom error pages: `403.ejs`, `404.ejs`, `500.ejs`.

### 9d. Image Assets, Alt Text & Credits
- Images named using space-style conventions: `community-hall-1.jpg`, `community-ground-1.jpg`, `school-playground-1.jpg`, `small-room-1.jpg`, `storeroom-1.jpg`.
- Meaningful `alt` text populated from photo captions.
- Credits list documented in `README.md` and page footers.

---

## 10. Reusable Partials Inventory & Props

| Partial File | Props Expected | Purpose / Used In |
|---|---|---|
| `partials/navbar.ejs` | `currentUser`, `unreadNotificationsCount` | Global header, search, user dropdown |
| `partials/sidebar-user.ejs` | `currentUser`, `activeRoute` | User navigation sidebar |
| `partials/sidebar-owner.ejs` | `currentUser`, `activeRoute`, `ownerVerified` | Owner navigation sidebar + verification banner |
| `partials/sidebar-admin.ejs` | `currentUser`, `activeRoute` | Admin navigation sidebar |
| `partials/SpaceCard.ejs` | `space` | Space card in search grid & owner listings |
| `partials/StatusBadge.ejs` | `status`, `size` | Color-coded status badge with token classes |
| `partials/ScoreBadge.ejs` | `score`, `tier`, `maxScore` | Pill badge with score and tier label |
| `partials/VerifiedBadge.ejs` | `verified`, `label` | Community verified trust badge |
| `partials/ReasonDialog.ejs` | `dialogId`, `actionTitle`, `postUrl`, `actionLabel`, `isDestructive` | Modal enforcing mandatory reason |
| `partials/ConditionForm.ejs` | `spaceType`, `mode` (`checkin`\|`return`), `checklist`, `notes` | Checklist for space inspections |
| `partials/Timeline.ejs` | `stages` | 5-stage lifecycle visual progress tracker |
| `partials/BookingCard.ejs` | `booking`, `isOwnerView` | Booking card with PIN countdown and actions |
| `partials/NotificationCard.ejs` | `notification` | Interactive notification with CTAs |
| `partials/Toast.ejs` | `messages` | Floating notification alerts |
| `partials/EmptyState.ejs` | `icon`, `title`, `description`, `ctaText`, `ctaHref` | Friendly zero-data state |
| `partials/Skeleton.ejs` | `type` (`card`\|`table`\|`list`), `count` | Shimmer loading skeleton |
| `partials/Tabs.ejs` | `tabs` (`label`, `id`, `count`, `active`), `baseUrl` | Navigation tab selector |
| `partials/Table.ejs` | `columns`, `rows` | Responsive data table |
| `partials/Pagination.ejs` | `pagination`, `baseUrl` | Page navigation controls |
| `partials/StatCard.ejs` | `label`, `value`, `icon`, `subtext` | KPI metric summary card |

---

## 11. Backend Handoff Checklist

### 11a. Database Tables / Collections
- [ ] `users` — id, name, email, password_hash, role (`user`\|`owner`\|`admin`), score, tier, status (`active`\|`pending`\|`suspended`), initials, payout_method, joined_at
- [ ] `spaces` — id, owner_id, name, description, address, area, space_type, indoor_outdoor, capacity, price_per_hour, deposit_amount, min_duration_hours, facilities, allowed_purposes, rules, photos, verified, rating, hygiene_score, created_at
- [ ] `availability_slots` — id, space_id, day_of_week, start_time, end_time, is_active
- [ ] `bookings` — id, ref, user_id, space_id, slot_date, start_time, end_time, duration_hours, purpose, group_size, status, deposit_amount, gross_amount, platform_fee, net_payout, payment_method, payment_status, paid_at, decision_reason, pin_code, created_at
- [ ] `condition_reports` — id, booking_id, space_id, inspector_id, type (`check_in`\|`return`), checklist_results, photos, condition_notes, timestamp
- [ ] `incidents` — id, booking_id, space_id, user_id, description, timeline, photos, deposit_held, total_deductions, refund_amount, score_impact, status (`pending`\|`confirmed`\|`waived`)
- [ ] `score_events` — id, user_id, booking_id, points, reason, balance_after, created_at
- [ ] `ratings` — id, space_id, booking_id, user_id, rating, review_text, created_at
- [ ] `waitlist` — id, space_id, slot_id, user_id, position (sequential FIFO), created_at
- [ ] `notifications` — id, user_id, type, title, message, is_read, actions, created_at
- [ ] `disputes` — id, user_id, score_event_id, booking_id, reason, status (`open`\|`resolved`), resolution_notes, resolved_at
- [ ] `audit_log` — id, timestamp, actor_id, actor_role, action, target_type, target_id, reason, details *(strictly append-only)*
- [ ] `settings` — single-row platform configuration (score multipliers, booking limits, cancellation windows, fee percentages)

### 11b. Core Backend Tasks & Business Logic to Implement
- [ ] **Replace auth pass-through** with real session verification and role-check middleware blocking unauthorized URLs before final submission.
- [ ] **Advisory Reliability Score**: Score is strictly advisory. Humans make every approval and penalty decision. **Do NOT auto-approve any tier.**
- [ ] **Sequential FIFO Waitlist**: Waitlist queue position is strictly determined by request submission timestamp.
- [ ] **Active Booking Limits**: Enforce maximum 2 active bookings per user on `bookingService.create()`.
- [ ] **Weekly Space Booking Limit**: Enforce `weekly_space_booking_limit_per_user` (max 3 bookings per week on the same space).
- [ ] **Purpose Validation**: Verify that the booking's `purpose` is included in `space.allowed_purposes`.
- [ ] **Overlap Protection**: Block overlapping approved bookings on the same space and time window.
- [ ] **Mandatory Reasons & Notes**: Enforce mandatory textual reasons on approve, reject, waitlist, cancel, dispute resolution, deduction confirmation, and suspension.
- [ ] **Strict Append-Only Audit Log**: Every action records an immutable audit log entry.
- [ ] **Ownership Verification**: Enforce that owners can only edit their own spaces, approve their own requests, inspect their own facilities, and view receipts.
- [ ] **Overdue & Reminder Scheduler**: Implement cron/background job to flag overdue returns and dispatch reminder notifications.
- [ ] **Seed & Reset Script**: Create `npm run seed` and `npm run reset` commands for fresh environments.
- [ ] **Photo Upload Storage**: Configure multipart storage (e.g. Multer / S3 / Cloudinary) for condition inspection and incident photos.
- [ ] **Password Hashing & Validation**: Implement bcrypt password hashing and Joi/Zod request validation.

---

## 12. Step-by-Step Implementation Sequence

1. **Phase 1: Setup, Stubs & Mock Data Engine**
   - Initialize `package.json`, install dependencies (`express`, `ejs`, `express-session`, `connect-flash`, `tailwindcss`).
   - Create `tailwind.config.js` with Fidelity Modern tokens, Inter font, custom focus rings.
   - Create `/database/README.md`.
   - Create all 8 stub files in `/services/` and `middleware/auth.js` with `// BACKEND TODO:` signatures.
   - Create `/data/mock.js` with relative date generator, 10 canonical spaces, canonical users, bookings, seed waitlist, seed dispute, 10 audit entries, notifications.
2. **Phase 2: Master Layout, Partials & Error Pages**
   - Base layout with skip link, responsive drawer, top navbar, role sidebars.
   - All partials: `SpaceCard`, `StatusBadge`, `ScoreBadge`, `VerifiedBadge`, `ReasonDialog`, `ConditionForm`, `Timeline`, `BookingCard`, `NotificationCard`, `Toast`, `EmptyState`, `Skeleton`, `Tabs`, `Table`, `Pagination`, `StatCard`.
   - Error pages: 403, 404, 500.
3. **Phase 3: Auth & Public / User Journey**
   - Login with Try Demo panel, Signup, Profile & Verification (demo ID proof).
   - Search page with multi-filters and space grid.
   - Space detail with photo gallery, slot picker, eligibility validation, demo payment fee breakdown and checkout.
   - Demo payment receipt view (`/bookings/:id/receipt`).
4. **Phase 4: User Dashboard Pages**
   - My Bookings with tabs, badges, cancel warning, extension trigger.
   - My Score with gauge, tiers, penalty list, dispute modal.
   - User History with 5-stage lifecycle.
   - Notifications center with alert channels panel.
5. **Phase 5: Owner Management Suite**
   - Requests with requester cards, ScoreBadge, payment status, ReasonDialog.
   - My Spaces with listing cards, Add/Edit space forms, pending verification banner.
   - Calendar with week grid, conflict matrix, suggestion cards.
   - Today's Operations with check-ins, overdue returns, condition form side-by-side, "Mark payment received".
   - Incidents & Deductions with itemized breakdown, confirm/waive actions.
   - Custodial History & Owner Earnings with payout method modal and ledger.
6. **Phase 6: Admin Governance Suite**
   - Admin Overview, Owner Verification queue, Users management, Disputes resolution, Searchable Audit Log, Fairness Settings.
7. **Phase 7: Verification, Accessibility & Readme**
   - Verify every route, ensure flash toasts appear on actions, verify relative dates.
   - Run accessibility checks (test keyboard navigation, focus states, responsive layout at 375px width).
   - Write comprehensive `README.md` with demo credentials, role tours, image credits, and backend handoff instructions.
