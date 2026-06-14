/**
 * Exchange Rate Controller
 * ========================
 * Manages auditable currency conversion rates.
 * Only Admin can create/update rates. All users can read.
 *
 * Audit note: Every rate change is tracked in AuditLog.
 * Business rule: 1 USD != 1 INR. Rates must ALWAYS be stored and retrieved
 * from DB — never hardcoded (except as a last-resort fallback).
 */

import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { CustomError } from '../middleware/error';
import { logger } from '../config/logger';

/**
 * GET /api/exchange-rates
 * Returns all active exchange rates, newest first.
 */
export const getExchangeRates = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { from, to } = req.query;

    const where: any = { deletedAt: null };
    if (from) where.fromCurrency = String(from).toUpperCase();
    if (to) where.toCurrency = String(to).toUpperCase();

    const rates = await prisma.exchangeRate.findMany({
      where,
      include: {
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { effectiveDate: 'desc' },
    });

    res.status(200).json({ success: true, rates });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/exchange-rates
 * Admin only: Add or override an exchange rate.
 */
export const createExchangeRate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { fromCurrency, toCurrency, rate, effectiveDate, source } = req.body;

    if (!fromCurrency || !toCurrency || !rate) {
      throw new CustomError('fromCurrency, toCurrency, and rate are required', 400);
    }

    const rateValue = Number(rate);
    if (isNaN(rateValue) || rateValue <= 0) {
      throw new CustomError('Rate must be a positive number', 400);
    }

    const newRate = await prisma.exchangeRate.create({
      data: {
        fromCurrency: String(fromCurrency).toUpperCase(),
        toCurrency: String(toCurrency).toUpperCase(),
        rate: rateValue,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        source: source || 'manual_override',
        createdById: req.user!.id,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'EXCHANGE_RATE_UPDATED',
        entityType: 'ExchangeRate',
        entityId: newRate.id,
        details: JSON.stringify({
          fromCurrency: newRate.fromCurrency,
          toCurrency: newRate.toCurrency,
          rate: rateValue,
          effectiveDate: newRate.effectiveDate,
        }),
      },
    });

    logger.info(`Exchange rate created: ${fromCurrency}→${toCurrency} = ${rate} by ${req.user!.id}`);

    res.status(201).json({ success: true, rate: newRate });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/exchange-rates/latest
 * Returns the most recent rate for a given currency pair.
 * Used by expense creation to auto-populate the rate.
 */
export const getLatestRate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { from = 'USD', to = 'INR' } = req.query;

    const rate = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: String(from).toUpperCase(),
        toCurrency: String(to).toUpperCase(),
        deletedAt: null,
      },
      orderBy: { effectiveDate: 'desc' },
    });

    if (!rate) {
      // Fallback rate — logged as warning
      logger.warn(`No exchange rate found for ${from}→${to}, using fallback 83.50`);
      return res.status(200).json({
        success: true,
        rate: {
          fromCurrency: 'USD',
          toCurrency: 'INR',
          rate: 83.50,
          source: 'fallback_hardcoded',
          warning: 'No rate found in database. Using hardcoded fallback. Please add a rate.',
        },
      });
    }

    res.status(200).json({ success: true, rate });
  } catch (err) {
    next(err);
  }
};
