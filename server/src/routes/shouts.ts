import { Router, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/shouts', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.execute(
      `SELECT s.id, s.comment, s.created_at, u.first_name, u.last_name
       FROM shouts s
       JOIN users u ON s.user_id = u.id
       ORDER BY s.created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching shouts:', err);
    res.status(500).json({ error: 'Failed to fetch shouts' });
  }
});

router.post('/shouts', requireAuth, async (req: AuthRequest, res: Response) => {
  const { comment } = req.body as { comment?: string };

  if (!comment || comment.trim().length === 0) {
    res.status(400).json({ error: 'Comment cannot be empty' });
    return;
  }

  if (comment.length > 1000) {
    res.status(400).json({ error: 'Comment must be 1000 characters or less' });
    return;
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO shouts (user_id, comment) VALUES (?, ?)`,
      [req.userId!, comment.trim()],
    );
    const insertId = (result as any).insertId;

    const [newShout] = await pool.execute(
      `SELECT s.id, s.comment, s.created_at, u.first_name, u.last_name
       FROM shouts s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`,
      [insertId],
    );

    res.json((newShout as any[])[0]);
  } catch (err) {
    console.error('Error creating shout:', err);
    res.status(500).json({ error: 'Failed to create shout' });
  }
});

export default router;
