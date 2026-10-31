# BORO — Authentication Handoff Guide

## 1. Route Specifications

| Method | Endpoint | Access | Description / Teammate Responsibility |
|---|---|---|---|
| `GET` | `/login` | Public | Sign in form. Shows demo account panel when `USE_MOCK=true`. |
| `POST` | `/login` | Public | Authenticates credentials, regenerates session, redirects by role. Add rate-limiting here. |
| `POST` | `/logout` | Authenticated | Destroys session store record and clears `boro.sid` cookie. |
| `GET` | `/signup` | Public | Account creation form with dynamic owner organisation & ID proof upload. |
| `POST` | `/signup` | Public | Validates payload, hashes password, saves record. Sets owner status to `pending`. |
| `GET` | `/demo/:role` | Dev / Demo | Seeded role fast-switch (`user`, `owner`, `admin`). Guarded by `USE_MOCK`. |
| `GET` | `/profile` | Authenticated | User identity, verification badge, and reliability history. |
| `POST` | `/profile/verify` | Authenticated | Identity document upload and verification submission. |

---

## 2. Session User Shape

Stored in `req.session.user` (strictly minimal, never passwords):
```js
req.session.user = {
  id: "USR-001",           // String: unique user identifier
  name: "Priya Mehta",     // String: display name
  email: "priya@demo.com", // String: primary email
  role: "user",            // String: 'user' | 'owner' | 'admin'
  initials: "PM",          // String: 2 uppercase letters for avatar fallback
  status: "active"         // String: 'active' | 'pending' | 'suspended'
};
```

---

## 3. Service Contracts (`services/userService.js`)

Replace stubs with actual database queries and bcrypt comparison:

```javascript
/**
 * 1. Authenticate credentials
 * @returns {Promise<{ id, name, email, role, initials, status } | null>}
 */
async function authenticate(email, password);

/**
 * 2. Create user record
 * @returns {Promise<{ id: string }>}
 */
async function create({ name, email, phone, password, role, organisation });

/**
 * 3. Seeded Demo User Lookup
 * @returns {Promise<{ id, name, email, role, initials, status }>}
 */
async function getDemoUser(role);
```

---

## 4. Backend Swap Markers ("BACKEND:")

Search for `BACKEND:` across the codebase to locate swap points:
- `routes/auth.js`:
  - `POST /login`: Rate limiting and `userService.authenticate(email, password)`
  - `POST /signup`: Database insert and bcrypt password hashing
  - `POST /logout`: Session store revocation and cookie expiration
  - `GET /demo/:role`: Remove or disable in production
- `services/userService.js`:
  - Database queries replacing in-memory `/data/mock.js` searches
- `middleware/auth.js`:
  - `attachUser`: Redis session / JWT verification
  - `res.locals.csrfToken`: Integrate `csurf` or double-submit CSRF cookie
- Forms:
  - Hidden input `<input type="hidden" name="_csrf" value="...">` in all POST views

---

## 5. How to Disable the Demo Accounts Panel

Set `USE_MOCK = false` in `data/mock.js` (or via environment variable `process.env.USE_MOCK = 'false'`). The login view checks `locals.useMock` and automatically hides the "Try a demo account" panel.

---

## 6. Production Security Checklist

- [ ] **Password Hashing**: Hash all passwords with `bcrypt` (salt rounds >= 10) or `argon2id`.
- [ ] **Persistent Session Store**: Replace in-memory `Map` with Redis (`connect-redis`) or PostgreSQL session store.
- [ ] **Input Validation**: Validate email format, phone numbers, password strength, and input sanitization (`zod` or `joi`).
- [ ] **CSRF Protection**: Wire signed CSRF tokens into all forms via `csurf` or similar middleware.
- [ ] **Rate Limiting**: Protect `POST /login` with `express-rate-limit` (e.g. max 5 failed attempts per 15 min).
- [ ] **Secure Cookie Flags**: Set `secure: true` (HTTPS), `httpOnly: true`, and `sameSite: 'lax'` on session cookie.
- [ ] **Owner Status Gate**: Verify that owners with `status === 'pending'` are blocked from listing spaces until admin verification.

