import { Router, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
const COLS = GROUPS.map((g) => `best_third_${g.toLowerCase()}`).join(', ');

router.get('/best-thirds', requireAuth, async (req: AuthRequest, res: Response) => {
  const [rows] = await pool.execute(`SELECT ${COLS} FROM users WHERE id = ?`, [req.userId!]);
  const user = (rows as Record<string, number | null>[])[0];

  const selections = GROUPS.filter((g) => user[`best_third_${g.toLowerCase()}`] === 1);
  res.json({ selections });
});

router.put('/best-thirds', requireAuth, async (req: AuthRequest, res: Response) => {
  const [userRows] = await pool.execute('SELECT can_edit FROM users WHERE id = ?', [req.userId!]);
  if (!(userRows as Array<{ can_edit: number }>)[0]?.can_edit) {
    res.status(403).json({ error: 'Selections are locked for your account' });
    return;
  }

  const { selections } = req.body as { selections?: string[] };

  if (!Array.isArray(selections)) {
    res.status(400).json({ error: 'selections must be an array of group letters' });
    return;
  }

  const valid = selections.every((g) => GROUPS.includes(g as (typeof GROUPS)[number]));
  if (!valid) {
    res.status(400).json({ error: 'Invalid group letter in selections' });
    return;
  }

  const setClauses = GROUPS.map((g) => `best_third_${g.toLowerCase()} = ?`).join(', ');
  const values = GROUPS.map((g) => (selections.includes(g) ? 1 : null));

  await pool.execute(`UPDATE users SET ${setClauses} WHERE id = ?`, [...values, req.userId!]);
  res.json({ selections });
});

export default router;
