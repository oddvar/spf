import { Router, Response } from 'express';
import { pool, KO_MATCH_COUNT, KO_R16_COUNT, KO_QF_COUNT, KO_SF_COUNT, KO_F_COUNT, KO_T_COUNT } from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

const KO_PRED_COLS = Array.from({ length: KO_MATCH_COUNT }, (_, i) => `ko${i + 1}`).join(', ');
const KO_R16_COLS  = Array.from({ length: KO_R16_COUNT },  (_, i) => `ko${i + 17}`).join(', ');
const KO_QF_COLS   = Array.from({ length: KO_QF_COUNT },   (_, i) => `ko${i + 25}`).join(', ');
const KO_SF_COLS   = Array.from({ length: KO_SF_COUNT },   (_, i) => `ko${i + 29}`).join(', ');
const KO_F_COLS    = Array.from({ length: KO_F_COUNT },    (_, i) => `ko${i + 31}`).join(', ');
const KO_T_COLS    = Array.from({ length: KO_T_COUNT },    (_, i) => `ko${i + 32}`).join(', ');

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
    `SELECT can_edit, ${KO_PRED_COLS}, ${KO_R16_COLS}, ${KO_QF_COLS}, ${KO_SF_COLS}, ${KO_F_COLS}, ${KO_T_COLS} FROM users WHERE id = ?`,
    [req.userId!],
  );
  const userData = (userRows as Record<string, string | null | number>[])[0] ?? {};
  const canEdit = !!userData.can_edit;

  const r16Predictions = Array.from(
    { length: KO_R16_COUNT },
    (_, i) => (userData[`ko${i + 17}`] as string | null) ?? null,
  );
  const qfPredictions = Array.from(
    { length: KO_QF_COUNT },
    (_, i) => (userData[`ko${i + 25}`] as string | null) ?? null,
  );
  const sfPredictions = Array.from(
    { length: KO_SF_COUNT },
    (_, i) => (userData[`ko${i + 29}`] as string | null) ?? null,
  );
  const fPredictions = Array.from(
    { length: KO_F_COUNT },
    (_, i) => (userData[`ko${i + 31}`] as string | null) ?? null,
  );

  const thirdPrediction = (userData['ko32'] as string | null) ?? null;

  res.json({
    canEdit,
    r16Predictions,
    qfPredictions,
    sfPredictions,
    fPredictions,
    thirdPrediction,
    matches: (matches as KoMatchRow[]).map((m) => ({
      ...m,
      match_datetime: (m.match_datetime as string).replace(' ', 'T') + 'Z',
      prediction: (userData[`ko${m.ko_number}`] as string | null) ?? null,
    })),
  });
});

router.put('/knockout/third', requireAuth, async (req: AuthRequest, res: Response) => {
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

  await pool.execute(`UPDATE users SET ko32 = ? WHERE id = ?`, [prediction, req.userId]);
  res.json({ prediction });
});

router.put('/knockout/final', requireAuth, async (req: AuthRequest, res: Response) => {
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

  await pool.execute(`UPDATE users SET ko31 = ? WHERE id = ?`, [prediction, req.userId]);
  res.json({ prediction });
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

  await pool.execute(`UPDATE users SET ko${ko_number} = ? WHERE id = ?`, [prediction, req.userId]);
  res.json({ matchId, prediction });
});

router.put('/knockout/r16/:pairIdx', requireAuth, async (req: AuthRequest, res: Response) => {
  const pairIdx = Number(req.params.pairIdx);
  const { prediction } = req.body as { prediction?: string };

  if (!prediction || !['H', 'A'].includes(prediction)) {
    res.status(400).json({ error: 'prediction must be H or A' });
    return;
  }
  if (pairIdx < 0 || pairIdx >= KO_R16_COUNT) {
    res.status(400).json({ error: 'Invalid pair index' });
    return;
  }

  const [userRows] = await pool.execute('SELECT can_edit FROM users WHERE id = ?', [req.userId!]);
  if (!(userRows as Array<{ can_edit: number }>)[0]?.can_edit) {
    res.status(403).json({ error: 'Predictions are locked for your account' });
    return;
  }

  const colNum = 17 + pairIdx;
  await pool.execute(`UPDATE users SET ko${colNum} = ? WHERE id = ?`, [prediction, req.userId]);
  res.json({ pairIdx, prediction });
});

router.put('/knockout/sf/:pairIdx', requireAuth, async (req: AuthRequest, res: Response) => {
  const pairIdx = Number(req.params.pairIdx);
  const { prediction } = req.body as { prediction?: string };

  if (!prediction || !['H', 'A'].includes(prediction)) {
    res.status(400).json({ error: 'prediction must be H or A' });
    return;
  }
  if (pairIdx < 0 || pairIdx >= KO_SF_COUNT) {
    res.status(400).json({ error: 'Invalid pair index' });
    return;
  }

  const [userRows] = await pool.execute('SELECT can_edit FROM users WHERE id = ?', [req.userId!]);
  if (!(userRows as Array<{ can_edit: number }>)[0]?.can_edit) {
    res.status(403).json({ error: 'Predictions are locked for your account' });
    return;
  }

  await pool.execute(`UPDATE users SET ko${29 + pairIdx} = ? WHERE id = ?`, [prediction, req.userId]);
  res.json({ pairIdx, prediction });
});

router.put('/knockout/qf/:pairIdx', requireAuth, async (req: AuthRequest, res: Response) => {
  const pairIdx = Number(req.params.pairIdx);
  const { prediction } = req.body as { prediction?: string };

  if (!prediction || !['H', 'A'].includes(prediction)) {
    res.status(400).json({ error: 'prediction must be H or A' });
    return;
  }
  if (pairIdx < 0 || pairIdx >= KO_QF_COUNT) {
    res.status(400).json({ error: 'Invalid pair index' });
    return;
  }

  const [userRows] = await pool.execute('SELECT can_edit FROM users WHERE id = ?', [req.userId!]);
  if (!(userRows as Array<{ can_edit: number }>)[0]?.can_edit) {
    res.status(403).json({ error: 'Predictions are locked for your account' });
    return;
  }

  const colNum = 25 + pairIdx;
  await pool.execute(`UPDATE users SET ko${colNum} = ? WHERE id = ?`, [prediction, req.userId]);
  res.json({ pairIdx, prediction });
});

export default router;
