/**
 * User Controller
 * ================
 * Admin-accessible endpoints for user management.
 * Used by the frontend "Add Member" UI to look up registered users by email.
 */

import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { CustomError } from '../middleware/error';

/**
 * GET /api/users
 * Admin only: List all active users (for member-add dropdowns).
 */
export const getAllUsers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ success: true, users });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id
 * Get a single user's public profile.
 */
export const getUserById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new CustomError('User not found', 404);
    }

    res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};
