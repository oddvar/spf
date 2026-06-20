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
  r16Score: number;
  qfScore: number;
  sfScore: number;
  finalScore: number;
  thirdPlaceScore: number;
  winnerScore: number;
  totalScore: number;
  maxPossibleScore: number;
  koWinner: string | null;
}

interface RankingResponse {
  rankings: UserRanking[];
  maxMatchesWithResults: number;
}

router.get('/ranking', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cutoffParam = req.query.cutoff ? parseInt(req.query.cutoff as string) : null;
    const cutoff = cutoffParam && !isNaN(cutoffParam) ? cutoffParam : null;
    const limitCount = cutoff || 72;

    // Get group stage matches ordered by datetime
    const [matchRows] = await pool.execute(
      `SELECT match_number FROM matches WHERE stage IS NULL ORDER BY match_datetime LIMIT ${limitCount}`
    );
    const cutoffMatchNumbers = new Set((matchRows as any[]).map((m) => m.match_number));

    // Get all active users except oddvar@geheb.com
    const predCols = Array.from({ length: MATCH_COUNT }, (_, i) => `match${i + 1}`).join(', ');
    const [userRows] = await pool.execute(
      `SELECT id, first_name, last_name, payment_status, email, ko_winner, ${predCols} FROM users WHERE email != ? AND active = 1 ORDER BY first_name, last_name`,
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
      for (let i = 1; i <= 16; i++) {
        const userPred = user[`ko${i}`];
        const correctPred = oddvarData[`ko${i}`];
        if (userPred && correctPred && userPred === correctPred) {
          r32Score += 2;
        }
      }

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

      // Advancement bonus: 2 points per correct team advancement (in groups user selected for best thirds)
      // Get confirmed advances from oddvar's r32 predictions and group standings
      const confirmedAdvances: { team: string; group: string }[] = [];

      // Get oddvar's group standings to map position codes to actual teams
      const oddvarGroupStandings: { [key: string]: any[] } = {};
      for (const groupLetter of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
        const columnName = `pred_group_${groupLetter.toLowerCase()}`;
        const standing = oddvarData[columnName];
        if (standing) {
          oddvarGroupStandings[groupLetter] = JSON.parse(standing);
        }
      }

      // Check which r32 matches oddvar has predictions for
      // For each position code (1A, 2B, etc.), get the actual team from group standings
      const positionCodeMap: { [key: string]: string } = {
        '1A': 'A', '2A': 'A', '3A': 'A',
        '1B': 'B', '2B': 'B', '3B': 'B',
        '1C': 'C', '2C': 'C', '3C': 'C',
        '1D': 'D', '2D': 'D', '3D': 'D',
        '1E': 'E', '2E': 'E', '3E': 'E',
        '1F': 'F', '2F': 'F', '3F': 'F',
        '1G': 'G', '2G': 'G', '3G': 'G',
        '1H': 'H', '2H': 'H', '3H': 'H',
      };

      // Get r32 matches to identify position codes
      const [r32Rows] = await pool.execute(
        'SELECT id, ko_number, home_team, away_team FROM matches WHERE stage = ? AND ko_number BETWEEN 1 AND 16',
        ['r32'],
      );

      for (const match of r32Rows as any[]) {
        const koNum = match.ko_number;
        if (oddvarData[`ko${koNum}`]) {
          // Oddvar has made a prediction for this match
          const homeTeam = match.home_team;
          const awayTeam = match.away_team;
          const prediction = oddvarData[`ko${koNum}`];

          // Get the winning team based on prediction
          const positionCode = prediction === 'H' ? homeTeam : awayTeam;
          const groupLetter = positionCodeMap[positionCode];

          if (groupLetter && oddvarGroupStandings[groupLetter]) {
            const standings = oddvarGroupStandings[groupLetter];
            const positionNum = parseInt(positionCode[0]);
            const teamStanding = standings.find((s: any) => s.position === positionNum);

            if (teamStanding) {
              confirmedAdvances.push({ team: teamStanding.team, group: groupLetter });
            }
          }
        }
      }

      const advancementResult = await getAdvancementBonus(user.id, confirmedAdvances);
      const advancementBonus = advancementResult.bonus;

      const totalScore = groupStageScore + r32Score + r16Score + qfScore + sfScore + finalScore + thirdPlaceScore + winnerScore + advancementBonus;

      rankings.push({
        user_id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        paymentStatus: user.payment_status,
        groupStageScore,
        r32Score,
        r16Score,
        qfScore,
        sfScore,
        finalScore,
        thirdPlaceScore,
        winnerScore,
        totalScore,
        maxPossibleScore: totalMaxPossibleScore,
        koWinner: user.ko_winner || null,
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
