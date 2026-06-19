import { Router, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

interface Event {
  id: number;
  timestamp: string;
  event_type: string;
  user_id: number | null;
  viewed_user_id: number | null;
  description: string | null;
}

// Log an event
router.post('/events/log', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { event_type, viewed_user_id, description } = req.body as {
      event_type: string;
      viewed_user_id?: number;
      description?: string;
    };

    if (!event_type) {
      res.status(400).json({ error: 'event_type is required' });
      return;
    }

    // Fetch user info
    const [userRows] = await pool.execute(
      'SELECT email, first_name, last_name FROM users WHERE id = ?',
      [req.userId!],
    );
    const user = (userRows as any[])[0];

    await pool.execute(
      `INSERT INTO events (event_type, user_id, user_email, user_first_name, user_last_name, viewed_user_id, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        event_type,
        req.userId!,
        user?.email || null,
        user?.first_name || null,
        user?.last_name || null,
        viewed_user_id || null,
        description || null,
      ],
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error logging event:', err);
    res.status(500).json({ error: 'Failed to log event' });
  }
});

// Get events (only for oddvar@geheb.com)
router.get('/events', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is oddvar@geheb.com
    const [userRows] = await pool.execute(
      'SELECT email FROM users WHERE id = ?',
      [req.userId!],
    );

    if ((userRows as any[]).length === 0 || (userRows as any[])[0].email !== 'oddvar@geheb.com') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const pageNum = req.query.page ? parseInt(req.query.page as string) : 1;
    const limitNum = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const page = Math.max(1, isNaN(pageNum) ? 1 : pageNum);
    const limit = Math.max(1, Math.min(100, isNaN(limitNum) ? 20 : limitNum));
    const offset = (page - 1) * limit;

    // Get total count
    const [countRows] = await pool.execute('SELECT COUNT(*) as total FROM events', []);
    const total = (countRows as any[])[0].total;

    // Get paginated events
    const [events] = await pool.execute(
      `SELECT id, timestamp, event_type, user_id, user_email, user_first_name, user_last_name, viewed_user_id, description
       FROM events
       ORDER BY timestamp DESC
       LIMIT ${limit} OFFSET ${offset}`,
    );

    res.json({
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

export default router;
