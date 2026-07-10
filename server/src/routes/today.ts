import { Router, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

interface Prediction {
  user_id: string;
  first_name: string;
  last_name: string;
  prediction: 'H' | 'A' | 'D' | null;
}

interface MatchWithPredictions {
  id: number;
  match_number: number | null;
  ko_number: number | null;
  home_team: string;
  away_team: string;
  match_datetime: string;
  location: string | null;
  stage: string | null;
  result: 'H' | 'D' | 'A' | null;
  predictions: Prediction[];
  nextStageInfo?: {
    nextStagePredictions: {
      home: Prediction[];
      away: Prediction[];
    };
  };
  resolvedHomeTeam?: string;
  resolvedAwayTeam?: string;
}

// Helper: Get next stage match number and slot (home/away) for a ko_number
function getNextStageInfo(ko_number: number, stage: string | null): { nextKoNumber: number; slot: 'H' | 'A' } | null {
  if (stage === 'r32') {
    // R32 M1-2 → R16 M17, M1 home, M2 away
    // R32 M3-4 → R16 M18, M3 home, M4 away, etc.
    const r16Match = 17 + Math.floor((ko_number - 1) / 2);
    const slot: 'H' | 'A' = (ko_number - 1) % 2 === 0 ? 'H' : 'A';
    return { nextKoNumber: r16Match, slot };
  } else if (stage === 'r16') {
    // R16 M17-18 → QF M25, M17 home, M18 away
    // R16 M19-20 → QF M26, M19 home, M20 away, etc.
    const qfMatch = 25 + Math.floor((ko_number - 17) / 2);
    const slot: 'H' | 'A' = (ko_number - 17) % 2 === 0 ? 'H' : 'A';
    return { nextKoNumber: qfMatch, slot };
  } else if (stage === 'qf') {
    // QF M25-26 → SF M29, M25 home, M26 away
    // QF M27-28 → SF M30, M27 home, M28 away
    const sfMatch = 29 + Math.floor((ko_number - 25) / 2);
    const slot: 'H' | 'A' = (ko_number - 25) % 2 === 0 ? 'H' : 'A';
    return { nextKoNumber: sfMatch, slot };
  } else if (stage === 'sf') {
    // SF M29-30 → Final M31, M29 home, M30 away
    const slot: 'H' | 'A' = ko_number === 29 ? 'H' : 'A';
    return { nextKoNumber: 31, slot };
  }
  return null;
}

router.get('/today', requireAuth, async (req: AuthRequest, res: Response) => {
  const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

  try {
    // Get all matches for the given date
    const [matchRows] = await pool.execute(
      `SELECT id, match_number, ko_number, home_team, away_team, match_datetime, location, stage, result
       FROM matches
       WHERE DATE(match_datetime) = DATE(?)
       ORDER BY match_datetime`,
      [dateStr],
    );

    // Get oddvar@geheb.com's resolved knockout matches for team name lookups
    const [oddvarRows] = await pool.execute(
      `SELECT ko_r32_matches, ko_r16_matches, ko_qf_matches, ko_sf_matches, ko_f_match, ko_third_match
       FROM users WHERE email = ?`,
      ['oddvar@geheb.com'],
    );
    const oddvarData = (oddvarRows as any[])[0] || {};
    const resolvedMatches: Record<number, { home_team: string; away_team: string }> = {};

    // Parse resolved match data and index by ko_number
    const parseMatches = (jsonStr: string | null | any) => {
      if (!jsonStr) return [];
      if (typeof jsonStr === 'string') {
        try {
          return JSON.parse(jsonStr);
        } catch {
          return [];
        }
      }
      return Array.isArray(jsonStr) ? jsonStr : [];
    };

    const r32Matches = parseMatches(oddvarData.ko_r32_matches);
    const r16Matches = parseMatches(oddvarData.ko_r16_matches);
    const qfMatches = parseMatches(oddvarData.ko_qf_matches);
    const sfMatches = parseMatches(oddvarData.ko_sf_matches);
    const fMatch = parseMatches(oddvarData.ko_f_match);
    const tpMatch = parseMatches(oddvarData.ko_third_match);

    // Index by match_number (which is the ko_number)
    [...r32Matches, ...r16Matches, ...qfMatches, ...sfMatches, ...(Array.isArray(fMatch) ? fMatch : [fMatch]), ...(Array.isArray(tpMatch) ? tpMatch : [tpMatch])].forEach(
      (match: any) => {
        if (match?.match_number) {
          resolvedMatches[match.match_number] = {
            home_team: match.home_team,
            away_team: match.away_team,
          };
        }
      },
    );

    const matches = matchRows as any[];

    // For each match, get all predictions from users
    const matchesWithPredictions: MatchWithPredictions[] = [];

    for (const match of matches) {
      const predictions: MatchWithPredictions['predictions'] = [];
      let nextStageInfo: MatchWithPredictions['nextStageInfo'] | undefined;
      let resultFromOddvar: string | null = null;

      if (match.match_number) {
        // Group stage match - get predictions from match{match_number} column
        const colName = `match${match.match_number}`;
        const [predRows] = await pool.execute(
          `SELECT id, first_name, last_name, ${colName} as prediction
           FROM users
           WHERE ${colName} IS NOT NULL AND active = 1 AND email != ?
           ORDER BY first_name, last_name`,
          ['oddvar@geheb.com'],
        );

        for (const row of predRows as any[]) {
          predictions.push({
            user_id: row.id,
            first_name: row.first_name,
            last_name: row.last_name,
            prediction: row.prediction,
          });
        }

        // Get result from oddvar@geheb.com's prediction
        const [resultRows] = await pool.execute(
          `SELECT ${colName} as result FROM users WHERE email = ?`,
          ['oddvar@geheb.com'],
        );
        if ((resultRows as any[]).length > 0) {
          resultFromOddvar = (resultRows as any[])[0].result || null;
        }
      } else if (match.ko_number) {
        // Knockout match - get predictions from ko{ko_number} column
        const colName = `ko${match.ko_number}`;
        const [predRows] = await pool.execute(
          `SELECT id, first_name, last_name, ${colName} as prediction
           FROM users
           WHERE ${colName} IS NOT NULL AND active = 1 AND email != ?
           ORDER BY first_name, last_name`,
          ['oddvar@geheb.com'],
        );

        for (const row of predRows as any[]) {
          predictions.push({
            user_id: row.id,
            first_name: row.first_name,
            last_name: row.last_name,
            prediction: row.prediction,
          });
        }

        // Get result from oddvar@geheb.com's prediction
        const [resultRows] = await pool.execute(
          `SELECT ${colName} as result FROM users WHERE email = ?`,
          ['oddvar@geheb.com'],
        );
        if ((resultRows as any[]).length > 0) {
          resultFromOddvar = (resultRows as any[])[0].result || null;
        }

        // For R32, R16, QF, and SF matches, show users based on their next-stage match predictions
        if (match.stage === 'r32' || match.stage === 'r16' || match.stage === 'qf' || match.stage === 'sf') {
          const currentResolvedHome = resolvedMatches[match.ko_number]?.home_team;
          const currentResolvedAway = resolvedMatches[match.ko_number]?.away_team;

          if (currentResolvedHome && currentResolvedAway) {
            // For R32: fetch users' R16 matches; for R16: fetch users' QF matches; for QF: fetch users' SF matches; for SF: fetch users' Final match
            const column = match.stage === 'r32' ? 'ko_r16_matches' : match.stage === 'r16' ? 'ko_qf_matches' : match.stage === 'qf' ? 'ko_sf_matches' : 'ko_f_match';
            const [usersWithNextMatches] = await pool.execute(
              `SELECT id, first_name, last_name, ${column} FROM users
               WHERE active = 1 AND email != ? AND ${column} IS NOT NULL`,
              ['oddvar@geheb.com'],
            );

            const homeUsers: Prediction[] = [];
            const awayUsers: Prediction[] = [];

            for (const user of usersWithNextMatches as any[]) {
              try {
                let nextData = typeof user[column] === 'string'
                  ? JSON.parse(user[column])
                  : user[column];

                // Convert single object to array for consistent handling
                if (nextData && !Array.isArray(nextData)) {
                  nextData = [nextData];
                }

                if (!Array.isArray(nextData)) continue;

                // Check if user has the current home_team or away_team anywhere in their next stage matches
                const hasHomeTeam = nextData.some((m: any) => m.home_team === currentResolvedHome || m.away_team === currentResolvedHome);
                const hasAwayTeam = nextData.some((m: any) => m.home_team === currentResolvedAway || m.away_team === currentResolvedAway);

                if (hasHomeTeam) {
                  homeUsers.push({
                    user_id: user.id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    prediction: null,
                  });
                }
                if (hasAwayTeam) {
                  awayUsers.push({
                    user_id: user.id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    prediction: null,
                  });
                }
              } catch (err) {
                // Skip users with invalid next stage data
              }
            }

            if (homeUsers.length > 0 || awayUsers.length > 0) {
              nextStageInfo = {
                nextStagePredictions: {
                  home: homeUsers,
                  away: awayUsers,
                },
              };
            }
          }
        }
      }

      const matchData: MatchWithPredictions = {
        id: match.id,
        match_number: match.match_number,
        ko_number: match.ko_number,
        home_team: match.home_team,
        away_team: match.away_team,
        match_datetime: (match.match_datetime as string).replace(' ', 'T') + 'Z',
        location: match.location,
        stage: match.stage,
        result: resultFromOddvar as 'H' | 'D' | 'A' | null,
        predictions,
      };

      if (nextStageInfo) {
        matchData.nextStageInfo = nextStageInfo;
      }

      // Add resolved team names if available for knockout matches
      if (match.ko_number && resolvedMatches[match.ko_number]) {
        matchData.resolvedHomeTeam = resolvedMatches[match.ko_number].home_team;
        matchData.resolvedAwayTeam = resolvedMatches[match.ko_number].away_team;
      }

      matchesWithPredictions.push(matchData);
    }

    res.json(matchesWithPredictions);
  } catch (err) {
    console.error('Error fetching today matches:', err);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

export default router;
