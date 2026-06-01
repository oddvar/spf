import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

export interface AuthRequest extends Request {
  userId?: string;
  username?: string;
}

async function hasRecentLogin(userId: string): Promise<boolean> {
  const [rows] = await pool.execute(
    `SELECT 1 FROM users
     WHERE id = ? AND last_login > DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    [userId],
  );
  return (rows as unknown[]).length > 0;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { id: string; username: string };

    if (!(await hasRecentLogin(payload.id))) {
      res.status(401).json({ error: 'Session expired, please log in again' });
      return;
    }

    req.userId = payload.id;
    req.username = payload.username;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { id: string; username: string };
      if (await hasRecentLogin(payload.id)) {
        req.userId = payload.id;
        req.username = payload.username;
      }
    } catch {
      // invalid token — proceed unauthenticated
    }
  }
  next();
}
