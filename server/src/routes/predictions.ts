import { Router, Response } from 'express';
import { pool, MATCH_COUNT } from '../db.js';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Column list used when reading predictions from the users table
const PRED_COLS = Array.from({ length: MATCH_COUNT }, (_, i) => `match${i + 1}`).join(', ');

type MatchRow = {
  id: number;
  match_number: number;
  group_name: string;
  home_team: string;
  away_team: string;
  match_datetime: string;
  location: string | null;
};

router.get('/matches', optionalAuth, async (req: AuthRequest, res: Response) => {
  const [matches] = await pool.execute(
    'SELECT id, match_number, group_name, home_team, away_team, match_datetime, location FROM matches ORDER BY match_datetime',
  );

  const normalise = (m: MatchRow) => ({
    ...m,
    match_datetime: (m.match_datetime as string).replace(' ', 'T') + 'Z',
  });

  if (!req.userId) {
    res.json({ matches: (matches as MatchRow[]).map(normalise), canEdit: false });
    return;
  }

  const [userRows] = await pool.execute(
    `SELECT can_edit, ${PRED_COLS} FROM users WHERE id = ?`,
    [req.userId],
  );
  const userData = (userRows as Record<string, string | null | number>[])[0] ?? {};
  const canEdit = !!userData.can_edit;
  const preds = userData as Record<string, string | null>;

  res.json({
    canEdit,
    matches: (matches as MatchRow[]).map((m) => ({
      ...normalise(m),
      prediction: preds[`match${m.match_number}`] ?? null,
    })),
  });
});

router.put('/predictions/:matchId', requireAuth, async (req: AuthRequest, res: Response) => {
  const matchId = Number(req.params.matchId);
  const { prediction } = req.body as { prediction?: string };

  if (!prediction || !['H', 'D', 'A'].includes(prediction)) {
    res.status(400).json({ error: 'prediction must be H, D, or A' });
    return;
  }

  const [userRows] = await pool.execute('SELECT can_edit FROM users WHERE id = ?', [req.userId!]);
  if (!(userRows as Array<{ can_edit: number }>)[0]?.can_edit) {
    res.status(403).json({ error: 'Predictions are locked for your account' });
    return;
  }

  const [rows] = await pool.execute('SELECT match_number FROM matches WHERE id = ?', [matchId]);
  if ((rows as unknown[]).length === 0) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }
  const { match_number } = (rows as Array<{ match_number: number }>)[0];

  const clearBestThirds = ['a','b','c','d','e','f','g','h','i','j','k','l']
    .map((g) => `best_third_${g} = NULL`).join(', ');

  await pool.execute(
    `UPDATE users SET match${match_number} = ?, ${clearBestThirds} WHERE id = ?`,
    [prediction, req.userId],
  );

  res.json({ matchId, prediction });
});

export default router;
