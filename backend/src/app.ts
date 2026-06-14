import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { logger } from './config/logger';
import { errorHandler } from './middleware/error';

import authRouter from './routes/auth';
import apiRouter from './routes/api';

const app = express();

// ─── CORS ────────────────────────────────────────────────────────────────────
// Deployment note:
//   - In production, frontend is on Vercel (different domain from Render backend)
//   - credentials: true is required for cookie-based JWT to work cross-origin
//   - sameSite: 'none' + secure: true must match the cookie settings in auth.ts
//   - FRONTEND_URL must match the EXACT Vercel URL (no trailing slash)
//
// Set FRONTEND_URL in Render dashboard to your Vercel URL, e.g.:
//   https://splitex.vercel.app
//
// For local dev: FRONTEND_URL=http://localhost:5173

const isProduction = process.env.NODE_ENV === 'production';

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  // Allow localhost only in development
  ...(!isProduction ? [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
  ] : []),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., Postman, server-to-server, health checks)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      logger.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true, // Required for cookies (JWT refresh token)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
  })
);

// ─── BODY PARSING ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── REQUEST LOGGER ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.path} — origin: ${req.headers.origin || 'none'}`);
  next();
});

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'MySQL (TiDB Cloud)',
  });
});

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
