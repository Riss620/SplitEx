# SplitEx — Shared Expense Manager

A production-ready, full-stack shared expense tracking platform built for flatmates.
Features algorithmic settlement optimization, temporal membership tracking, 15-rule CSV anomaly detection, and complete audit trails.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| UI | Tailwind CSS + Shadcn UI + Lucide React |
| Forms | React Hook Form + **Zod** validation |
| State / API | TanStack Query v5 |
| Router | React Router DOM v6 |
| Backend | Express.js + TypeScript |
| Database | **MySQL** (TiDB Cloud Serverless — free) |
| ORM | **Prisma v5** |
| Auth | JWT Access (15min) + Refresh (7d) + bcryptjs |
| Authorization | RBAC — Admin / Member |
| File Processing | csv-parser |
| Logging | Winston |
| PDF Export | jsPDF (client-side) |
| Testing | Jest + ts-jest + Supertest |
| Deployment | Vercel (FE) + Render (BE) |

---

## Business Context

| Flatmate | Role | Membership |
|---|---|---|
| **Aisha** | Admin | Jan 2024 → present |
| **Rohan** | Member | Jan 2024 → present |
| **Priya** | Member | Jan 2024 → present |
| **Meera** | Member | Jan 2024 → **March 31, 2024 (moved out)** |
| **Dev** | Member | Trip group only |
| **Sam** | Member | **April 15, 2024** → present |

---

## Architecture Overview

```
┌─────────────────────┐     HTTPS/REST      ┌──────────────────────┐
│   React Frontend    │◄──────────────────►│   Express Backend     │
│   (Vercel)          │   JWT via Cookie    │   (Render)            │
└─────────────────────┘                     └──────────┬───────────┘
                                                        │ Prisma ORM
                                                        ▼
                                             ┌──────────────────────┐
                                             │  MySQL (TiDB Cloud)  │
                                             │  11 Tables, UUIDs    │
                                             └──────────────────────┘
```

**Key Services:**
- `balanceEngine.ts` — Computes net balances with full expense traceability
- `settlementEngine.ts` — Greedy algorithm to minimize settlement transactions
- `importService.ts` — 15-rule CSV anomaly detection + import workflow

---

## Local Setup

### Prerequisites
- Node.js 18+
- npm 9+
- MySQL database URL (TiDB Cloud Serverless — free at tidbcloud.com)

### 1. Clone & Install

```bash
git clone <your-repo>

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment Variables

```bash
# Backend
cd backend
cp .env.example .env
# Fill in your DATABASE_URL from TiDB Cloud
# Add strong JWT secrets (see .env.example for generation command)
```

**Getting TiDB Cloud MySQL URL (Free):**
1. Go to [tidbcloud.com](https://tidbcloud.com) → Sign up with GitHub
2. Create a **Serverless** cluster (free tier)
3. Click **Connect** → Select **Prisma** → Copy the `DATABASE_URL`
4. Paste into `backend/.env`

### 3. Database Setup

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Run migrations (creates all tables)
npx prisma migrate dev --name init

# Seed with demo data (6 flatmates + expenses + exchange rates)
npx ts-node prisma/seed.ts
```

### 4. Run Development Servers

```bash
# Terminal 1 — Backend (port 3001)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev
```

### 5. Access the App

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api
- Health check: http://localhost:3001/health

**Demo credentials (after seeding):**
```
Admin:  aisha@splitex.com  / password123
Member: rohan@splitex.com  / password123
Member: priya@splitex.com  / password123
Member: meera@splitex.com  / password123  (left March 31)
Member: dev@splitex.com    / password123  (trip group only)
Member: sam@splitex.com    / password123  (joined April 15)
```

---

## Running Tests

```bash
cd backend
npm run test
```

Test suites:
- `tests/engines.test.ts` — Balance engine + split calculations
- `tests/import.test.ts` — All 15 CSV anomaly detection rules
- `tests/balances.test.ts` — Group balance calculation with audit traces

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register user |
| POST | `/api/auth/login` | Public | Login + get tokens |
| POST | `/api/auth/logout` | Public | Revoke refresh token |
| POST | `/api/auth/refresh` | Cookie | Rotate refresh token |
| GET | `/api/health` | Public | Health check |
| GET | `/api/dashboard/summary` | Auth | Dashboard KPIs |
| GET | `/api/groups` | Auth | List groups |
| POST | `/api/groups` | Auth | Create group |
| GET | `/api/groups/:id` | Auth | Group details |
| POST | `/api/groups/:id/members` | Admin | Add member |
| DELETE | `/api/groups/:id/members` | Admin | Remove member |
| POST | `/api/expenses` | Auth | Create expense |
| GET | `/api/expenses` | Auth | List expenses |
| PUT | `/api/expenses/:id` | Auth | Update expense |
| DELETE | `/api/expenses/:id` | Admin | Soft-delete expense |
| POST | `/api/settlements` | Auth | Record settlement |
| GET | `/api/settlements` | Auth | List settlements |
| GET | `/api/groups/:id/settlement-suggestions` | Auth | Optimized settlement path |
| POST | `/api/imports` | Admin | Upload + validate CSV |
| GET | `/api/imports` | Auth | Import history |
| GET | `/api/imports/:id` | Auth | Import session detail |
| POST | `/api/imports/:id/finalize` | Admin | Execute approved import |
| GET | `/api/imports/:id/report` | Auth | Structured report JSON |
| GET | `/api/imports/:id/report/csv` | Auth | Download report as CSV |
| PUT | `/api/anomalies/:id/resolve` | Admin | Resolve anomaly (MERGE/KEEP/IGNORE) |
| GET | `/api/audit-logs` | Admin | Full event trail |
| GET | `/api/exchange-rates` | Auth | List rates |
| POST | `/api/exchange-rates` | Admin | Add rate |
| GET | `/api/exchange-rates/latest` | Auth | Latest rate for pair |
| GET | `/api/users` | Admin | All users list |

---

## Deployment

### Frontend → Vercel

```bash
cd frontend
npm run build  # Verify build works locally first
```

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → Import repository
3. Set **Root Directory** to `frontend`
4. Add env var: `VITE_API_URL=https://your-backend.onrender.com/api`
5. Deploy

### Backend → Render

1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Set **Root Directory** to `backend`
4. **Build command:** `npm install && npm run build && npx prisma generate && npx prisma migrate deploy`
5. **Start command:** `npm start`
6. Set environment variables:
   ```
   DATABASE_URL=<your TiDB Cloud URL>
   JWT_ACCESS_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
   JWT_REFRESH_SECRET=<generate separately>
   FRONTEND_URL=https://your-app.vercel.app
   NODE_ENV=production
   ```

### Database → TiDB Cloud (MySQL)

Free Serverless tier — 5GB storage, 50M Request Units/month.
See setup steps in Local Setup section above.

---

## CSV Import Format

Upload CSV files with the following headers:

```csv
Date,Description,Amount,Currency,PaidBy,SplitType,Participants,SplitValues,IsSettlement
2024-03-15,March Rent,40000,INR,Aisha,EQUAL,Aisha;Rohan;Priya;Meera,,FALSE
2024-03-20,Amazon Grocery,120,USD,Rohan,EQUAL,Aisha;Rohan;Priya;Meera,,FALSE
2024-04-01,Rohan pays Aisha,5000,INR,Rohan,EQUAL,Aisha,,TRUE
```

**Split Types:**
- `EQUAL` — divide equally among all participants
- `EXACT` — specify exact amounts in SplitValues (semicolon-separated)
- `PERCENTAGE` — specify percentages in SplitValues (must sum to 100)
- `WEIGHTED` — specify weights in SplitValues (proportional)

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | MySQL connection string (TiDB/Railway/etc.) |
| `JWT_ACCESS_SECRET` | ✅ | 64-byte hex secret for access tokens |
| `JWT_REFRESH_SECRET` | ✅ | 64-byte hex secret for refresh tokens |
| `PORT` | Optional | Server port (default: 3001) |
| `NODE_ENV` | Optional | `development` or `production` |
| `FRONTEND_URL` | ✅ | CORS whitelist for frontend URL |

---

## License

MIT — Built as internship assessment. Educational use.
