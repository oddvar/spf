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
  const { username, firstName, lastName, email, password, paymentStatus } = req.body as Record<string, string>;

  const requiredFields: [string, string][] = [
    ['username', username],
    ['firstName', firstName],
    ['lastName', lastName],
    ['email', email],
    ['password', password],
    ['paymentStatus', paymentStatus],
  ];

  for (const [field, value] of requiredFields) {
    if (!value || value.trim() === '') {
      res.status(400).json({ error: `${field} is required` });
      return;
    }
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email address' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  if (!PAYMENT_STATUSES.includes(paymentStatus as PaymentStatus)) {
    res.status(400).json({ error: 'paymentStatus must be NO, WANTS_TO_PAY, or HAS_PAID' });
    return;
  }

  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await pool.execute(
      `INSERT INTO users (id, username, first_name, last_name, email, password_hash, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, username.trim(), firstName.trim(), lastName.trim(), email.trim(), passwordHash, paymentStatus],
    );
    res.status(201).json({ id, username: username.trim(), email: email.trim() });
  } catch (err: unknown) {
    const mysqlErr = err as { code?: string; message?: string };
    if (mysqlErr.code === 'ER_DUP_ENTRY') {
      if (mysqlErr.message?.includes('username')) {
        res.status(409).json({ error: 'Username is already taken' });
      } else {
        res.status(409).json({ error: 'An account with this email already exists' });
      }
      return;
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
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
      username: string;
      first_name: string;
      last_name: string;
      email: string;
      password_hash: string;
      payment_status: PaymentStatus;
    }>;

    if (users.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');

    const token = jwt.sign({ id: user.id, username: user.username }, secret, { expiresIn: '7d' });

    await pool.execute(`UPDATE users SET last_login = NOW() WHERE id = ?`, [user.id]);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        paymentStatus: user.payment_status,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
