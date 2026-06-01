import { Router, Response } from 'express';
import { pool, KO_MATCH_COUNT } from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

const KO_PRED_COLS = Array.from({ length: KO_MATCH_COUNT }, (_, i) => `ko${i + 1}`).join(', ');

type KoMatchRow = {
  id: number;
  ko_number: number;
  home_team: string;
  away_team: string;
  match_datetime: string;
  location: string | null;
};

router.get('/knockout/matches', requireAuth, async (req: AuthRequest, res: Response) => {
  const [matches] = await pool.execute(
    `SELECT id, ko_number, home_team, away_team, match_datetime, location
     FROM matches WHERE stage = 'r32' ORDER BY match_datetime`,
  );

  const [userRows] = await pool.execute(
    `SELECT can_edit, ${KO_PRED_COLS} FROM users WHERE id = ?`,
    [req.userId!],
  );
  const userData = (userRows as Record<string, string | null | number>[])[0] ?? {};
  const canEdit = !!userData.can_edit;

  res.json({
    canEdit,
    matches: (matches as KoMatchRow[]).map((m) => ({
      ...m,
      match_datetime: (m.match_datetime as string).replace(' ', 'T') + 'Z',
      prediction: (userData[`ko${m.ko_number}`] as string | null) ?? null,
    })),
  });
});

router.put('/knockout/:matchId', requireAuth, async (req: AuthRequest, res: Response) => {
  const matchId = Number(req.params.matchId);
  const { prediction } = req.body as { prediction?: string };

  if (!prediction || !['H', 'A'].includes(prediction)) {
    res.status(400).json({ error: 'prediction must be H or A' });
    return;
  }

  const [userRows] = await pool.execute('SELECT can_edit FROM users WHERE id = ?', [req.userId!]);
  if (!(userRows as Array<{ can_edit: number }>)[0]?.can_edit) {
    res.status(403).json({ error: 'Predictions are locked for your account' });
    return;
  }

  const [rows] = await pool.execute(
    `SELECT ko_number FROM matches WHERE id = ? AND stage = 'r32'`,
    [matchId],
  );
  if ((rows as unknown[]).length === 0) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }
  const { ko_number } = (rows as Array<{ ko_number: number }>)[0];

  await pool.execute(
    `UPDATE users SET ko${ko_number} = ? WHERE id = ?`,
    [prediction, req.userId],
  );

  res.json({ matchId, prediction });
});

export default router;
