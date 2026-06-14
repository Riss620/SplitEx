# Engineering Decisions & Tradeoffs

This document archives the design decisions, trade-offs, and choices made during SplitEx development.

---

## 1. Authentication Strategy

- **Decision**: Custom JWT Access and Refresh Token flow with HttpOnly cookies.
- **Alternatives Considered**: NextAuth.js (Auth.js) Credentials Provider.
- **Tradeoffs**:
  - NextAuth is simple but abstracts session management details. In Vite + Express decoupled layouts, custom cookies provide strict control over token lifetimes, rotation policies, and cors settings.
- **Rationale**: Demonstrates standard JWT security patterns, including cookie-based refresh rotation, in-memory access tokens, and explicit Refresh Token DB revocation.

---

## 2. Relational Database Design

- **Decision**: Relational tables in MySQL (TiDB Cloud Serverless) with Prisma ORM.
- **Alternatives Considered**: Document collections in MongoDB with Mongoose ODM.
- **Tradeoffs**:
  - Document models in MongoDB handle quick insertions but lack foreign key integrity. In a financial application like SplitEx, data consistency is critical. Mismatching users or orphaned expense participants could break calculation logic.
- **Rationale**: Relational databases enforce strict primary/foreign key schemas and unique constraints (e.g. tracking re-joining timelines), guaranteeing data integrity.

---

## 3. Debt Settlement Optimization

- **Decision**: Greedy min-flow pairing algorithm.
- **Alternatives Considered**:
  - N-to-N raw transactions logging (no optimization).
  - Bellman-Ford / Max-Flow Min-Cut network solvers.
- **Tradeoffs**:
  - Raw transfers require too many peer payments.
  - Network solvers are complex to implement.
- **Rationale**: The Greedy solver calculates user net balances and pairs the largest creditor with the largest debtor recursively. This produces the minimal transaction set in `O(N log N)` time, which is highly performant and explainable.

---

## 4. Temporary CSV Content Storage for Importer Finalization

- **Decision**: Storing uploaded CSV files in `uploads/${sessionId}.csv` temporarily until finalize is completed.
- **Alternatives Considered**:
  - Storing parsed rows in MySQL as JSON in `ImportSession`.
  - Sending raw CSV contents back to finalizer API from the frontend.
- **Tradeoffs**:
  - Storing JSON arrays in database rows causes table bloat.
  - Sending content back from client introduces tampering risks.
- **Rationale**: File-system buffering stores sheets securely, verifies hash values, parses rows directly, and deletes temporary files on finalization.

---

## 5. Mocking Database for Integration Testing

- **Decision**: Structuring Jest unit tests as pure mathematical engines evaluations.
- **Alternatives Considered**: Running tests on a live local database.
- **Tradeoffs**:
  - Testing against live databases creates state leaks and requires DB engines inside sandboxed runtimes.
- **Rationale**: Evaluates algorithms in-memory with isolated mock values, guaranteeing speed and reliability across environments.
