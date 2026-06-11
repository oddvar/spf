import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db.js';

const router = Router();

const PAYMENT_STATUSES = ['NO', 'WANTS_TO_PAY', 'HAS_PAID'] as const;
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/register', async (req: Request, res: Response) => {
  res.status(403).json({ error: 'The competition has now started and new users are no longer accepted' });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || email.trim() === '') {
    res.status(400).json({ error: 'email is required' });
    return;
  }
  if (!password || password.trim() === '') {
    res.status(400).json({ error: 'password is required' });
    return;
  }

  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.trim()]);
    const users = rows as Array<{
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      password_hash: string;
      payment_status: PaymentStatus;
      can_edit: number;
      can_view_others: number;
      active: number;
    }>;

    if (users.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = users[0];

    if (!user.active) {
      res.status(403).json({ error: 'Your account has been deactivated' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');

    const token = jwt.sign({ id: user.id}, secret, { expiresIn: '7d' });

    await pool.execute(`UPDATE users SET last_login = NOW() WHERE id = ?`, [user.id]);

    res.json({
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        paymentStatus: user.payment_status,
        canEdit: !!user.can_edit,
        canViewOthers: !!user.can_view_others,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
