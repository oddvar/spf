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
    r32Predictions: (matches as KoMatchRow[]).map((m) => ({
      ...m,
      match_datetime: (m.match_datetime as string).replace(' ', 'T') + 'Z',
      prediction: (userData[`ko${m.ko_number}`] as string | null) ?? null,
    })),
  });
});

router.get('/knockout/inactive-teams', requireAuth, async (req: AuthRequest, res: Response) => {
  const [teams] = await pool.execute(
    `SELECT name FROM teams WHERE active = 0`,
  );
  res.json({
    inactiveTeams: (teams as Array<{ name: string }>).map((t) => t.name),
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

  await pool.execute(`UPDATE users SET ko32 = ? WHERE id = ?`, [prediction, req.userId!]);
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

  await pool.execute(`UPDATE users SET ko31 = ? WHERE id = ?`, [prediction, req.userId!]);
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

  await pool.execute(`UPDATE users SET ko${ko_number} = ? WHERE id = ?`, [prediction, req.userId!]);
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
  await pool.execute(`UPDATE users SET ko${colNum} = ? WHERE id = ?`, [prediction, req.userId!]);
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

  await pool.execute(`UPDATE users SET ko${29 + pairIdx} = ? WHERE id = ?`, [prediction, req.userId!]);
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
  await pool.execute(`UPDATE users SET ko${colNum} = ? WHERE id = ?`, [prediction, req.userId!]);
  res.json({ pairIdx, prediction });
});

router.post('/knockout/save-rendered', requireAuth, async (req: AuthRequest, res: Response) => {
  const [userRows] = await pool.execute('SELECT can_edit FROM users WHERE id = ?', [req.userId!]);
  if (!(userRows as Array<{ can_edit: number }>)[0]?.can_edit) {
    res.status(403).json({ error: 'Predictions are locked for your account' });
    return;
  }

  const { r32Matches, r16Matches, qfMatches, sfMatches, fMatch, thirdMatch, winner, thirdPlaceWinner } = req.body as {
    r32Matches?: unknown;
    r16Matches?: unknown;
    qfMatches?: unknown;
    sfMatches?: unknown;
    fMatch?: unknown;
    thirdMatch?: unknown;
    winner?: string;
    thirdPlaceWinner?: string;
  };

  try {
    await pool.execute(
      `UPDATE users SET
        ko_r32_matches = ?,
        ko_r16_matches = ?,
        ko_qf_matches = ?,
        ko_sf_matches = ?,
        ko_f_match = ?,
        ko_third_match = ?,
        ko_winner = ?,
        ko_third_place_winner = ?
       WHERE id = ?`,
      [
        r32Matches ? JSON.stringify(r32Matches) : null,
        r16Matches ? JSON.stringify(r16Matches) : null,
        qfMatches ? JSON.stringify(qfMatches) : null,
        sfMatches ? JSON.stringify(sfMatches) : null,
        fMatch ? JSON.stringify(fMatch) : null,
        thirdMatch ? JSON.stringify(thirdMatch) : null,
        winner || null,
        thirdPlaceWinner || null,
        req.userId!,
      ],
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving rendered matches:', err);
    res.status(500).json({ error: 'Failed to save rendered matches' });
  }
});

router.get('/knockout/oddvar-r32', async (_req, res: Response) => {
  try {
    const [userRows] = await pool.execute(
      'SELECT ko_r32_matches FROM users WHERE email = ?',
      ['oddvar@geheb.com'],
    );

    const user = (userRows as any[])[0];
    if (!user) {
      res.status(404).json({ error: 'Oddvar user not found' });
      return;
    }

    const r32Matches = user.ko_r32_matches
      ? (typeof user.ko_r32_matches === 'string' ? JSON.parse(user.ko_r32_matches) : user.ko_r32_matches)
      : [];

    res.json({ r32Predictions: r32Matches });
  } catch (err) {
    console.error('Error fetching oddvar r32 matches:', err);
    res.status(500).json({ error: 'Failed to fetch oddvar r32 matches' });
  }
});

router.get('/knockout/oddvar-r16', async (_req, res: Response) => {
  try {
    const [userRows] = await pool.execute(
      'SELECT ko_r16_matches FROM users WHERE email = ?',
      ['oddvar@geheb.com'],
    );

    const user = (userRows as any[])[0];
    if (!user) {
      res.status(404).json({ error: 'Oddvar user not found' });
      return;
    }

    const r16Matches = user.ko_r16_matches
      ? (typeof user.ko_r16_matches === 'string' ? JSON.parse(user.ko_r16_matches) : user.ko_r16_matches)
      : [];

    res.json({ r16Predictions: r16Matches });
  } catch (err) {
    console.error('Error fetching oddvar r16 matches:', err);
    res.status(500).json({ error: 'Failed to fetch oddvar r16 matches' });
  }
});

router.get('/knockout/oddvar-qf', async (_req, res: Response) => {
  try {
    const [userRows] = await pool.execute(
      'SELECT ko_qf_matches FROM users WHERE email = ?',
      ['oddvar@geheb.com'],
    );

    const user = (userRows as any[])[0];
    if (!user) {
      res.status(404).json({ error: 'Oddvar user not found' });
      return;
    }

    const qfMatches = user.ko_qf_matches
      ? (typeof user.ko_qf_matches === 'string' ? JSON.parse(user.ko_qf_matches) : user.ko_qf_matches)
      : [];

    res.json({ qfPredictions: qfMatches });
  } catch (err) {
    console.error('Error fetching oddvar qf matches:', err);
    res.status(500).json({ error: 'Failed to fetch oddvar qf matches' });
  }
});

router.get('/knockout/oddvar-sf', async (_req, res: Response) => {
  try {
    const [userRows] = await pool.execute(
      'SELECT ko_sf_matches FROM users WHERE email = ?',
      ['oddvar@geheb.com'],
    );

    const user = (userRows as any[])[0];
    if (!user) {
      res.status(404).json({ error: 'Oddvar user not found' });
      return;
    }

    const sfMatches = user.ko_sf_matches
      ? (typeof user.ko_sf_matches === 'string' ? JSON.parse(user.ko_sf_matches) : user.ko_sf_matches)
      : [];

    res.json({ sfPredictions: sfMatches });
  } catch (err) {
    console.error('Error fetching oddvar sf matches:', err);
    res.status(500).json({ error: 'Failed to fetch oddvar sf matches' });
  }
});

router.get('/knockout/oddvar-final', async (_req, res: Response) => {
  try {
    const [userRows] = await pool.execute(
      'SELECT ko_f_match FROM users WHERE email = ?',
      ['oddvar@geheb.com'],
    );

    const user = (userRows as any[])[0];
    if (!user) {
      res.status(404).json({ error: 'Oddvar user not found' });
      return;
    }

    const finalMatch = user.ko_f_match
      ? (typeof user.ko_f_match === 'string' ? JSON.parse(user.ko_f_match) : user.ko_f_match)
      : null;

    res.json({ finalMatch });
  } catch (err) {
    console.error('Error fetching oddvar final match:', err);
    res.status(500).json({ error: 'Failed to fetch oddvar final match' });
  }
});

router.get('/knockout/oddvar-f', async (_req, res: Response) => {
  try {
    const [userRows] = await pool.execute(
      'SELECT ko_f_match FROM users WHERE email = ?',
      ['oddvar@geheb.com'],
    );

    const user = (userRows as any[])[0];
    if (!user) {
      res.status(404).json({ error: 'Oddvar user not found' });
      return;
    }

    const fMatch = user.ko_f_match
      ? (typeof user.ko_f_match === 'string' ? JSON.parse(user.ko_f_match) : user.ko_f_match)
      : null;

    res.json({ fPrediction: fMatch });
  } catch (err) {
    console.error('Error fetching oddvar final match:', err);
    res.status(500).json({ error: 'Failed to fetch oddvar final match' });
  }
});

export default router;
