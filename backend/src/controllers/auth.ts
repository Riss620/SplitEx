import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { CustomError } from '../middleware/error';
import { AuthRequest } from '../middleware/auth';
import { Role } from '../types/prismaEmulated';
import { logger } from '../config/logger';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'super-secret-jwt-access-key-change-in-production';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super-secret-jwt-refresh-key-change-in-production';

const generateAccessToken = (userId: string, role: Role) => {
  return jwt.sign({ userId, role }, ACCESS_SECRET, { expiresIn: '15m' });
};

const generateRefreshToken = (userId: string) => {
  return jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: '7d' });
};

const sendRefreshTokenCookie = (res: Response, token: string) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', token, {
    httpOnly: true,
    // secure must be true when sameSite=none (browser requirement)
    secure: isProduction,
    // 'none' required for cross-origin requests (Vercel FE → Render BE)
    // 'lax' is fine for same-origin (local dev)
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
};

const clearRefreshTokenCookie = (res: Response) => {
  const isProduction = process.env.NODE_ENV === 'production';
  // Options MUST match exactly what was used when setting the cookie
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      throw new CustomError('Email, password, and name are required', 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new CustomError('User with this email already exists', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userRole = role === 'Admin' ? Role.Admin : Role.Member;

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: userRole,
      },
    });

    const accessToken = generateAccessToken(user.id, user.role as Role);
    const refreshToken = generateRefreshToken(user.id);

    // Save refresh token in DB
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: user.id,
        details: JSON.stringify({ email: user.email }),
      },
    });

    sendRefreshTokenCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new CustomError('Email and password are required', 400);
    }

    const user = await prisma.user.findUnique({ where: { email, deletedAt: null } });
    if (!user) {
      throw new CustomError('Invalid credentials', 401);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new CustomError('Invalid credentials', 401);
    }

    const accessToken = generateAccessToken(user.id, user.role as Role);
    const refreshToken = generateRefreshToken(user.id);

    // Revoke any previous refresh tokens for this user
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Store new refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        entityType: 'User',
        entityId: user.id,
        details: JSON.stringify({}),
      },
    });

    sendRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.cookies;

    if (refreshToken) {
      // Revoke in DB
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revokedAt: new Date() },
      });
    }

    clearRefreshTokenCookie(res);

    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      throw new CustomError('Refresh token is required', 401);
    }

    // Check in DB
    const dbToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!dbToken || dbToken.revokedAt || dbToken.expiresAt < new Date() || dbToken.user.deletedAt) {
      throw new CustomError('Invalid or expired refresh token', 401);
    }

    // Verify JWT
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    } catch (err) {
      throw new CustomError('Invalid refresh token', 401);
    }

    // Rotation: revoke old and issue new
    await prisma.refreshToken.update({
      where: { id: dbToken.id },
      data: { revokedAt: new Date() },
    });

    const newAccessToken = generateAccessToken(dbToken.user.id, dbToken.user.role as Role);

    // Retry loop in case of rare JWT token collision on unique constraint
    let newRefreshToken = generateRefreshToken(dbToken.user.id);
    let retries = 0;
    while (retries < 3) {
      try {
        await prisma.refreshToken.create({
          data: {
            token: newRefreshToken,
            userId: dbToken.user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
        break; // success
      } catch (createErr: any) {
        if (createErr?.code === 'P2002' && retries < 2) {
          // Unique constraint violation — regenerate token and retry
          newRefreshToken = generateRefreshToken(dbToken.user.id);
          retries++;
        } else {
          throw createErr;
        }
      }
    }

    sendRefreshTokenCookie(res, newRefreshToken);

    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      user: {
        id: dbToken.user.id,
        email: dbToken.user.email,
        name: dbToken.user.name,
        role: dbToken.user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }
    res.status(200).json({ success: true, user: req.user });
  } catch (err) {
    next(err);
  }
};
