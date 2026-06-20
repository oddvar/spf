import { pool } from '../db.js';

interface GroupMatch {
  id: number;
  match_number: number;
  home_team: string;
  away_team: string;
  result: 'H' | 'A' | 'D' | null;
  group_name: string;
}

function calculateGroupStandings(
  teams: string[],
  matches: GroupMatch[],
  getPrediction: (matchNumber: number) => 'H' | 'A' | 'D' | null,
): Map<string, number> {
  const standings: { [team: string]: { points: number } } = {};

  // Initialize
  for (const team of teams) {
    standings[team] = { points: 0 };
  }

  // Apply results
  for (const match of matches) {
    const prediction = getPrediction(match.match_number);
    if (!prediction) continue;

    if (prediction === 'H') {
      standings[match.home_team].points += 3;
    } else if (prediction === 'A') {
      standings[match.away_team].points += 3;
    } else if (prediction === 'D') {
      standings[match.home_team].points += 1;
      standings[match.away_team].points += 1;
    }
  }

  // Sort by points and return as map
  const sorted = Object.entries(standings)
    .sort((a, b) => b[1].points - a[1].points)
    .map(([team, data], idx) => [team, idx + 1] as [string, number]);

  return new Map(sorted);
}

async function getPredictedGroupPosition(
  userId: string,
  groupName: string,
  team: string,
): Promise<number | null> {
  try {
    // Get all group matches for this group
    const [matchRows] = await pool.execute(
      'SELECT id, match_number, home_team, away_team, result, group_name FROM matches WHERE group_name = ? ORDER BY match_datetime',
      [groupName],
    );
    const matches = matchRows as GroupMatch[];

    // Get user
    const [userRows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
    const user = (userRows as any[])[0];

    if (!user) return null;

    // Get all teams in group
    const teams = new Set<string>();
    for (const match of matches) {
      teams.add(match.home_team);
      teams.add(match.away_team);
    }

    // Build prediction getter
    const getPrediction = (matchNumber: number): 'H' | 'A' | 'D' | null => {
      const columnName = `match${matchNumber}`;
      return user[columnName] || null;
    };

    // Calculate standings
    const standings = calculateGroupStandings(Array.from(teams), matches, getPrediction);

    // Find position of team
    return standings.get(team) || null;
  } catch (err) {
    console.error('[GROUP] Error getting predicted position:', err);
    return null;
  }
}

async function calculateAndStoreGroupStandings(userId: string, groupName: string): Promise<any[]> {
  try {
    // Get all group matches
    const [matchRows] = await pool.execute(
      'SELECT id, match_number, home_team, away_team, result, group_name FROM matches WHERE group_name = ? ORDER BY match_datetime',
      [groupName],
    );
    const matches = matchRows as GroupMatch[];

    // Get user
    const [userRows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
    const user = (userRows as any[])[0];

    if (!user) return [];

    // Get all teams in group
    const teams = new Set<string>();
    for (const match of matches) {
      teams.add(match.home_team);
      teams.add(match.away_team);
    }

    // Build prediction getter
    const getPrediction = (matchNumber: number): 'H' | 'A' | 'D' | null => {
      const columnName = `match${matchNumber}`;
      return user[columnName] || null;
    };

    // Calculate standings
    const standings = calculateGroupStandings(Array.from(teams), matches, getPrediction);

    // Convert to array format
    const result = Array.from(standings.entries()).map(([team, position]) => ({
      position,
      team,
    }));

    // Store in database
    const columnName = `pred_group_${groupName.toLowerCase()}`;
    await pool.execute(`UPDATE users SET ${columnName} = ? WHERE id = ?`, [
      JSON.stringify(result),
      userId,
    ]);

    return result;
  } catch (err) {
    console.error('[GROUP] Error calculating standings:', err);
    return [];
  }
}

async function getPredictedGroupStandingsForUser(userId: string, groupName: string): Promise<any[]> {
  try {
    const columnName = `pred_group_${groupName.toLowerCase()}`;
    const [rows] = await pool.execute(`SELECT ${columnName} FROM users WHERE id = ?`, [userId]);
    const user = (rows as any[])[0];

    if (!user || !user[columnName]) {
      // Recalculate if not stored
      return calculateAndStoreGroupStandings(userId, groupName);
    }

    return JSON.parse(user[columnName]);
  } catch (err) {
    console.error('[GROUP] Error getting standings:', err);
    return [];
  }
}

async function getAdvancementBonus(userId: string, confirmedAdvances: { team: string; group: string }[]): Promise<{ bonus: number; details: Array<{ group: string; team: string; predicted: boolean }> }> {
  let bonus = 0;
  const details: Array<{ group: string; team: string; predicted: boolean }> = [];

  // Get user's best third selections
  const [userRows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
  const user = (userRows as any[])[0];

  if (!user) {
    return { bonus: 0, details: [] };
  }

  // Get selected groups
  const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const selectedGroups = GROUPS.filter((g) => user[`best_third_${g.toLowerCase()}`] === 1);

  // For each confirmed team in a selected group, check if user predicted it
  for (const { team, group } of confirmedAdvances) {
    if (selectedGroups.includes(group)) {
      try {
        const standings = await getPredictedGroupStandingsForUser(userId, group);
        // Check if user predicted this team in top 3 (positions 1, 2, or 3)
        const predicted = standings.find((s: any) => s.team === team && s.position <= 3);
        if (predicted) {
          bonus += 2;
          details.push({ group, team, predicted: true });
        } else {
          details.push({ group, team, predicted: false });
        }
      } catch (err) {
        console.error(`[GROUP] Error checking advancement for ${team}:`, err);
        details.push({ group, team, predicted: false });
      }
    }
  }

  return { bonus, details };
}

export {
  getPredictedGroupPosition,
  calculateAndStoreGroupStandings,
  getPredictedGroupStandingsForUser,
  getAdvancementBonus,
};
