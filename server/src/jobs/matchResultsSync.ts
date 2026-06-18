import { pool } from '../db.js';
import axios from 'axios';

interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: { name: string; shortName: string };
  awayTeam: { name: string; shortName: string };
  score: {
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
    fullTime: { home: number; away: number };
  };
}

interface DBMatch {
  id: number;
  match_number: number | null;
  ko_number: number | null;
  home_team: string;
  away_team: string;
  match_datetime: Date;
  stage: string | null;
}

interface QueueItem {
  match: DBMatch;
  scheduledTime: Date;
  attempt: number;
}

const API_TOKEN = process.env.FOOTBALL_DATA_API_TOKEN;
const API_BASE_URL = 'https://api.football-data.org/v4/competitions/WC/matches';
const SYNC_INTERVAL_MS = 60 * 1000; // 60 seconds

if (!API_TOKEN) {
  throw new Error('FOOTBALL_DATA_API_TOKEN environment variable is required');
}

let syncQueue: QueueItem[] = [];
let isProcessing = false;

async function getMatchResults(
  dateStr: string,
  matchLabel?: string,
): Promise<FootballDataMatch[]> {
  try {
    const logPrefix = matchLabel ? `[SYNC] Match ${matchLabel}` : '[API]';
    const url = `${API_BASE_URL}?dateFrom=${dateStr}&dateTo=${dateStr}`;
    console.log(`${logPrefix}: GET ${url}`);

    const response = await axios.get(API_BASE_URL, {
      params: {
        dateFrom: dateStr,
        dateTo: dateStr,
      },
      headers: {
        'X-Auth-Token': API_TOKEN,
      },
    });

    const responseData = response.data as any;
    console.log(`${logPrefix}: Full API response:`, JSON.stringify(responseData, null, 2));

    const matches = (responseData.matches || []) as FootballDataMatch[];
    console.log(
      `${logPrefix}: API returned successfully with ${matches.length} matches`,
    );

    if (matches.length > 0) {
      console.log(`${logPrefix}: All matches returned:`);
      matches.forEach((m: FootballDataMatch, idx: number) => {
        console.log(
          `  [${idx}] ${m.homeTeam.shortName} vs ${m.awayTeam.shortName} - Status: ${m.status}`,
        );
      });
    }

    return matches;
  } catch (err) {
    console.error(
      `${matchLabel ? `[SYNC] Match ${matchLabel}` : '[API]'}: API request failed for ${dateStr}`,
      err,
    );
    return [];
  }
}

function normalizeTeamName(name: string): string {
  let normalized = name.trim().toUpperCase();

  // Handle common team name variations
  const aliases: { [key: string]: string } = {
    'CONGO DR': 'DR CONGO',
    'DR. CONGO': 'DR CONGO',
    'DEMOCRATIC REPUBLIC OF CONGO': 'DR CONGO',
    'CÔTE D\'IVOIRE': 'IVORY COAST',
    'COTE D\'IVOIRE': 'IVORY COAST',
    'COTE DIVOIRE': 'IVORY COAST',
    'CZECH REPUBLIC': 'CZECHIA',
    'SOUTH KOREA': 'KOREA REPUBLIC',
    'KOREA REPUBLIC': 'KOREA REPUBLIC',
  };

  for (const [key, value] of Object.entries(aliases)) {
    if (normalized === key) {
      normalized = value;
    }
  }

  return normalized;
}

function mapWinnerToResult(
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null,
): 'H' | 'A' | 'D' | null {
  if (winner === 'HOME_TEAM') return 'H';
  if (winner === 'AWAY_TEAM') return 'A';
  if (winner === 'DRAW') return 'D';
  return null;
}

async function updateMatchResult(
  matchId: number,
  result: 'H' | 'A' | 'D' | null,
): Promise<void> {
  console.log(`[UPDATE] Updating match ${matchId} with result: ${result}`);

  try {
    // Get match details FIRST to determine which column to update
    const [matchRows] = await pool.execute(
      'SELECT id, match_number, ko_number FROM matches WHERE id = ?',
      [matchId],
    );

    if ((matchRows as any[]).length === 0) {
      console.log(`[UPDATE] ERROR: No match found with id ${matchId}`);
      return;
    }

    const match = (matchRows as any[])[0];
    console.log(
      `[UPDATE] Match details - ID: ${match.id}, match_number: ${match.match_number}, ko_number: ${match.ko_number}`,
    );

    // Get oddvar user
    const [oddvarRows] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      ['oddvar@geheb.com'],
    );

    if ((oddvarRows as any[]).length === 0) {
      console.log(`[UPDATE] ERROR: oddvar@geheb.com user not found`);
      return;
    }

    const oddvarId = (oddvarRows as any[])[0].id;
    console.log(`[UPDATE] Oddvar user ID: ${oddvarId}`);

    // Determine which column to update based on match type
    let columnName: string;
    if (match.match_number) {
      columnName = `match${match.match_number}`;
    } else if (match.ko_number) {
      columnName = `ko${match.ko_number}`;
    } else {
      console.log(`[UPDATE] ERROR: Match has neither match_number nor ko_number`);
      return;
    }

    console.log(
      `[UPDATE] Updating oddvar user: SET ${columnName} = '${result}' WHERE id = '${oddvarId}'`,
    );

    // Update oddvar's user prediction with the result
    const [userUpdateResult] = await pool.execute(
      `UPDATE users SET ${columnName} = ? WHERE id = ?`,
      [result, oddvarId],
    );

    console.log(
      `[UPDATE] ✓ User table update succeeded for ${columnName}:`,
      userUpdateResult,
    );

    // Also update the matches table result field
    const [matchUpdateResult] = await pool.execute(
      'UPDATE matches SET result = ? WHERE id = ?',
      [result, matchId],
    );

    console.log(`[UPDATE] ✓ Matches table update succeeded:`, matchUpdateResult);
  } catch (err) {
    console.error(`[UPDATE] ✗ Error updating match result:`, err);
  }
}

interface SyncResult {
  success: boolean;
  status?: string; // API match status (FINISHED, PAUSED, etc)
}

async function processQueueItem(item: QueueItem): Promise<SyncResult> {
  const matchLabel = String(
    item.match.match_number || `KO${item.match.ko_number}`,
  );

  try {
    const matchDateTime = new Date(item.match.match_datetime);
    const dateStr = matchDateTime.toISOString().split('T')[0];

    console.log(
      `[SYNC] Match ${matchLabel}: Match datetime: ${matchDateTime.toISOString()}, Query date: ${dateStr}`,
    );

    const apiMatches = await getMatchResults(dateStr, matchLabel);

    console.log(
      `[SYNC] Match ${matchLabel}: Searching for match with DB teams: ${item.match.home_team} vs ${item.match.away_team}`,
    );

    // Find matching game
    const matchedApiMatch = apiMatches.find((m) => {
      const apiHome = normalizeTeamName(m.homeTeam.shortName);
      const apiAway = normalizeTeamName(m.awayTeam.shortName);
      const dbHome = normalizeTeamName(item.match.home_team);
      const dbAway = normalizeTeamName(item.match.away_team);

      console.log(
        `[SYNC] Match ${matchLabel}: Comparing API "${apiHome}" vs "${apiAway}" with DB "${dbHome}" vs "${dbAway}" - Match: ${apiHome === dbHome && apiAway === dbAway}`,
      );

      return apiHome === dbHome && apiAway === dbAway;
    });

    if (matchedApiMatch && matchedApiMatch.status === 'FINISHED') {
      console.log(
        `[SYNC] Match ${matchLabel}: ✓ Found and matched: ${matchedApiMatch.homeTeam.shortName} vs ${matchedApiMatch.awayTeam.shortName} (Status: ${matchedApiMatch.status})`,
      );
      const result = mapWinnerToResult(matchedApiMatch.score.winner);
      await updateMatchResult(item.match.id, result);
      console.log(
        `[SYNC] ✓ Match ${matchLabel}: Result updated to ${result} (${matchedApiMatch.score.fullTime.home}-${matchedApiMatch.score.fullTime.away})`,
      );
      return { success: true };
    } else if (matchedApiMatch) {
      console.log(
        `[SYNC] Match ${matchLabel}: Found match but status is '${matchedApiMatch.status}' (not FINISHED yet) - Will retry in 10 minutes`,
      );
      return { success: false, status: matchedApiMatch.status };
    } else {
      console.log(
        `[SYNC] Match ${matchLabel}: Not found in API matches for date ${dateStr}`,
      );
      return { success: false };
    }
  } catch (err) {
    console.error(`[SYNC] ✗ Match ${matchLabel}: Error -`, err);
    return { success: false };
  }
}

async function processSyncQueue(): Promise<void> {
  if (isProcessing || syncQueue.length === 0) {
    return;
  }

  isProcessing = true;

  // Sort queue by scheduledTime so items waiting longest are processed first
  syncQueue.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

  // Get the first item in queue
  const item = syncQueue.shift()!;
  const now = new Date();
  const matchLabel = item.match.match_number || `KO${item.match.ko_number}`;

  // Check if scheduled time has arrived
  if (item.scheduledTime.getTime() <= now.getTime()) {
    console.log(
      `[QUEUE] Processing match ${matchLabel} (attempt ${item.attempt}) - Queue size: ${syncQueue.length + 1}`,
    );

    const syncResult = await processQueueItem(item);

    if (syncResult.success) {
      console.log(
        `[QUEUE] ✓ Match ${matchLabel} synced successfully - Removed from queue - Queue size: ${syncQueue.length}`,
      );
    } else if (syncResult.status === 'PAUSED') {
      // Match is paused, reschedule for 5 minutes from now
      const retryTime = new Date(now.getTime() + 5 * 60 * 1000);
      item.scheduledTime = retryTime;
      syncQueue.push(item);
      console.log(
        `[QUEUE] ⏸ Match ${matchLabel} is PAUSED - Rescheduled for retry at ${retryTime.toISOString()} (5 min delay) - Queue size: ${syncQueue.length}`,
      );
    } else {
      // Add back to end of queue for retry
      item.attempt += 1;
      syncQueue.push(item);
      console.log(
        `[QUEUE] ✗ Match ${matchLabel} sync failed - Added to end of queue for retry (attempt ${item.attempt}) - Queue size: ${syncQueue.length}`,
      );
    }
  } else {
    // Put back at front if scheduled time hasn't arrived
    const timeUntilSync = Math.ceil(
      (item.scheduledTime.getTime() - now.getTime()) / 1000,
    );
    syncQueue.unshift(item);
    console.log(
      `[QUEUE] Match ${matchLabel} scheduled sync in ${timeUntilSync}s - Moved to front - Queue size: ${syncQueue.length}`,
    );
  }

  isProcessing = false;
}

async function syncMatchResults(): Promise<void> {
  console.log('Starting match results sync job...');

  // Get all matches (group stage and knockout)
  const [allMatches] = await pool.execute(
    'SELECT id, match_number, ko_number, home_team, away_team, match_datetime, stage FROM matches ORDER BY match_datetime',
  );

  const dbMatches = allMatches as DBMatch[];

  // Get oddvar@geheb.com user and their predictions
  const [oddvarRows] = await pool.execute(
    'SELECT * FROM users WHERE email = ?',
    ['oddvar@geheb.com'],
  );

  if ((oddvarRows as any[]).length === 0) {
    console.log('oddvar@geheb.com user not found, skipping sync');
    return;
  }

  const oddvarUser = (oddvarRows as any[])[0];

  // Add only matches where oddvar has no result
  const skippedMatches: string[] = [];

  for (const match of dbMatches) {
    let hasResult = false;

    if (match.match_number) {
      // Check group stage match column
      const columnName = `match${match.match_number}`;
      hasResult = oddvarUser[columnName] !== null;
    } else if (match.ko_number) {
      // Check knockout match column
      const columnName = `ko${match.ko_number}`;
      hasResult = oddvarUser[columnName] !== null;
    }

    if (!hasResult) {
      const matchTime = new Date(match.match_datetime);
      const syncTime = new Date(matchTime.getTime() + 2 * 60 * 60 * 1000);

      syncQueue.push({
        match,
        scheduledTime: syncTime,
        attempt: 1,
      });
    } else {
      skippedMatches.push(String(match.match_number || `KO${match.ko_number}`));
    }
  }

  console.log(`[QUEUE] Initialized sync queue with ${syncQueue.length} matches`);
  if (skippedMatches.length > 0) {
    console.log(
      `[QUEUE] Skipped ${skippedMatches.length} matches with existing results: ${skippedMatches.join(', ')}`,
    );
  }

  // Start processing queue every 60 seconds
  console.log(
    `[QUEUE] Starting periodic sync processor (60s interval) - Queue size: ${syncQueue.length}`,
  );
  setInterval(processSyncQueue, SYNC_INTERVAL_MS);

  // Process immediately once
  await processSyncQueue();
}

export { syncMatchResults };
