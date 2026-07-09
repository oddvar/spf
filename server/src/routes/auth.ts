import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

const PAYMENT_STATUSES = ['NO', 'WANTS_TO_PAY', 'HAS_PAID'] as const;
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

router.post('/register', async (_req: Request, res: Response) => {
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
      // Log failed login attempt (user not found)
      await pool.execute(
        `INSERT INTO events (event_type, user_email, description)
         VALUES (?, ?, ?)`,
        [
          'login_failed',
          email.trim(),
          'Failed login attempt: user not found',
        ],
      ).catch((err) => {
        console.error('Failed to log login event:', err);
      });
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = users[0];

    if (!user.active) {
      // Log failed login attempt (account deactivated)
      await pool.execute(
        `INSERT INTO events (event_type, user_id, user_email, user_first_name, user_last_name, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'login_failed',
          user.id,
          user.email,
          user.first_name,
          user.last_name,
          'Failed login attempt: account deactivated',
        ],
      ).catch((err) => {
        console.error('Failed to log login event:', err);
      });
      res.status(403).json({ error: 'Your account has been deactivated' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      // Log failed login attempt (wrong password)
      await pool.execute(
        `INSERT INTO events (event_type, user_id, user_email, user_first_name, user_last_name, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'login_failed',
          user.id,
          user.email,
          user.first_name,
          user.last_name,
          'Failed login attempt: wrong password',
        ],
      ).catch((err) => {
        console.error('Failed to log login event:', err);
      });
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');

    const token = jwt.sign({ id: user.id}, secret, { expiresIn: '7d' });

    await pool.execute(`UPDATE users SET last_login = NOW() WHERE id = ?`, [user.id]);

    // Log successful login event
    await pool.execute(
      `INSERT INTO events (event_type, user_id, user_email, user_first_name, user_last_name, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'user_login',
        user.id,
        user.email,
        user.first_name,
        user.last_name,
        `User logged in successfully`,
      ],
    ).catch((err) => {
      console.error('Failed to log login event:', err);
    });

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
      canViewOthers: !!user.can_view_others,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.execute(
      'SELECT email FROM users WHERE id = ?',
      [req.userId!],
    );
    const users = rows as Array<{ email: string }>;

    if (users.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ email: users[0].email });
  } catch (err) {
    console.error('Error fetching current user:', err);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };

  if (!email || email.trim() === '') {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  try {
    // Check if user exists
    const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email.trim()]);

    if ((rows as any[]).length > 0) {
      const user = (rows as any[])[0];
      // Generate reset token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      // Store token in database
      const tokenId = crypto.randomUUID();
      await pool.execute(
        'INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
        [tokenId, user.id, token, expiresAt],
      );

      // Log event with token (for admin to use)
      try {
        const resetUrl = `${process.env.CLIENT_URL || 'https://localhost:5173'}/reset-password?token=${token}`;
        await pool.execute(
          `INSERT INTO events (event_type, user_id, user_email, description)
           VALUES (?, ?, ?, ?)`,
          [
            'password_reset_requested',
            null,
            email.trim(),
            `Password reset requested. Reset URL: ${resetUrl}`,
          ],
        );
        console.log(`[AUTH] Password reset event logged for ${email.trim()}`);
      } catch (logErr) {
        console.error(`[AUTH] Failed to log password reset event for ${email.trim()}:`, logErr);
      }

      console.log(`[AUTH] Password reset token generated for user ${user.id} (${email.trim()})`);
    } else {
      // Log event even if user not found (for audit trail)
      try {
        await pool.execute(
          `INSERT INTO events (event_type, user_id, user_email, description)
           VALUES (?, ?, ?, ?)`,
          [
            'password_reset_requested',
            null,
            email.trim(),
            `Password reset requested for non-existent email`,
          ],
        );
      } catch (logErr) {
        console.error(`[AUTH] Failed to log password reset event for ${email.trim()}:`, logErr);
      }
    }

    // For security, always return the same message
    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token || token.trim() === '') {
    res.status(400).json({ error: 'Reset token is required' });
    return;
  }

  if (!password || password.trim() === '') {
    res.status(400).json({ error: 'Password is required' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  try {
    console.log(`[AUTH] Starting password reset with token: ${token.substring(0, 10)}...`);

    // Find valid reset token
    const [tokenRows] = await pool.execute(
      'SELECT user_id FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()',
      [token.trim()],
    );

    if ((tokenRows as any[]).length === 0) {
      console.log(`[AUTH] Reset token not found or expired: ${token.substring(0, 10)}...`);
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const resetToken = (tokenRows as any[])[0];
    const userId = resetToken.user_id;
    console.log(`[AUTH] Found valid reset token for user: ${userId}`);

    // Get user info
    const [userRows] = await pool.execute(
      'SELECT email, first_name, last_name FROM users WHERE id = ?',
      [userId],
    );

    const userEmail = (userRows as any[])[0]?.email || 'unknown';
    const userFirstName = (userRows as any[])[0]?.first_name || null;
    const userLastName = (userRows as any[])[0]?.last_name || null;
    console.log(`[AUTH] User info retrieved: ${userEmail}, ${userFirstName} ${userLastName}`);

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);
    console.log(`[AUTH] Password hashed for user: ${userId}`);

    // Update user password
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, userId],
    );
    console.log(`[AUTH] Password updated in database for user: ${userId}`);

    // Delete used reset token
    await pool.execute(
      'DELETE FROM password_reset_tokens WHERE user_id = ?',
      [userId],
    );
    console.log(`[AUTH] Reset token deleted for user: ${userId}`);

    // Log event
    const resetUrl = `${process.env.CLIENT_URL || 'https://localhost:5173'}/reset-password?token=${token}`;
    try {
      await pool.execute(
        `INSERT INTO events (event_type, user_id, user_email, user_first_name, user_last_name, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'password_reset',
          userId,
          userEmail,
          userFirstName,
          userLastName,
          `Password reset completed. Reset URL: ${resetUrl}`,
        ],
      );
      console.log(`[AUTH] Password reset event logged for user ${userId}`);
    } catch (logErr) {
      console.error(`[AUTH] Failed to log password reset event for user ${userId}:`, logErr);
    }

    console.log(`[AUTH] Password reset successful for user ${userId}`);
    res.json({ message: 'Password has been reset successfully. You can now sign in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/verify-reset-token', async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Reset token is required' });
    return;
  }

  try {
    // Check if token is valid
    const [tokenRows] = await pool.execute(
      'SELECT user_id FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()',
      [token.trim()],
    );

    if ((tokenRows as any[]).length === 0) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    res.json({ valid: true });
  } catch (err) {
    console.error('Verify reset token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
