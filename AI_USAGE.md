# AI Usage Declaration

This document lists the AI tools used, prompts utilized, limitations encountered, and the resolution of specific mistakes.

---

## 1. AI Tools Used
- **Antigravity (Gemini 3.5 Flash)**: Used for scaffolding directories, writing schemas, logic controllers, routing, tests, and documentation.

---

## 2. Key Prompts

- *"Build a revised implementation plan showing a Vite React frontend and Express.js backend with MySQL and Prisma..."*
- *"Create a Jest unit test suite covering the calculations, timeline validation, and minimal debt solver..."*
- *"Write index.css custom styling variables to support slate dark mode and custom scrollbar classes..."*

---

## 3. Limitations Encountered
- **Execution Policy Blocks**: Sandboxed PowerShell execution blocks standard command scripts (`npx`, `npm`). Resolved by calling binary wrapper extensions `.cmd` (e.g. `npx.cmd`, `npm.cmd`).
- **Network Timeouts**: Intermittent connection resets (`ECONNRESET`) during dependencies installation. Resolved by re-running package commands.

---

## 4. AI Mistakes and Corrections

### Example 1: Prisma Relation Naming Clashes
- **Mistake**: When generating schema relations between the `User` table and the `Settlement` table (`fromUserId` / `toUserId`), the AI omitted relation labels.
- **Error**: Prisma compile error: `Ambiguous relation. You must define relation name to differentiate fields.`
- **Correction**: Added explicit relation annotations `@relation("SentSettlements")` and `@relation("ReceivedSettlements")` to identify links.

### Example 2: Floating Rounding Errors in Equal Split Calculations
- **Mistake**: The AI's split calculation simply divided total cost by count, returning float values.
- **Error**: Equal splits for ₹100 among 3 participants yielded ₹33.33, ₹33.33, and ₹33.33. The sum (₹99.99) did not match the total (₹100), throwing a validator error.
- **Correction**: Updated `splitExpenseAmount` to accumulate split values and assign the remainder `(amount - cumulative)` to the last participant.

### Example 3: MongoDB specific Types inside MySQL schema
- **Mistake**: When transitioning between database requirements, the AI generated a model using MongoDB ObjectID types (`@db.ObjectId`) inside the MySQL schema definition.
- **Error**: Prisma compiler error: `@db.ObjectId is only supported on mongodb datasource.`
- **Correction**: Replaced ObjectID default targets with standard `@default(uuid())` string identifiers.
