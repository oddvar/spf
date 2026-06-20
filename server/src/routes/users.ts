import { Router, Response } from 'express';
import { pool, MATCH_COUNT } from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

const PRED_COLS = Array.from({ length: MATCH_COUNT }, (_, i) => `match${i + 1}`).join(', ');

router.get('/users/list', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, first_name, last_name FROM users WHERE id != ? AND email != ? AND active = 1 ORDER BY last_name, first_name',
      [req.userId!, 'oddvar@geheb.com'],
    );
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/users/:userId/predictions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId;
    const [matchRows] = await pool.execute(
      `SELECT id, match_number, group_name, home_team, away_team, match_datetime, location FROM matches WHERE stage IS NULL ORDER BY match_datetime`,
    );

    const [userRows] = await pool.execute(
      `SELECT can_edit, ${PRED_COLS} FROM users WHERE id = ?`,
      [userId],
    );

    if ((userRows as any[]).length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userData = (userRows as Record<string, string | null | number>[])[0] ?? {};
    const canEdit = !!userData.can_edit;
    const preds = userData as Record<string, string | null>;

    // Get oddvar@geheb.com's predictions (the results)
    const [oddvarRows] = await pool.execute(
      `SELECT ${PRED_COLS} FROM users WHERE email = ?`,
      ['oddvar@geheb.com'],
    );
    const oddvarData = (oddvarRows as Record<string, string | null>[])[0] ?? {};

    const normalise = (m: any) => ({
      ...m,
      match_datetime: (m.match_datetime as string).replace(' ', 'T') + 'Z',
    });

    res.json({
      canEdit,
      matches: (matchRows as any[]).map((m) => ({
        ...normalise(m),
        prediction: preds[`match${m.match_number}`] ?? null,
        result: (oddvarData[`match${m.match_number}`] as 'H' | 'D' | 'A' | null) ?? null,
      })),
    });
  } catch (err) {
    console.error('Error fetching user predictions:', err);
    res.status(500).json({ error: 'Failed to fetch user predictions' });
  }
});

router.get('/users/:userId/best-thirds', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId;
    const [matchRows] = await pool.execute(
      `SELECT id, match_number, group_name, home_team, away_team, match_datetime, location, result FROM matches WHERE stage IS NULL ORDER BY match_datetime`,
    );

    const [userRows] = await pool.execute(
      `SELECT ${PRED_COLS}, best_third_a, best_third_b, best_third_c, best_third_d, best_third_e, best_third_f, best_third_g, best_third_h, best_third_i, best_third_j, best_third_k, best_third_l FROM users WHERE id = ?`,
      [userId],
    );

    if ((userRows as any[]).length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userData = (userRows as any[])[0];
    const GROUPS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
    const selections = GROUPS.filter((g) => userData[`best_third_${g}`] === 1).map((g) => g.toUpperCase());

    const normalise = (m: any) => ({
      ...m,
      match_datetime: (m.match_datetime as string).replace(' ', 'T') + 'Z',
    });

    const preds = userData as Record<string, string | null>;

    res.json({
      selections,
      matches: (matchRows as any[]).map((m) => ({
        ...normalise(m),
        prediction: preds[`match${m.match_number}`] ?? null,
      })),
    });
  } catch (err) {
    console.error('Error fetching user best-thirds:', err);
    res.status(500).json({ error: 'Failed to fetch user best-thirds' });
  }
});

router.get('/users/:userId/knockout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId;
    const [matchRows] = await pool.execute(
      `SELECT id, ko_number, home_team, away_team, match_datetime, location FROM matches WHERE stage = 'r32' ORDER BY match_datetime`,
    );

    const [userRows] = await pool.execute(
      `SELECT ko1, ko2, ko3, ko4, ko5, ko6, ko7, ko8, ko9, ko10, ko11, ko12, ko13, ko14, ko15, ko16, ko17, ko18, ko19, ko20, ko21, ko22, ko23, ko24, ko25, ko26, ko27, ko28, ko29, ko30, ko31, ko32 FROM users WHERE id = ?`,
      [userId],
    );

    if ((userRows as any[]).length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userData = (userRows as any[])[0];

    const normalise = (m: any) => ({
      ...m,
      match_datetime: (m.match_datetime as string).replace(' ', 'T') + 'Z',
    });

    // Get team active status
    const [teamRows] = await pool.execute(
      `SELECT name, active FROM teams WHERE name IN (${(matchRows as any[]).map(() => '?').join(',')})`,
      (matchRows as any[]).flatMap((m) => [m.home_team, m.away_team]),
    );
    const teamActiveMap: { [key: string]: boolean } = {};
    for (const team of teamRows as any[]) {
      teamActiveMap[team.name] = team.active === 1;
    }

    res.json({
      r32Predictions: (matchRows as any[]).map((m) => ({
        ...normalise(m),
        prediction: userData[`ko${m.ko_number}`] ?? null,
        homeTeamActive: teamActiveMap[m.home_team] !== false,
        awayTeamActive: teamActiveMap[m.away_team] !== false,
      })),
      r16Predictions: Array.from({ length: 8 }, (_, i) => userData[`ko${17 + i}`] ?? null),
      qfPredictions: Array.from({ length: 4 }, (_, i) => userData[`ko${25 + i}`] ?? null),
      sfPredictions: Array.from({ length: 2 }, (_, i) => userData[`ko${29 + i}`] ?? null),
      fPredictions: [userData.ko31 ?? null],
      thirdPrediction: userData.ko32 ?? null,
      canEdit: false,
    });
  } catch (err) {
    console.error('Error fetching user knockout predictions:', err);
    res.status(500).json({ error: 'Failed to fetch user knockout predictions' });
  }
});

export default router;
