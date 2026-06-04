import { pool } from '../db.js';

interface StageMatch {
  match_number: number;
  home_team: string;
  away_team: string;
  prediction: 'H' | 'A' | null;
}

// Calculate group standings from match predictions
async function calculateGroupStandings(matchPredictions: Record<number, 'H' | 'D' | 'A' | null>): Promise<Record<string, string[]>> {
  const [matchRows] = await pool.execute(
    `SELECT match_number, group_name, home_team, away_team FROM matches WHERE group_name IS NOT NULL ORDER BY match_number`,
  );

  const groups: Record<string, Array<{ team: string; points: number; gd: number }>> = {};
  for (const g of 'ABCDEFGHIJKL') {
    groups[g] = [];
  }

  // Build standings based on predictions
  for (const match of matchRows as any[]) {
    const group = match.group_name;
    const homeTeam = match.home_team;
    const awayTeam = match.away_team;
    const prediction = matchPredictions[match.match_number];

    // Ensure teams are in standings
    if (!groups[group].find((t) => t.team === homeTeam)) {
      groups[group].push({ team: homeTeam, points: 0, gd: 0 });
    }
    if (!groups[group].find((t) => t.team === awayTeam)) {
      groups[group].push({ team: awayTeam, points: 0, gd: 0 });
    }

    // Award points based on prediction
    if (prediction === 'H') {
      const home = groups[group].find((t) => t.team === homeTeam)!;
      home.points += 3;
    } else if (prediction === 'A') {
      const away = groups[group].find((t) => t.team === awayTeam)!;
      away.points += 3;
    } else if (prediction === 'D') {
      groups[group].find((t) => t.team === homeTeam)!.points += 1;
      groups[group].find((t) => t.team === awayTeam)!.points += 1;
    }
  }

  // Sort each group and return top 2
  const standings: Record<string, string[]> = {};
  for (const [group, teams] of Object.entries(groups)) {
    standings[group] = teams
      .sort((a, b) => b.points - a.points)
      .map((t) => t.team);
  }

  return standings;
}

// Get 8 best third-place teams
async function getBestThirdPlaceTeams(
  matchPredictions: Record<number, 'H' | 'D' | 'A' | null>,
  bestThirds: Record<string, number | null>,
): Promise<string[]> {
  const groupStandings = await calculateGroupStandings(matchPredictions);
  const thirdPlaceTeams: Array<{ group: string; team: string; points: number }> = [];

  for (const [group, teams] of Object.entries(groupStandings)) {
    if (teams[2]) {
      // Get points for 3rd place team (simple: count draws + wins among remaining teams)
      thirdPlaceTeams.push({ group, team: teams[2], points: 0 });
    }
  }

  // For now, return first 8 in alphabetical order (simplification)
  // TODO: Calculate actual FIFA tiebreaker rules
  return thirdPlaceTeams
    .sort((a, b) => a.team.localeCompare(b.team))
    .slice(0, 8)
    .map((t) => t.team);
}

// Resolve a position code (like "1A", "2B", "3CDFGH") to a team name
async function resolveSlot(
  slot: string,
  groupStandings: Record<string, string[]>,
  thirdPlaceTeams: string[],
): Promise<string | null> {
  if (!slot) return null;

  // Match "1A", "2B", etc.
  const simpleMatch = slot.match(/^(\d)([A-L])$/);
  if (simpleMatch) {
    const position = parseInt(simpleMatch[1]) - 1;
    const group = simpleMatch[2];
    return groupStandings[group]?.[position] || null;
  }

  // Match "3ABCDF" - third place from these groups
  if (slot.startsWith('3')) {
    const groups = slot.slice(1).split('');
    for (const g of groups) {
      const team = groupStandings[g]?.[2];
      if (team && thirdPlaceTeams.includes(team)) {
        return team;
      }
    }
  }

  return null;
}

export async function updateKnockoutProgression(userId: string): Promise<void> {
  // Fetch user's predictions and knockout matches
  const [userRows] = await pool.execute(
    `SELECT ${Array.from({ length: 72 }, (_, i) => `match${i + 1}`).join(', ')},
            ${Array.from({ length: 12 }, (_, i) => `best_third_${String.fromCharCode(65 + i).toLowerCase()}`).join(', ')},
            ${Array.from({ length: 16 }, (_, i) => `ko${i + 1}`).join(', ')}
     FROM users WHERE id = ?`,
    [userId],
  );

  if ((userRows as unknown[]).length === 0) return;

  const user = (userRows as any)[0];

  // Build prediction maps
  const matchPredictions: Record<number, 'H' | 'D' | 'A' | null> = {};
  for (let i = 1; i <= 72; i++) {
    matchPredictions[i] = user[`match${i}`] || null;
  }

  const bestThirds: Record<string, number | null> = {};
  for (let i = 0; i < 12; i++) {
    bestThirds[String.fromCharCode(65 + i)] = user[`best_third_${String.fromCharCode(97 + i)}`] || null;
  }

  const koPredictions: Record<number, 'H' | 'A' | null> = {};
  for (let i = 1; i <= 16; i++) {
    koPredictions[i] = user[`ko${i}`] || null;
  }

  // Calculate group standings and third-place teams
  const groupStandings = await calculateGroupStandings(matchPredictions);
  const thirdPlaceTeams = await getBestThirdPlaceTeams(matchPredictions, bestThirds);

  // Fetch knockout matches
  const [koRows] = await pool.execute(
    `SELECT ko_number, home_team, away_team FROM matches WHERE stage = 'r32' ORDER BY ko_number`,
  );

  const koMatches = koRows as any[];

  // Track winners at each stage
  const winners: Record<number, { home: string; away: string; winner: string | null }> = {};
  const losers: Record<number, { home: string; away: string; loser: string | null }> = {};

  for (const match of koMatches) {
    const home = await resolveSlot(match.home_team, groupStandings, thirdPlaceTeams);
    const away = await resolveSlot(match.away_team, groupStandings, thirdPlaceTeams);

    if (!home || !away) continue;

    const prediction = koPredictions[match.ko_number];
    const winner = prediction === 'H' ? home : prediction === 'A' ? away : null;
    const loser = prediction === 'H' ? away : prediction === 'A' ? home : null;

    winners[match.ko_number] = { home, away, winner };
    losers[match.ko_number] = { home, away, loser };
  }

  // Build match arrays by stage
  const r32Matches: StageMatch[] = [];
  for (const match of koMatches.slice(0, 16)) {
    const w = winners[match.ko_number];
    r32Matches.push({
      match_number: match.ko_number,
      home_team: w.home,
      away_team: w.away,
      prediction: koPredictions[match.ko_number],
    });
  }

  const r16Matches: StageMatch[] = [];
  for (const match of koMatches.slice(16, 24)) {
    const w = winners[match.ko_number];
    r16Matches.push({
      match_number: match.ko_number,
      home_team: w.home,
      away_team: w.away,
      prediction: koPredictions[match.ko_number],
    });
  }

  const qfMatches: StageMatch[] = [];
  for (const match of koMatches.slice(24, 28)) {
    const w = winners[match.ko_number];
    qfMatches.push({
      match_number: match.ko_number,
      home_team: w.home,
      away_team: w.away,
      prediction: koPredictions[match.ko_number],
    });
  }

  const sfMatches: StageMatch[] = [];
  for (const match of koMatches.slice(28, 30)) {
    const w = winners[match.ko_number];
    sfMatches.push({
      match_number: match.ko_number,
      home_team: w.home,
      away_team: w.away,
      prediction: koPredictions[match.ko_number],
    });
  }

  const finalMatch = koMatches[30];
  const fw = winners[31];
  const fMatch = fw
    ? {
        match_number: 31,
        home_team: fw.home,
        away_team: fw.away,
        prediction: koPredictions[31],
      }
    : null;

  const thirdMatch = koMatches[31];
  const tw = thirdMatch ? winners[32] : null;
  const tMatch = tw
    ? {
        match_number: 32,
        home_team: tw.home,
        away_team: tw.away,
        prediction: koPredictions[32],
      }
    : null;

  const tournamentWinner = winners[31]?.winner || null;
  const thirdPlaceWinner = winners[32]?.winner || null;

  // Update database
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
      JSON.stringify(r32Matches),
      JSON.stringify(r16Matches),
      JSON.stringify(qfMatches),
      JSON.stringify(sfMatches),
      JSON.stringify(fMatch),
      JSON.stringify(tMatch),
      tournamentWinner,
      thirdPlaceWinner,
      userId,
    ],
  );
}
