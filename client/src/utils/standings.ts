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

export type CustomOrders = Record<string, string[]>;

import { THIRD_PLACE_TABLE, SLOT_COL } from './thirdPlaceTable';

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
const LS_KEY = (g: string) => `spf2026_order_${g}`;

export function loadCustomOrders(): CustomOrders {
  const result: CustomOrders = {};
  for (const g of GROUPS) {
    const raw = localStorage.getItem(LS_KEY(g));
    if (raw) try { result[g] = JSON.parse(raw); } catch { /* ignore */ }
  }
  return result;
}

export function applyCustomOrder(standings: Standing[], savedOrder: string[]): Standing[] {
  const result = [...standings];
  let i = 0;
  while (i < result.length) {
    const pts = result[i].points;
    let j = i + 1;
    while (j < result.length && result[j].points === pts) j++;
    if (j - i > 1) {
      const tieSlice = result.slice(i, j);
      tieSlice.sort((a, b) => {
        const ai = savedOrder.indexOf(a.team);
        const bi = savedOrder.indexOf(b.team);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
      result.splice(i, j - i, ...tieSlice);
    }
    i = j;
  }
  return result;
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

export function orderedStandings(
  matches: GroupMatch[],
  group: string,
  customOrders: CustomOrders = {},
): Standing[] {
  const base = calcStandings(matches, group);
  const saved = customOrders[group];
  return saved ? applyCustomOrder(base, saved) : base;
}

/**
 * Resolves a slot label (e.g. "1A", "2B", "3ABCDF") to a team name.
 * Accepts an optional customOrders map to honour user tiebreaker ordering.
 */
export function resolveSlot(
  slot: string,
  matches: GroupMatch[],
  bestThirdsSelections: string[],
  customOrders: CustomOrders = {},
): string {
  const pos = slot[0];
  const groups = slot.slice(1).toUpperCase();

  if (pos === '1' || pos === '2') {
    const idx = pos === '1' ? 0 : 1;
    return orderedStandings(matches, groups, customOrders)[idx]?.team ?? slot;
  }

  if (pos === '3') {
    if (bestThirdsSelections.length < 8) return `3rd (${groups.split('').join('/')})`;

    const key = [...bestThirdsSelections].sort().join('');
    const row = THIRD_PLACE_TABLE[key];
    const col = SLOT_COL[`3${groups}`];

    if (!row || col === undefined) return `3rd (${groups.split('').join('/')})`;

    const assignedGroup = row[col];
    return orderedStandings(matches, assignedGroup, customOrders)[2]?.team ?? `3rd ${assignedGroup}`;
  }

  return slot;
}
