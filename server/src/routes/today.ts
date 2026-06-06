import { Router, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

interface MatchWithPredictions {
  id: number;
  match_number: number | null;
  ko_number: number | null;
  home_team: string;
  away_team: string;
  match_datetime: string;
  location: string | null;
  stage: string | null;
  predictions: Array<{
    user_id: string;
    first_name: string;
    last_name: string;
    prediction: 'H' | 'A' | 'D' | null;
  }>;
}

router.get('/today', requireAuth, async (req: AuthRequest, res: Response) => {
  const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

  try {
    // Get all matches for the given date
    const [matchRows] = await pool.execute(
      `SELECT id, match_number, ko_number, home_team, away_team, match_datetime, location, stage
       FROM matches
       WHERE DATE(match_datetime) = DATE(?)
       ORDER BY match_datetime`,
      [dateStr],
    );

    const matches = matchRows as any[];

    // For each match, get all predictions from users
    const matchesWithPredictions: MatchWithPredictions[] = [];

    for (const match of matches) {
      const predictions: MatchWithPredictions['predictions'] = [];

      if (match.match_number) {
        // Group stage match - get predictions from match{match_number} column
        const colName = `match${match.match_number}`;
        const [predRows] = await pool.execute(
          `SELECT id, first_name, last_name, ${colName} as prediction
           FROM users
           WHERE ${colName} IS NOT NULL
           ORDER BY first_name, last_name`,
        );

        for (const row of predRows as any[]) {
          predictions.push({
            user_id: row.id,
            first_name: row.first_name,
            last_name: row.last_name,
            prediction: row.prediction,
          });
        }
      } else if (match.ko_number) {
        // Knockout match - get predictions from ko{ko_number} column
        const colName = `ko${match.ko_number}`;
        const [predRows] = await pool.execute(
          `SELECT id, first_name, last_name, ${colName} as prediction
           FROM users
           WHERE ${colName} IS NOT NULL
           ORDER BY first_name, last_name`,
        );

        for (const row of predRows as any[]) {
          predictions.push({
            user_id: row.id,
            first_name: row.first_name,
            last_name: row.last_name,
            prediction: row.prediction,
          });
        }
      }

      matchesWithPredictions.push({
        id: match.id,
        match_number: match.match_number,
        ko_number: match.ko_number,
        home_team: match.home_team,
        away_team: match.away_team,
        match_datetime: (match.match_datetime as string).replace(' ', 'T') + 'Z',
        location: match.location,
        stage: match.stage,
        predictions,
      });
    }

    res.json(matchesWithPredictions);
  } catch (err) {
    console.error('Error fetching today matches:', err);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

export default router;
