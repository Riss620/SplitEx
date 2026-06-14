# SplitEx Scope & Business Rules

This document outlines the detailed anomaly list, handling policies, validation rules, relational database definitions, and functional assumptions built into SplitEx.

---

## 1. Import System & Anomaly Detection Framework

SplitEx subjects every uploaded CSV file to a validator pipeline, evaluating rows against fifteen (15) validation rules. Errors block row ingestion, while Warnings flag elements for review.

### Anomaly List & Policies

| # | Anomaly Type | Severity | Condition Check | Suggested Resolution Action |
|---|---|---|---|---|
| 1 | **Malformed CSV Row** | `ERROR` | Missing required headers or columns. | Excluded from ingest; fix source file layout. |
| 2 | **Data Type Mismatch** | `ERROR` | Numeric fields contain text, or boolean fields are incorrect. | Excluded from ingest; correct input values. |
| 3 | **Missing Amount** | `ERROR` | Amount cell is empty. | Excluded from ingest; specify total billing cost. |
| 4 | **Negative Amount** | `ERROR` | Amount value <= 0. | Excluded from ingest; change amount to positive. |
| 5 | **Invalid Date** | `ERROR` | Transaction date string cannot be parsed. | Excluded from ingest; format as YYYY-MM-DD. |
| 6 | **Unsupported Currency**| `ERROR` | Currency is not USD or INR. | Excluded from ingest; convert currency in sheet. |
| 7 | **Unknown User** | `ERROR` | Payer or participant email/name not in memberships database. | Register user or add to group prior to final import. |
| 8 | **Split Mismatch** | `ERROR` | Participant splits sum doesn't match total amount. | Verify split weights, percentages, or exact sums. |
| 9 | **Duplicate Expense** | `WARNING` | Matching description, payer, amount, and date within 24h. | Admin resolves: Merge, Keep Both, or Ignore. |
| 10| **Duplicate Settlement**| `WARNING` | Matching from, to, amount, and date within 24h. | Admin resolves: Merge, Keep Both, or Ignore. |
| 11| **Settlement as Expense**| `WARNING` | Expense with single participant + settle terms. | Convert to Settlement transaction path. |
| 12| **Timeline Left Violation**| `WARNING` | Date is after participant leaving group. | Exclude participant from split or shift date. |
| 13| **Timeline Join Violation**|`WARNING` | Date is before participant joined group. | Exclude participant from split or shift date. |

---

## 2. Relational Database Design

The relational database model preserves data integrity and membership histories.

```
+--------------+        +-------------------+        +---------------+
|     User     | <----> |  GroupMembership  | <----> |     Group     |
+--------------+        +-------------------+        +---------------+
       ^                                                     ^
       |                                                     |
       v                                                     v
+--------------+                                      +---------------+
| RefreshToken |                                      |    Expense    |
+--------------+                                      +---------------+
                                                             ^
                                                             |
                                                             v
                                                      +---------------+
                                                      |  ExpenseSplit |
                                                      +---------------+
```

### Collection Summaries

- **User**: ID, unique email, password hash, role (`Admin` / `Member`), and timestamps.
- **RefreshToken**: Tracked tokens with `userId` and `revokedAt` DateTime for secure JWT rotations.
- **Group**: ID, name, creator tracking. Supports soft delete via `deletedAt`.
- **GroupMembership**: Supports historical tracking via `joinedAt` and `leftAt`. A unique constraint on `(groupId, userId, joinedAt)` allows users to leave and rejoin groups later.
- **Expense**: Stores title, amount in INR, original currency (INR/USD), exchange rate used, payer, and split type.
- **ExpenseParticipant**: Tracked splits mapping back to individual shares.
- **Settlement**: Logs payment transactions between members.
- **ImportSession**: Tracks upload sessions, rows processed, warnings/errors count.
- **ImportAnomaly**: Retains row number, severity, action taken, and reviewer details.
- **AuditLog**: Retains system action summaries, actor, and target details.
- **ExchangeRate**: USD/INR conversion rate history.

---

## 3. Importer Workflow

```
[ Upload CSV File ] ──> [ csv-parser Stream ]
                              │
                              ▼
                     [ Validation Engine ] ──( Anomaly Logged )
                              │
                     ┌────────┴────────┐
                     ▼                 ▼
             (Errors Count > 0)    (Clean / Warnings Only)
                     │                 │
                     ▼                 ▼
             [ Session Blocked ]   [ Session Pending Approval ]
             (Must edit CSV)           │
                                       ▼
                               [ Resolve Board ] ──> ( Merge / Ignore / Keep )
                                       │
                                       ▼
                               [ Finalize Ingest ]
```

---

## 4. Key Assumptions

1. **Base Currency**: The system performs all arithmetic calculations in **INR**. If an expense is entered in USD, it is converted to INR using the exchange rate active on the expense's date before splits are computed.
2. **Soft Deletes**: Deletion of groups or expenses sets `deletedAt = DateTime`. Pre-filters on queries exclude soft-deleted rows.
3. **Timeline Validity**: Expenses do not affect members who were inactive. The Balance engine checks membership boundaries to ignore splits outside a user's timeline.
