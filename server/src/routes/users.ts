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
    const userIdentifier = req.params.userId;
    const [matchRows] = await pool.execute(
      `SELECT id, match_number, group_name, home_team, away_team, match_datetime, location FROM matches WHERE stage IS NULL ORDER BY match_datetime`,
    );

    // Support fetching by email (oddvar@geheb.com) or by user ID
    const isEmail = userIdentifier.includes('@');
    const [userRows] = await pool.execute(
      `SELECT can_edit, ${PRED_COLS} FROM users WHERE ${isEmail ? 'email' : 'id'} = ?`,
      [userIdentifier],
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
      canEdit: isEmail ? false : canEdit, // oddvar's predictions are read-only
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
    const userIdentifier = req.params.userId;
    const [matchRows] = await pool.execute(
      `SELECT id, match_number, group_name, home_team, away_team, match_datetime, location, result FROM matches WHERE stage IS NULL ORDER BY match_datetime`,
    );

    // Support fetching by email (oddvar@geheb.com) or by user ID
    const isEmail = userIdentifier.includes('@');
    const [userRows] = await pool.execute(
      `SELECT ${PRED_COLS}, best_third_a, best_third_b, best_third_c, best_third_d, best_third_e, best_third_f, best_third_g, best_third_h, best_third_i, best_third_j, best_third_k, best_third_l FROM users WHERE ${isEmail ? 'email' : 'id'} = ?`,
      [userIdentifier],
    );

    // Fetch pred_group_X columns separately if user has them
    let customOrders: Record<string, string[]> = {};
    try {
      // Query all groups (a-l)
      const GROUPS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
      const predGroupCols = GROUPS.map((g) => `pred_group_${g}`).join(', ');
      const [predGroupRows] = await pool.execute(
        `SELECT ${predGroupCols} FROM users WHERE ${isEmail ? 'email' : 'id'} = ?`,
        [userIdentifier],
      );
      if ((predGroupRows as any[]).length > 0) {
        const predGroupData = (predGroupRows as any[])[0];
        for (const group of GROUPS) {
          const predGroup = predGroupData[`pred_group_${group}`];
          if (predGroup) {
            const standings = typeof predGroup === 'string' ? JSON.parse(predGroup) : predGroup;
            // Sort by position to maintain correct order
            const sorted = standings.sort((a: any, b: any) => a.position - b.position);
            customOrders[group.toUpperCase()] = sorted.map((s: any) => s.team);
          }
        }
      }
    } catch (err) {
      // pred_group columns may not exist, silently continue
      console.error('Error fetching custom orders:', err);
    }

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
      customOrders: Object.keys(customOrders).length > 0 ? customOrders : undefined,
    });
  } catch (err) {
    console.error('Error fetching user best-thirds:', err);
    res.status(500).json({ error: 'Failed to fetch user best-thirds' });
  }
});

router.get('/users/:userId/knockout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userIdentifier = req.params.userId;
    const [matchRows] = await pool.execute(
      `SELECT id, ko_number, home_team, away_team, match_datetime, location FROM matches WHERE stage = 'r32' ORDER BY match_datetime`,
    );

    // Support fetching by email (oddvar@geheb.com) or by user ID
    const isEmail = userIdentifier.includes('@');
    const [userRows] = await pool.execute(
      `SELECT ko1, ko2, ko3, ko4, ko5, ko6, ko7, ko8, ko9, ko10, ko11, ko12, ko13, ko14, ko15, ko16, ko17, ko18, ko19, ko20, ko21, ko22, ko23, ko24, ko25, ko26, ko27, ko28, ko29, ko30, ko31, ko32, ko_r32_matches FROM users WHERE ${isEmail ? 'email' : 'id'} = ?`,
      [userIdentifier],
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

    // Try to use saved ko_r32_matches first (has resolved team names)
    let r32Predictions: any[];
    const savedMatches = userData.ko_r32_matches
      ? (typeof userData.ko_r32_matches === 'string' ? JSON.parse(userData.ko_r32_matches) : userData.ko_r32_matches)
      : null;

    if (Array.isArray(savedMatches) && savedMatches.length > 0 && savedMatches[0]?.home_team && savedMatches[0]?.away_team) {
      // Use saved matches - they have pre-resolved team names
      const matchMap = new Map((matchRows as any[]).map((m) => [m.ko_number, m]));
      r32Predictions = savedMatches.map((saved: any) => {
        const dbMatch = matchMap.get(saved.match_number);
        return {
          id: dbMatch?.id,
          ko_number: dbMatch?.ko_number,
          home_team: saved.home_team,
          away_team: saved.away_team,
          match_datetime: dbMatch ? normalise(dbMatch).match_datetime : null,
          location: dbMatch?.location || null,
          prediction: userData[`ko${saved.match_number}`] ?? null,
        };
      });
    } else {
      // Fallback to slot codes from database
      const [teamRows] = await pool.execute(
        `SELECT name, active FROM teams WHERE name IN (${(matchRows as any[]).map(() => '?').join(',')})`,
        (matchRows as any[]).flatMap((m) => [m.home_team, m.away_team]),
      );
      const teamActiveMap: { [key: string]: boolean } = {};
      for (const team of teamRows as any[]) {
        teamActiveMap[team.name] = team.active === 1;
      }

      r32Predictions = (matchRows as any[]).map((m) => ({
        ...normalise(m),
        prediction: userData[`ko${m.ko_number}`] ?? null,
        homeTeamActive: teamActiveMap[m.home_team] !== false,
        awayTeamActive: teamActiveMap[m.away_team] !== false,
      }));
    }

    res.json({
      r32Predictions,
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
