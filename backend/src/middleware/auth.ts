import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { CustomError } from './error';
import { Role } from '../types/prismaEmulated';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
    name: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new CustomError('Access token is missing or malformed', 401);
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_ACCESS_SECRET || 'super-secret-jwt-access-key-change-in-production';

    let decoded: any;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new CustomError('Access token has expired', 401);
      }
      throw new CustomError('Invalid access token', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId, deletedAt: null },
    });

    if (!user) {
      throw new CustomError('User not found or deactivated', 401);
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as Role,
      name: user.name,
    };

    next();
  } catch (err) {
    next(err);
  }
};

export const authorize = (roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new CustomError('Authentication required', 401);
      }

      if (!roles.includes(req.user.role)) {
        throw new CustomError('Forbidden: Insufficient privileges', 403);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
