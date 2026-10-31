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
