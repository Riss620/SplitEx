# Technical Interview Guide

This guide prepares you to explain the system architecture, database design, core algorithms, and validation pipelines in a live technical interview.

---

## 1. System Architecture

```
┌─────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│   Vite React    │ <=========> │  Express.js API  │ <=========> │    PostgreSQL    │
│    Frontend     │    REST     │    Web Server    │   Prisma    │   Neon Database  │
└─────────────────┘             └──────────────────┘             └──────────────────┘
```

- **Vite React Frontend**: Uses React Router DOM, TanStack Query for caching, and React Hook Form. It's client-side, responsive, and decoupled.
- **Express.js API Backend**: Provides REST endpoints under `/api`. Standard middleware manages request logging (Winston), errors, and session checking.
- **Prisma PostgreSQL Database**: Manages data relations, uniqueness constraints, and transactions.

---

## 2. Authentication and JWT Session Flow

SplitEx implements custom token rotations:
1. **Access Token**: Short-lived (15 minutes), passed as a `Bearer` header.
2. **Refresh Token**: Long-lived (7 days), passed as a secure `httpOnly` cookie. This token is tracked in the database's `RefreshToken` table.
3. **Rotation**: When the access token expires, the client sends a `POST /api/auth/refresh` request. The backend verifies the refresh token, revokes it, issues a new refresh token, and updates both the database and the cookie.

---

## 3. Mathematical Engines

### A. Balance Calculation Engine
- Net balance for each user is computed as:
  `Net Balance = Sum(Amounts Paid) - Sum(Owed Split Shares)`
- Splits are computed dynamically based on `SplitType`:
  - `EQUAL`: `amount / count`. Remainder assigned to the final participant.
  - `EXACT`: Verifies that exact shares match the total.
  - `PERCENTAGE`: Shares = `amount * percentage / 100`.
  - `WEIGHTED`: Shares = `amount * weight / totalWeight`.

### B. Greedy Settlement Solver
- The engine minimizes transfers by sorting user nets:
  1. Identifies creditors (net > 0) and debtors (net < 0).
  2. Sorts both lists in descending order of value.
  3. Matches the largest debtor with the largest creditor.
  4. Deducts the matched amount and repeats until all balances are zero.

---

## 4. Importer & Anomaly Detection Workflow

The engine streams files using `csv-parser` and applies 15 validation checks:
- Malformed CSV formatting.
- Missing, negative, or non-numeric amount fields.
- Non-registered payers or participants.
- Membership timelines (dates outside `joinedAt` or `leftAt`).
- Splitting mismatches (sums not matching total).
- Duplicates: Scans database for expenses with matching amount, payer, and description in the group within a 24-hour window.

Duplicates trigger a warning, allowing admins to:
1. **Merge**: Match with existing records.
2. **Keep Both**: Ingest as a new entry.
3. **Ignore**: Discard.

---

## 5. Potential Interview Questions and Answers

### Q: Why did you build custom JWT auth instead of using NextAuth?
- **A**: Decoupled monorepos (Vite + Express) require explicit control over cookie attributes (`httpOnly`, `sameSite`, CORS). NextAuth is convenient for Next.js monolithic pages but custom JWTs provide absolute clarity over token refresh mechanics, security headers, and revocation flows.

### Q: How does your database handle users leaving and re-joining groups?
- **A**: The `GroupMembership` table tracks historical intervals using `joinedAt` and nullable `leftAt` dates. We enforce a unique key constraint on `(groupId, userId, joinedAt)`. This allows a user to leave a group (setting `leftAt`) and later rejoin (creating a new row with a new `joinedAt`), maintaining chronological integrity.

### Q: What is the complexity of your settlement algorithm?
- **A**: Separating and sorting debtors and creditors takes `O(N log N)` time. The matching loop runs in `O(N)` time. This makes the overall complexity `O(N log N)`, which is highly efficient for group settlement scenarios.
