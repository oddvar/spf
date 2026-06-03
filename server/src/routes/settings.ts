import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

const PAYMENT_STATUSES = ['NO', 'WANTS_TO_PAY', 'HAS_PAID'] as const;
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.get('/settings', requireAuth, async (req: AuthRequest, res: Response) => {
  const [rows] = await pool.execute(
    `SELECT first_name, last_name, email, payment_status FROM users WHERE id = ?`,
    [req.userId!],
  );
  const user = (rows as Array<{ first_name: string; last_name: string; email: string; payment_status: PaymentStatus }>)[0];

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    paymentStatus: user.payment_status,
  });
});

router.put('/settings', requireAuth, async (req: AuthRequest, res: Response) => {
  const { firstName, lastName, email, paymentStatus, currentPassword, newPassword } = req.body as Record<string, string>;

  if (!firstName || !firstName.trim()) {
    res.status(400).json({ error: 'First name is required' });
    return;
  }
  if (!lastName || !lastName.trim()) {
    res.status(400).json({ error: 'Last name is required' });
    return;
  }
  if (!email || !email.trim()) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email address' });
    return;
  }
  if (!paymentStatus || !PAYMENT_STATUSES.includes(paymentStatus as PaymentStatus)) {
    res.status(400).json({ error: 'Invalid payment status' });
    return;
  }

  // If updating password, validate it
  if (newPassword) {
    if (!currentPassword) {
      res.status(400).json({ error: 'Current password is required to change password' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters' });
      return;
    }

    // Verify current password
    const [userRows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.userId!]);
    const user = (userRows as Array<{ password_hash: string }>)[0];
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }
  }

  try {
    const newPasswordHash = newPassword ? await bcrypt.hash(newPassword, 10) : undefined;

    if (newPasswordHash) {
      await pool.execute(
        `UPDATE users SET first_name = ?, last_name = ?, email = ?, payment_status = ?, password_hash = ? WHERE id = ?`,
        [firstName.trim(), lastName.trim(), email.trim(), paymentStatus, newPasswordHash, req.userId!],
      );
    } else {
      await pool.execute(
        `UPDATE users SET first_name = ?, last_name = ?, email = ?, payment_status = ? WHERE id = ?`,
        [firstName.trim(), lastName.trim(), email.trim(), paymentStatus, req.userId!],
      );
    }

    res.json({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      paymentStatus,
    });
  } catch (err: unknown) {
    const mysqlErr = err as { code?: string; message?: string };
    if (mysqlErr.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    console.error('Settings update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
