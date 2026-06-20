import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getPredictedGroupStandingsForUser, getAdvancementBonus } from '../jobs/groupStandings.js';

const router = Router();

// Get predicted group standings for a user
router.get('/groups/:groupName/standings', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { groupName } = req.params;
    const userId = req.userId!;

    if (!['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].includes(groupName.toUpperCase())) {
      res.status(400).json({ error: 'Invalid group name' });
      return;
    }

    const standings = await getPredictedGroupStandingsForUser(userId, groupName.toUpperCase());
    res.json({ groupName: groupName.toUpperCase(), standings });
  } catch (err) {
    console.error('Error fetching group standings:', err);
    res.status(500).json({ error: 'Failed to fetch group standings' });
  }
});

// Check if user predicted a team in a different group position
router.get('/groups/:groupName/check-position', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { groupName } = req.params;
    const { team, actualPosition } = req.query;
    const userId = req.userId!;

    if (!team || !actualPosition) {
      res.status(400).json({ error: 'team and actualPosition required' });
      return;
    }

    const standings = await getPredictedGroupStandingsForUser(userId, groupName.toUpperCase());
    const predicted = standings.find((s: any) => s.team === team);
    const predictedPosition = predicted?.position || null;
    const actualPos = parseInt(actualPosition as string);

    // Returns true if predicted but in different position
    const isInWrongPosition = predictedPosition !== null && predictedPosition !== actualPos;

    res.json({
      team,
      groupName: groupName.toUpperCase(),
      predictedPosition,
      actualPosition: actualPos,
      isInWrongPosition,
      advancementQualifies: predictedPosition !== null && predictedPosition <= 3,
    });
  } catch (err) {
    console.error('Error checking position:', err);
    res.status(500).json({ error: 'Failed to check position' });
  }
});

// Get advancement bonus for a list of confirmed teams
// Only counts teams in groups selected for best thirds
router.post('/advancement-bonus', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { confirmedAdvances } = req.body as { confirmedAdvances: { team: string; group: string }[] };
    const userId = req.userId!;

    if (!confirmedAdvances || !Array.isArray(confirmedAdvances)) {
      res.status(400).json({ error: 'confirmedAdvances array required' });
      return;
    }

    const result = await getAdvancementBonus(userId, confirmedAdvances);
    res.json(result);
  } catch (err) {
    console.error('Error calculating advancement bonus:', err);
    res.status(500).json({ error: 'Failed to calculate bonus' });
  }
});

export default router;
