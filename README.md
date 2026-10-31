# BORO — Community Space Sharing Platform (Frontend)

BORO is an equitable, transparent community space sharing platform that makes underused local spaces—including community halls, community grounds, school playgrounds, small activity rooms, and storerooms—fairly discoverable, bookable, and accountable.

> **Project Scope:** Front-end implementation using Node.js, Express, EJS with layout/partials, and Fidelity Modern Tailwind design tokens. The backend database layer is stubbed with clean function signatures in `/services/` and `database/README.md` for seamless teammate handoff.

---

## ⚡ Quickstart

### 1. Install Dependencies & Start Server
```bash
npm install
npm start
```
The application will launch on `http://localhost:3000`.

### 2. Verify Data Consistency & Calculations
Run the deterministic data validator to verify reliability scores, active-booking limits, and deposit math:
```bash
npm run check-data
```

### 3. Run Automated Route & Template Tests
Verify that all 38 GET endpoints render with zero runtime or template errors:
```bash
node scripts/testRoutes.js
```

---

## 🔑 Demo Accounts & One-Click Role Switcher

You can switch between platform personas using the **"Demo as:"** selector in the top navigation bar, via `/login`, or by visiting the direct switcher routes:

| Role | Name | Email | Password | Quick Switch URL | Profile Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Resident** | Priya Mehta | `priya@demo.com` | `demo1234` | [`/demo/user`](http://localhost:3000/demo/user) | Active Resident &bull; Score 95 (Tier 1) &bull; 1 active booking (`BK-1001`) |
| **Space Owner** | Rajesh Kumar | `rajesh@demo.com` | `demo1234` | [`/demo/owner`](http://localhost:3000/demo/owner) | Verified Space Partner &bull; Caretaker of Shanti Niketan Ground &amp; Hall |
| **Platform Admin** | Amit Sharma | `admin@demo.com` | `demo1234` | [`/demo/admin`](http://localhost:3000/demo/admin) | Municipal Administrator &bull; Governance, dispute mediation &amp; audit |

---

## 🌟 Guided Role Walkthroughs

### 1. Resident Experience (`/demo/user`)
- **Discover Spaces (`/search`)**: Filter by space type (community hall, community ground, school playground, small room, storeroom), environment (indoor / outdoor weather-protected), capacity, rate, and permitted usage purposes.
- **Space Detail & Demo Payment (`/spaces/:id`)**: Inspect specs, facilities, rules, and condition reports. Select date and slot with real-time fee and security deposit calculation. Test demo payment checkout (UPI, Card, Net Banking, Pay at Venue).
- **My Bookings (`/my-bookings`)**: Active reservations list. Access PIN code is securely locked until 1 hour prior to the session start.
- **My Score & Reliability (`/my-score`)**: Interactive score gauge (0–120 range). Review score adjustments (+5 on-time clean return, -10 late, -30 damage) and submit mediated disputes via the universal `ReasonDialog`.
- **Custodial History & Receipt (`/history`, `/bookings/:id/receipt`)**: 5-stage custodial lifecycle audit trail with deposit refund reconciliation.

### 2. Space Owner Experience (`/demo/owner`)
- **Incoming Requests (`/owner/requests`)**: Review applicant reliability scores. Tier 3 applicants display a prominent warning banner. Approve, reject, or waitlist requests using the mandatory `ReasonDialog`.
- **My Spaces & Add Space (`/owner/my-spaces`, `/owner/spaces/add`)**: Manage listings with type-specific attributes, facilities, and house rules.
- **Calendar & Overlap Conflicts (`/owner/calendar`)**: Weekly slot matrix highlighting overlapping conflict requests (`BK-1009` vs `BK-1011`) with side-by-side resolution controls.
- **Today's Operations (`/owner/today`)**: Execute check-ins and returns with `ConditionForm` checklists. Confirm late penalties for overdue returns (`BK-1004` is 35 mins overdue).
- **Incidents & Deposit Deductions (`/owner/incidents`)**: Reconcile damage assessments (`INC-501` on Shanti Niketan Ground: ₹2,000 held = ₹1,200 deductions + ₹800 resident refund).
- **Earnings & Payouts (`/owner/earnings`)**: Revenue KPIs, payout ledger, and payout destination settings.

### 3. Platform Admin Experience (`/demo/admin`)
- **Governance Overview (`/admin/overview`)**: Live counters dynamically computed from data arrays.
- **Owner Verification Queue (`/admin/verify-owners`)**: Review pending owner credentials and property documents (`USR-005` Sunita Rao).
- **User Directory (`/admin/users`)**: Search resident accounts, monitor active booking caps (max 2), and toggle administrative suspensions with logged reasons.
- **Disputes Mediation (`/admin/disputes`)**: Review contested score penalties (`DSP-001` Rohan Desai) and issue binding mediation rulings.
- **Audit Log (`/admin/audit-log`)**: Searchable, append-only immutable ledger tracking every system action.
- **Fairness Parameters (`/admin/settings`)**: Configure platform scoring multipliers, booking limits, and deposit rules.

---

## 🏛️ Comprehensive Feature & Workflow Walkthrough

The following sections detail the end-to-end user journeys, custodial inspection workflows, and civic trust mechanisms implemented in BORO (referenced from our technical evaluation document and system report).

---

### Part 1: Resident Discovery & Booking Journey

#### 1. Search & Space Discovery (`/search`)
Multi-parameter search engine enabling community members to discover underutilized local facilities. Residents can filter spaces by category (Community Halls, Community Grounds, School Playgrounds, Small Activity Rooms, and Storerooms), indoor vs. outdoor weather-protected environments, capacity thresholds, hourly rate, and permitted community activities. Each space card surfaces verified caretaker badges, hourly fees, and refundable deposit requirements upfront.

---

#### 2. Space Detail & Slot Reservation (`/spaces/:id`)
Comprehensive facility specification view presenting spatial attributes, capacity, equipment, amenities, parking availability, house rules, and recent custodial cleanliness logs. Includes an interactive date and slot picker with automated fee calculation (base rate + refundable deposit) and demo checkout options (UPI, Credit/Debit Card, Net Banking, and Pay at Venue).

---

#### 3. Resident Active Bookings & Access PIN (`/my-bookings`)
The resident's active booking control center displaying upcoming reservations, waitlist positions, and current approval statuses. For security and fraud prevention, the venue access PIN code remains masked (`••••`) until exactly 1 hour prior to the reserved time slot, ensuring keys or digital lock codes are only released when the session is imminent.

---

#### 4. Notification Center & Operational Alerts (`/notifications`)
Contextual real-time alerts keeping residents and caretakers informed throughout the booking lifecycle. Notifications trigger upon booking approvals, payment confirmations, 1-hour pre-session PIN unlocking, return reminders, and security deposit refund releases.

---

### Part 2: The Trust Layer & Custodial Stewardship

#### 5. Advisory Reliability Score & Tier Meter (`/my-score`)
BORO's flagship accountability mechanism: a transparent 0–120 point reliability gauge that tracks civic stewardship. Residents earn points (+5) for on-time, spotless returns, while penalties apply for late handovers (-10) or confirmed damage (-30). The score determines community tier status (Tier 1: Preferred, Tier 2: Standard, Tier 3: Caution), with Tier 3 users triggering prominent advisory warnings during caretaker review. Includes a formal dispute appeal modal (`ReasonDialog`) to contest unfair penalties.

---

#### 6. Five-Stage Custodial Lifecycle & Booking Timelines (`/history`)
A complete visual audit trail tracking each reservation through five immutable operational stages: **Requested &rarr; Approved &rarr; Checked-In &rarr; Returned &rarr; Settled**. Residents can review past usage, inspect condition inspection ratings, and download or print itemized tax receipts (`/bookings/:id/receipt`) detailing room fees, cleaning charges, and settled security deposits.

---

### Part 3: Space Caretaker & Owner Management Operations

#### 7. Caretaker Booking Requests & Trust Verification (`/owner/requests`)
The triage center for space owners and caretakers. Incoming reservation requests display applicant names, requested purpose, headcount, and applicant reliability scores. Caretakers can evaluate community fit and approve, reject, or waitlist requests with mandatory logged justification reasons.

---

#### 8. Caretaker Listed Spaces Portfolio (`/owner/my-spaces`)
Comprehensive management hub for all properties listed by a facility caretaker or society trust. Caretakers can monitor verification status, view active bookings, toggle listing availability, and add new spaces with custom facility tags, allowed usage purposes, and property photos.

---

#### 9. Weekly Schedule Calendar & Overlap Conflict Matrix (`/owner/calendar`)
Interactive scheduling matrix showing time slots and occupancy across all managed spaces. Highlights concurrent or conflicting requests (e.g., competing slots between community groups) with side-by-side evaluation tools to make equitable allocation decisions.

---

#### 10. Today's Operations: Handover, Check-In & Return Inspections (`/owner/today`)
Daily operational hub for on-site facility caretakers. Enables caretakers to execute two-point condition verifications:
1. **Pre-session check-in** to establish baseline cleanliness and verify resident identity.
2. **Post-session checkout** with a standardized custodial checklist (cleanliness, furniture condition, lights/appliances, doors).
Automatically flags overdue sessions (e.g., 35+ minutes late) with one-click late penalty logging.

---

#### 11. Incidents, Itemized Deductions & Deposit Reconciliation (`/owner/incidents`)
Transparent incident reporting and deposit settlement workspace. In cases of property damage or excessive cleaning requirements, caretakers upload photographic proof, itemize repair deductions, and issue partial deposit refunds while remitting the balance back to the resident's account.

---

#### 12. Caretaker Financial Ledger & Payout Metrics (`/owner/earnings`)
Financial analytics interface displaying cumulative booking revenue, held security deposits, completed payouts, and scheduled bank transfers. Provides a clear audit log of all financial transactions to support society accounting and municipal reporting.

---

#### 13. Historical Custodial Archives & Inspection Log (`/custodial-history`)
A permanent chronological archive of all historical space handovers, pre/post inspection notes, cleanliness ratings, and custodial accountability records across all civic facilities.

---

## 🛠️ Backend Teammate Handoff Architecture

1. **Service Layer Stubs (`/services/*.js`)**:
   - `userService.js`, `spaceService.js`, `bookingService.js`, `scoreService.js`, `notificationService.js`, `auditService.js`, `incidentService.js`, `settingsService.js`
   - Every file contains function signatures and `// BACKEND TODO:` comments with return shapes.
2. **Database Schema & Migrations (`/database/README.md`)**:
   - Comprehensive checklist and schema blueprint for tables: `users`, `spaces`, `bookings`, `waitlist`, `condition_reports`, `incidents`, `disputes`, `score_events`, `audit_log`, `settings`.
3. **Form & Action Routes**:
   - Every mutation route is defined with `// BACKEND TODO:` comments and flashes `"Payment successful (demo). Saving connects with the backend."` for `/bookings` or `"Not connected yet"` for all others before redirecting.

---

## 📸 Image Credits

- Placeholder community spaces imagery licensed under Creative Commons / Civic Community Registry:
  - `community-hall-1.jpg` &mdash; Civic Community Center Archive
  - `community-ground-1.jpg` &mdash; Public Recreation Reserve
  - `school-playground-1.jpg` &mdash; Municipal Education Trust
  - `small-room-1.jpg` &mdash; Neighborhood Study Annex
  - `storeroom-1.jpg` &mdash; Community Facility Depot
