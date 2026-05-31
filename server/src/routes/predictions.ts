import { Router, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/matches', optionalAuth, async (req: AuthRequest, res: Response) => {
  const [matches] = await pool.execute(
    'SELECT id, match_number, group_name, home_team, away_team, match_date FROM matches ORDER BY match_number',
  );

  if (!req.userId) {
    res.json(matches);
    return;
  }

  const [preds] = await pool.execute('SELECT match_id, prediction FROM predictions WHERE user_id = ?', [req.userId]);
  const predMap = new Map<number, string>();
  for (const p of preds as Array<{ match_id: number; prediction: string }>) {
    predMap.set(p.match_id, p.prediction);
  }

  const result = (matches as Array<{ id: number; match_number: number; group_name: string; home_team: string; away_team: string; match_date: string }>).map((m) => ({
    ...m,
    prediction: predMap.get(m.id) ?? null,
  }));

  res.json(result);
});

router.put('/predictions/:matchId', requireAuth, async (req: AuthRequest, res: Response) => {
  const matchId = Number(req.params.matchId);
  const { prediction } = req.body as { prediction?: string };

  if (!prediction || !['H', 'D', 'A'].includes(prediction)) {
    res.status(400).json({ error: 'prediction must be H, D, or A' });
    return;
  }

  const [rows] = await pool.execute('SELECT id FROM matches WHERE id = ?', [matchId]);
  if ((rows as unknown[]).length === 0) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }

  await pool.execute(
    `INSERT INTO predictions (user_id, match_id, prediction)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE prediction = VALUES(prediction), updated_at = CURRENT_TIMESTAMP`,
    [req.userId, matchId, prediction],
  );

  res.json({ matchId, prediction });
});

export default router;
