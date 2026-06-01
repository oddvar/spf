export interface GroupMatch {
  group_name: string;
  home_team: string;
  away_team: string;
  prediction: 'H' | 'D' | 'A' | null;
}

export interface Standing {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
}

export function calcStandings(matches: GroupMatch[], group: string): Standing[] {
  const groupMatches = matches.filter((m) => m.group_name === group);
  const table = new Map<string, Standing>();

  for (const m of groupMatches) {
    for (const team of [m.home_team, m.away_team]) {
      if (!table.has(team)) table.set(team, { team, played: 0, won: 0, drawn: 0, lost: 0, points: 0 });
    }
    if (!m.prediction) continue;
    const home = table.get(m.home_team)!;
    const away = table.get(m.away_team)!;
    home.played++;
    away.played++;
    if (m.prediction === 'H') {
      home.won++; home.points += 3; away.lost++;
    } else if (m.prediction === 'D') {
      home.drawn++; home.points++; away.drawn++; away.points++;
    } else {
      away.won++; away.points += 3; home.lost++;
    }
  }

  return Array.from(table.values()).sort((a, b) => b.points - a.points || b.won - a.won);
}

/**
 * Resolves a slot label (e.g. "1A", "2B", "3ABCDF") to a team name.
 * - "1X" → 1st place in group X
 * - "2X" → 2nd place in group X
 * - "3XYZ…" → the user's best-thirds selection from those groups with the most 3rd-place points
 */
export function resolveSlot(
  slot: string,
  matches: GroupMatch[],
  bestThirdsSelections: string[],
): string {
  const pos = slot[0];
  const groups = slot.slice(1).toUpperCase();

  if (pos === '1' || pos === '2') {
    const idx = pos === '1' ? 0 : 1;
    const standings = calcStandings(matches, groups);
    return standings[idx]?.team ?? slot;
  }

  if (pos === '3') {
    // Find which of the user's best-thirds selections falls in this slot's eligible groups
    const eligible = bestThirdsSelections.filter((g) => groups.includes(g));
    if (eligible.length === 0) return `3rd (${groups.split('').join('/')})`;

    // Pick the one with the most 3rd-place points; break ties alphabetically
    const ranked = eligible
      .map((g) => ({ g, points: calcStandings(matches, g)[2]?.points ?? 0 }))
      .sort((a, b) => b.points - a.points || a.g.localeCompare(b.g));

    const best = ranked[0].g;
    return calcStandings(matches, best)[2]?.team ?? `3rd ${best}`;
  }

  return slot;
}
