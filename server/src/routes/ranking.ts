import { Router, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

interface UserRanking {
  user_id: string;
  first_name: string;
  last_name: string;
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
}

router.get('/ranking', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Get all active users except oddvar@geheb.com
    const [userRows] = await pool.execute(
      `SELECT id, first_name, last_name, email FROM users WHERE email != ? AND active = 1 ORDER BY first_name, last_name`,
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

    // Count group stage predictions
    for (let i = 1; i <= 72; i++) {
      if (oddvarData[`match${i}`]) {
        maxGroupStageScore += 1;
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

      // Group stage: 1 point per correct prediction (72 matches)
      for (let i = 1; i <= 72; i++) {
        const userPred = user[`match${i}`];
        const correctPred = oddvarData[`match${i}`];
        if (userPred && correctPred && userPred === correctPred) {
          groupStageScore += 1;
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

      const totalScore = groupStageScore + r32Score + r16Score + qfScore + sfScore + finalScore + thirdPlaceScore + winnerScore;

      rankings.push({
        user_id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
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
      });
    }

    // Sort by total score descending, then by last name ascending
    rankings.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return a.last_name.localeCompare(b.last_name);
    });

    res.json(rankings);
  } catch (err) {
    console.error('Error fetching ranking:', err);
    res.status(500).json({ error: 'Failed to fetch ranking' });
  }
});

export default router;
