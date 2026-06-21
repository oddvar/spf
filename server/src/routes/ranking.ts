import { Router, Response } from 'express';
import { pool, MATCH_COUNT } from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getAdvancementBonus } from '../jobs/groupStandings.js';

const router = Router();

interface UserRanking {
  user_id: string;
  first_name: string;
  last_name: string;
  paymentStatus: 'NO' | 'WANTS_TO_PAY' | 'HAS_PAID';
  groupStageScore: number;
  r32Score: number;
  advancementScore: number;
  r16Score: number;
  qfScore: number;
  sfScore: number;
  finalScore: number;
  thirdPlaceScore: number;
  winnerScore: number;
  totalScore: number;
  maxPossibleScore: number;
  koWinner: string | null;
  koWinnerActive: boolean | null;
}

interface RankingResponse {
  rankings: UserRanking[];
  maxMatchesWithResults: number;
}

router.get('/ranking', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cutoffParam = req.query.cutoff as string | undefined;
    let cutoff: number | null = null;
    let includeKnockout = false;

    if (cutoffParam === 'all+r32' || cutoffParam === 'all r32') {
      cutoff = null;
      includeKnockout = true;
    } else if (cutoffParam) {
      const parsed = parseInt(cutoffParam);
      cutoff = !isNaN(parsed) ? parsed : null;
      includeKnockout = false;
    }

    const limitCount = cutoff || 72;

    // Get group stage matches ordered by datetime
    const [matchRows] = await pool.execute(
      `SELECT match_number FROM matches WHERE stage IS NULL ORDER BY match_datetime LIMIT ${limitCount}`
    );
    const cutoffMatchNumbers = new Set((matchRows as any[]).map((m) => m.match_number));

    // Get all active users except oddvar@geheb.com
    const predCols = Array.from({ length: MATCH_COUNT }, (_, i) => `match${i + 1}`).join(', ');
    const [userRows] = await pool.execute(
      `SELECT id, first_name, last_name, payment_status, email, ko_winner, ko_r32_matches, ko_r16_matches, ko_qf_matches, ko_sf_matches, ko_f_match, ko_third_match, ${predCols} FROM users WHERE email != ? AND active = 1 ORDER BY first_name, last_name`,
      ['oddvar@geheb.com'],
    );

    // Get oddvar@geheb.com's predictions (the correct answers)
    const [oddvarRows] = await pool.execute(
      `SELECT * FROM users WHERE email = ?`,
      ['oddvar@geheb.com'],
    );
    const oddvarData = (oddvarRows as any[])[0];

    if (!oddvarData) {
      res.status(500).json({ error: 'Reference user not found' });
      return;
    }

    // Calculate max possible score based on oddvar's predictions
    let maxGroupStageScore = 0;
    let maxR32Score = 0;
    let maxR16Score = 0;
    let maxQFScore = 0;
    let maxSFScore = 0;
    let maxFinalScore = 0;
    let maxThirdPlaceScore = 0;
    let maxWinnerScore = 0;

    // Count group stage predictions that have been set in oddvar's data
    if (cutoff) {
      for (const matchNum of cutoffMatchNumbers) {
        if (oddvarData[`match${matchNum}`]) {
          maxGroupStageScore += 1;
        }
      }
    } else {
      for (let i = 1; i <= 72; i++) {
        if (oddvarData[`match${i}`]) {
          maxGroupStageScore += 1;
        }
      }
    }

    // Count R32 predictions
    for (let i = 1; i <= 16; i++) {
      if (oddvarData[`ko${i}`]) {
        maxR32Score += 2;
      }
    }

    // Count R16 predictions
    for (let i = 17; i <= 24; i++) {
      if (oddvarData[`ko${i}`]) {
        maxR16Score += 3;
      }
    }

    // Count QF predictions
    for (let i = 25; i <= 28; i++) {
      if (oddvarData[`ko${i}`]) {
        maxQFScore += 4;
      }
    }

    // Count SF predictions
    for (let i = 29; i <= 30; i++) {
      if (oddvarData[`ko${i}`]) {
        maxSFScore += 5;
      }
    }

    // Final
    if (oddvarData.ko31) {
      maxFinalScore = 6;
    }

    // Third place
    if (oddvarData.ko32) {
      maxThirdPlaceScore = 7;
    }

    // Winner
    if (oddvarData.ko_winner) {
      maxWinnerScore = 15;
    }

    const totalMaxPossibleScore = maxGroupStageScore + maxR32Score + maxR16Score + maxQFScore + maxSFScore + maxFinalScore + maxThirdPlaceScore + maxWinnerScore;

    const rankings: UserRanking[] = [];

    // Calculate score for each user
    for (const user of userRows as any[]) {
      let groupStageScore = 0;
      let r32Score = 0;
      let r16Score = 0;
      let qfScore = 0;
      let sfScore = 0;
      let finalScore = 0;
      let thirdPlaceScore = 0;
      let winnerScore = 0;

      // Group stage: 1 point per correct prediction (only matches oddvar has set)
      if (cutoff) {
        for (const matchNum of cutoffMatchNumbers) {
          const userPred = user[`match${matchNum}`];
          const correctPred = oddvarData[`match${matchNum}`];
          if (userPred && correctPred && userPred === correctPred) {
            groupStageScore += 1;
          }
        }
      } else {
        for (let i = 1; i <= 72; i++) {
          const userPred = user[`match${i}`];
          const correctPred = oddvarData[`match${i}`];
          if (userPred && correctPred && userPred === correctPred) {
            groupStageScore += 1;
          }
        }
      }

      // R32: 2 points per correct prediction (16 matches, ko1-ko16)
      if (includeKnockout) {
        for (let i = 1; i <= 16; i++) {
          const userPred = user[`ko${i}`];
          const correctPred = oddvarData[`ko${i}`];
          if (userPred && correctPred && userPred === correctPred) {
            r32Score += 2;
          }
        }
      }

      // R16+: only calculate if including knockout stages
      if (includeKnockout) {
        // R16: 3 points per correct prediction (8 matches, ko17-ko24)
        for (let i = 17; i <= 24; i++) {
          const userPred = user[`ko${i}`];
          const correctPred = oddvarData[`ko${i}`];
          if (userPred && correctPred && userPred === correctPred) {
            r16Score += 3;
          }
        }

        // QF: 4 points per correct prediction (4 matches, ko25-ko28)
        for (let i = 25; i <= 28; i++) {
          const userPred = user[`ko${i}`];
          const correctPred = oddvarData[`ko${i}`];
          if (userPred && correctPred && userPred === correctPred) {
            qfScore += 4;
          }
        }

        // SF: 5 points per correct prediction (2 matches, ko29-ko30)
        for (let i = 29; i <= 30; i++) {
          const userPred = user[`ko${i}`];
          const correctPred = oddvarData[`ko${i}`];
          if (userPred && correctPred && userPred === correctPred) {
            sfScore += 5;
          }
        }

        // Final: 6 points (ko31)
        if (user.ko31 && oddvarData.ko31 && user.ko31 === oddvarData.ko31) {
          finalScore = 6;
        }

        // Third place: 7 points (ko32)
        if (user.ko32 && oddvarData.ko32 && user.ko32 === oddvarData.ko32) {
          thirdPlaceScore = 7;
        }

        // Winner: 15 points (based on ko_winner)
        if (user.ko_winner && oddvarData.ko_winner && user.ko_winner === oddvarData.ko_winner) {
          winnerScore = 15;
        }
      }

      // Advancement bonus: award points for correctly predicting teams that advance
      let advancementScore = 0;
      if (includeKnockout) {
        // Parse r32 matches
        const userKoR32 = user.ko_r32_matches ? (typeof user.ko_r32_matches === 'string' ? JSON.parse(user.ko_r32_matches) : user.ko_r32_matches) : null;
        const oddvarKoR32 = oddvarData.ko_r32_matches ? (typeof oddvarData.ko_r32_matches === 'string' ? JSON.parse(oddvarData.ko_r32_matches) : oddvarData.ko_r32_matches) : null;

        if (userKoR32 && oddvarKoR32) {
          // Collect all teams from oddvar's r32 matches
          const oddvarTeams = new Set<string>();
          for (const m of oddvarKoR32 as any[]) {
            if (m.home_team) oddvarTeams.add(m.home_team);
            if (m.away_team) oddvarTeams.add(m.away_team);
          }

          // Award 2 points for each user team that appears in oddvar's teams
          for (const m of userKoR32 as any[]) {
            if (m.home_team && oddvarTeams.has(m.home_team)) {
              advancementScore += 2;
            }
            if (m.away_team && oddvarTeams.has(m.away_team)) {
              advancementScore += 2;
            }
          }
        }
      }

      const totalScore = groupStageScore + r32Score + advancementScore + r16Score + qfScore + sfScore + finalScore + thirdPlaceScore + winnerScore;

      // Check if ko_winner team is active
      let koWinnerActive: boolean | null = null;
      if (user.ko_winner) {
        try {
          const [teamRows] = await pool.execute(
            'SELECT active FROM teams WHERE name = ?',
            [user.ko_winner],
          );
          if ((teamRows as any[]).length > 0) {
            koWinnerActive = (teamRows as any[])[0].active === 1;
          }
        } catch (err) {
          console.error('Error checking team active status:', err);
        }
      }

      rankings.push({
        user_id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        paymentStatus: user.payment_status,
        groupStageScore,
        r32Score,
        advancementScore,
        r16Score,
        qfScore,
        sfScore,
        finalScore,
        thirdPlaceScore,
        winnerScore,
        totalScore,
        maxPossibleScore: totalMaxPossibleScore,
        koWinner: user.ko_winner || null,
        koWinnerActive,
      });
    }

    // Sort by total score descending, then by last name ascending
    rankings.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return a.last_name.localeCompare(b.last_name);
    });

    // Count how many matches oddvar has predictions for
    let maxMatchesWithResults = 0;
    for (let i = 1; i <= 72; i++) {
      if (oddvarData[`match${i}`]) {
        maxMatchesWithResults += 1;
      }
    }

    res.json({
      rankings,
      maxMatchesWithResults,
    });
  } catch (err) {
    console.error('Error fetching ranking:', err);
    res.status(500).json({ error: 'Failed to fetch ranking' });
  }
});

export default router;
