# BORO — Front-End Audit & Pending Items (`remaining.md`)

This document details all remaining front-end gaps, incomplete workflows, edge-case bugs, and backend dependencies audited against `plan.md` Sections 2, 3, 10, and 12, as well as the login/auth flow, BORO naming guidelines, and deployment specifications.

---

## 1. Itemized Gaps by Priority

### Priority 1 (P1) — Breaks Judge Demo / Core Workflow

1. **Owner Action Route Prefix Doubling (`/owner/owner/...` 404)**
   - **Path**: `routes/owner.js` (lines 219, 226, 233, 240, 247, 254, 261, 284, 291)
   - **Description**: Route handlers are defined with the `/owner/` prefix (e.g. `router.post('/owner/checkin/:id')`) while the router is mounted at `/owner` in `app.js`. Forms in `views/pages/owner/today.ejs` and `incidents.ejs` submit to `/owner/checkin/:id` and `/owner/incidents/:id/confirm`, resulting in 404 Not Found errors during interactive owner workflows.
   - **Priority**: **P1**

2. **In-Memory State Mutation on Form POSTs**
   - **Path**: `routes/owner.js` & `routes/user.js`
   - **Description**: Action endpoints currently flash `"Not connected yet"` and redirect back without mutating in-memory arrays in `data/mock.js`. For a live judge demonstration, approving a request, checking in a booking, or waiving an incident does not visually change the card status on subsequent page reload.
   - **Priority**: **P1**

3. **Owner Payout Method Configuration In-Memory Sync**
   - **Path**: `routes/owner.js` (`POST /payout-method`) & `views/pages/owner/earnings.ejs`
   - **Description**: Submitting new bank or UPI payout details flashes a confirmation but does not update `mockUsers[x].payoutMethod`, leaving the masked account display unchanged.
   - **Priority**: **P1**

---

### Priority 2 (P2) — Should Fix Before Final Submission

4. **CSRF Protection Middleware Is Stubbed**
   - **Path**: `middleware/auth.js` & `app.js`
   - **Description**: Forms render hidden inputs `<input type="hidden" name="_csrf" value="...">`, but `res.locals.csrfToken` is a static placeholder string and no server validation is enforced on incoming POST bodies.
   - **Priority**: **P2**

5. **Rate Limiting on Authentication Endpoints**
   - **Path**: `routes/auth.js` (`POST /login`, `POST /signup`)
   - **Description**: Login and signup endpoints have placeholder comments but lack `express-rate-limit` middleware to prevent brute-force credential stuffing.
   - **Priority**: **P2**

6. **File Upload Handling (Multipart/Form-Data)**
   - **Path**: `routes/auth.js` & `views/pages/auth/signup.ejs`
   - **Description**: The owner "demo ID proof" file input and condition report photo inputs are standard HTML `<input type="file">` without `multer` server-side handling to write uploaded assets to `/public/uploads/`.
   - **Priority**: **P2**

7. **Missing Production Build & Environment Configuration**
   - **Path**: `package.json` & `.env.example`
   - **Description**: `package.json` lacks a standard `build` script (e.g. for CSS minification/bundling). No `.env.example` is provided to document required variables (`PORT`, `SESSION_SECRET`, `USE_MOCK`, `DATABASE_URL`).
   - **Priority**: **P2**

8. **Admin Settings Form Defaults Not Bound to Mock Data**
   - **Path**: `views/pages/admin/settings.ejs`
   - **Description**: Form input fields contain hardcoded numeric values rather than reading dynamically from `mockData.settings` (`settings.max_active_bookings_per_user`, etc.).
   - **Priority**: **P2**

9. **Missing Static Asset Photography on Disk**
   - **Path**: `public/images/spaces/`
   - **Description**: Image paths fall back to `/images/spaces/community-hall-1.jpg`, but the `/public/images/spaces/` folder is empty, requiring either mock SVG illustrations or real royalty-free images to avoid broken image icons.
   - **Priority**: **P2**

---

### Priority 3 (P3) — Nice to Have / Polish

10. **Footer Secondary Links Anchor to `#`**
    - **Path**: `views/layouts/main.ejs` & `views/partials/sidebar-user.ejs`
    - **Description**: Links to Terms, Guidelines, Privacy, and Help Center use placeholder hash targets (`#`).
    - **Priority**: **P3**

11. **Mobile Viewport 375px Horizontal Scroll on Audit Table**
    - **Path**: `views/partials/Table.ejs` & `views/pages/admin/audit-log.ejs`
    - **Description**: Wide multi-column data tables in the admin audit log require touch swipe scrolling on 375px mobile screens; could benefit from mobile card stacking.
    - **Priority**: **P3**

12. **Contrast Ratio on Tier 2 Status Badge**
    - **Path**: `views/partials/ScoreBadge.ejs`
    - **Description**: The amber Tier 2 badge (`bg-status-warning/15 text-status-warning`) has acceptable contrast on standard displays, but in harsh ambient light could be darker (`text-amber-800`).
    - **Priority**: **P3**

13. **PIN Code 1-Click Clipboard Copy**
    - **Path**: `views/pages/user/my-bookings.ejs` & `views/pages/user/receipt.ejs`
    - **Description**: The 4-digit access PIN is displayed in plaintext font-mono, but lacks an accessible 1-click "Copy PIN" button with visual feedback.
    - **Priority**: **P3**

14. **Search Filter Query Parameter Retention**
    - **Path**: `views/pages/user/search.ejs`
    - **Description**: Changing the dropdown filter for space type submits a form that drops the text keyword `q` parameter unless combined via JavaScript before submit.
    - **Priority**: **P3**

---

## 2. Categorized Audit Sections

### MISSING
- Actual database connection pool and migration scripts (`database/` has only README.md).
- Real persistent session store (Redis / DB).
- Endpoint `/owner/checkin/:id` (currently shadowed by `/owner/owner/checkin/:id`).
- Real physical image files in `/public/images/spaces/`.

### PARTIAL
- Route handlers in `routes/owner.js` using doubled `/owner/` path definitions.
- POST handlers in `routes/user.js` and `routes/owner.js` that flash feedback without in-memory array state mutation.
- File upload fields lacking `multipart/form-data` multer ingestion.

### DATA BUGS & PLAN.MD CONTRADICTIONS
- *Resolved*: Priya Mehta now strictly has 1 active booking (`BK-1001`), conforming to the demo rule.
- *Resolved*: Ananya Iyer now strictly has 1 active booking (`BK-1003`), displaying `1/2` on Owner Requests.
- *Resolved*: BK-1003 total payable reconciles to ₹5,700 (hourly fee ₹3,200 + deposit ₹2,500).
- *Resolved*: Sidebar badge and header count both dynamically compute to 4 pending requests.
- *Resolved*: Raw enums (`pay_at_venue`) are converted via `helpers.formatPaymentMethod(...)`.
- *Note on plan.md*: `plan.md` originally specified Fraunces headings, terracotta/teal colors, and auto-approval IoT wording. The codebase correctly uses the updated Fidelity Modern palette (#333434 charcoal, #edf4ff blue-tint cards), Inter font, and human-only custodian decision policies.

### LEFTOVERS
- Static mockup folder `stitch_hall_booking_user_dashboard/` contains legacy strings (`Escrow`, `IoT`, `CivicWallet`). All active application templates in `views/` have zero occurrences.
- Zero occurrences of "SpaceShare", "Google Pay", "PhonePe", "Paytm", "HDFC", "Fraunces", or "Instant approval" remain in active application code.

### UI / UX
- All 38 application views render without template crashes.
- Form accessibility: Labels, focus rings, `autocomplete` attributes, and `aria-describedby` error bindings are active on `/login` and `/signup`.
- Toast notifications automatically auto-dismiss after 5 seconds via `public/js/app.js`.

### DEPLOYMENT
- `PORT` defaults to `process.env.PORT || 3000`.
- Server runs smoothly under Node.js with zero npm external runtime dependencies beyond `express`.
- Automated test scripts `scripts/testRoutes.js` (38/38 routes pass) and `scripts/testAuth.js` (8/8 auth checks pass) are fully operational.

### BACKEND DEPENDENCIES
- PostgreSQL table creation and initial seeding (`npm run seed`).
- Implementation of all 8 service files in `services/`.
- Integration of `bcryptjs` password hashing and `express-session` with Redis.
- Wiring real CSRF token verification middleware.

---

## 3. Demo Journey Verification Checklist

| Persona & Step | Description | Current Status | Notes |
|---|---|---|---|
| **User (Priya)** | Browse spaces (`GET /search`) | **WORKS** | Full filtering by type, price, and capacity |
| **User (Priya)** | View space details (`GET /spaces/SP-002`) | **WORKS** | Pricing breakdown, condition photos, advisory tier |
| **User (Priya)** | Submit booking with demo payment (`POST /bookings`)| **WORKS** | Flashes demo success; redirects to My Bookings |
| **User (Priya)** | View My Bookings (`GET /my-bookings`) | **WORKS** | Tabs for upcoming, waitlisted, and past bookings |
| **User (Priya)** | View digital receipt (`GET /bookings/:id/receipt`) | **WORKS** | Complete fee & deposit reconciliation |
| **User (Priya)** | Inspect Reliability Score (`GET /my-score`) | **WORKS** | 95/120 score with detailed delta audit log |
| **User (Priya)** | View notifications (`GET /notifications`) | **WORKS** | Notification cards with unread filter |
| **Owner (Rajesh)**| Review incoming requests (`GET /owner/requests`) | **WORKS** | Advisory tiers, ₹5,700 total, 1/2 active bookings |
| **Owner (Rajesh)**| View listed spaces (`GET /owner/my-spaces`) | **WORKS** | Active status badges, space capacity specs |
| **Owner (Rajesh)**| View calendar (`GET /owner/calendar`) | **WORKS** | Weekly matrix with occupancy blocks |
| **Owner (Rajesh)**| View today's operations (`GET /owner/today`) | **WORKS** | Ingress check-ins, egress returns, overdue alert |
| **Owner (Rajesh)**| View damage incidents (`GET /owner/incidents`) | **WORKS** | Damage deduction ledger, deposit refund math |
| **Owner (Rajesh)**| View earnings ledger (`GET /owner/earnings`) | **WORKS** | Net payouts, platform fee breakdown, payout setup |
| **Admin (Amit)** | View governance overview (`GET /admin/overview`) | **WORKS** | Platform stats, volume metrics, incident counts |
| **Admin (Amit)** | Review owner verifications (`GET /admin/verify-owners`)| **WORKS** | Pending documents, approve/reject dialogs |
| **Admin (Amit)** | Manage users (`GET /admin/users`) | **WORKS** | User directory, score inspection, suspension |
| **Admin (Amit)** | Resolve disputes (`GET /admin/disputes`) | **WORKS** | Arbitration queue with applicant justifications |
| **Admin (Amit)** | Inspect audit log (`GET /admin/audit-log`) | **WORKS** | Tamper-evident operational change history |
| **Admin (Amit)** | Configure settings (`GET /admin/settings`) | **WORKS** | Platform fees, grace periods, penalty points |

