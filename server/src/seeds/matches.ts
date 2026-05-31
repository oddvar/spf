import { pool } from '../db.js';

const MATCHES = [
  // Group A
  { n: 1,  g: 'A', home: 'Mexico',      away: 'South Africa', date: '2026-06-11' },
  { n: 2,  g: 'A', home: 'South Korea', away: 'Czechia',      date: '2026-06-11' },
  { n: 3,  g: 'A', home: 'Czechia',     away: 'South Africa', date: '2026-06-18' },
  { n: 4,  g: 'A', home: 'Mexico',      away: 'South Korea',  date: '2026-06-18' },
  { n: 5,  g: 'A', home: 'Czechia',     away: 'Mexico',       date: '2026-06-24' },
  { n: 6,  g: 'A', home: 'South Africa',away: 'South Korea',  date: '2026-06-24' },
  // Group B
  { n: 7,  g: 'B', home: 'Canada',               away: 'Bosnia and Herzegovina', date: '2026-06-12' },
  { n: 8,  g: 'B', home: 'Qatar',                away: 'Switzerland',            date: '2026-06-13' },
  { n: 9,  g: 'B', home: 'Switzerland',          away: 'Bosnia and Herzegovina', date: '2026-06-18' },
  { n: 10, g: 'B', home: 'Canada',               away: 'Qatar',                  date: '2026-06-18' },
  { n: 11, g: 'B', home: 'Switzerland',          away: 'Canada',                 date: '2026-06-24' },
  { n: 12, g: 'B', home: 'Bosnia and Herzegovina', away: 'Qatar',                date: '2026-06-24' },
  // Group C
  { n: 13, g: 'C', home: 'Brazil',   away: 'Morocco',  date: '2026-06-13' },
  { n: 14, g: 'C', home: 'Haiti',    away: 'Scotland', date: '2026-06-13' },
  { n: 15, g: 'C', home: 'Scotland', away: 'Morocco',  date: '2026-06-19' },
  { n: 16, g: 'C', home: 'Brazil',   away: 'Haiti',    date: '2026-06-19' },
  { n: 17, g: 'C', home: 'Scotland', away: 'Brazil',   date: '2026-06-24' },
  { n: 18, g: 'C', home: 'Morocco',  away: 'Haiti',    date: '2026-06-24' },
  // Group D
  { n: 19, g: 'D', home: 'USA',       away: 'Paraguay',  date: '2026-06-12' },
  { n: 20, g: 'D', home: 'Australia', away: 'Turkiye',   date: '2026-06-13' },
  { n: 21, g: 'D', home: 'USA',       away: 'Australia', date: '2026-06-19' },
  { n: 22, g: 'D', home: 'Turkiye',   away: 'Paraguay',  date: '2026-06-19' },
  { n: 23, g: 'D', home: 'Turkiye',   away: 'USA',       date: '2026-06-25' },
  { n: 24, g: 'D', home: 'Paraguay',  away: 'Australia', date: '2026-06-25' },
  // Group E
  { n: 25, g: 'E', home: 'Germany',      away: 'Curacao',       date: '2026-06-14' },
  { n: 26, g: 'E', home: 'Ivory Coast',  away: 'Ecuador',       date: '2026-06-14' },
  { n: 27, g: 'E', home: 'Germany',      away: 'Ivory Coast',   date: '2026-06-20' },
  { n: 28, g: 'E', home: 'Ecuador',      away: 'Curacao',       date: '2026-06-20' },
  { n: 29, g: 'E', home: 'Ecuador',      away: 'Germany',       date: '2026-06-25' },
  { n: 30, g: 'E', home: 'Curacao',      away: 'Ivory Coast',   date: '2026-06-25' },
  // Group F
  { n: 31, g: 'F', home: 'Netherlands', away: 'Japan',       date: '2026-06-14' },
  { n: 32, g: 'F', home: 'Sweden',      away: 'Tunisia',     date: '2026-06-14' },
  { n: 33, g: 'F', home: 'Netherlands', away: 'Sweden',      date: '2026-06-20' },
  { n: 34, g: 'F', home: 'Tunisia',     away: 'Japan',       date: '2026-06-20' },
  { n: 35, g: 'F', home: 'Japan',       away: 'Sweden',      date: '2026-06-25' },
  { n: 36, g: 'F', home: 'Tunisia',     away: 'Netherlands', date: '2026-06-25' },
  // Group G
  { n: 37, g: 'G', home: 'Iran',        away: 'New Zealand', date: '2026-06-15' },
  { n: 38, g: 'G', home: 'Belgium',     away: 'Egypt',       date: '2026-06-15' },
  { n: 39, g: 'G', home: 'Belgium',     away: 'Iran',        date: '2026-06-21' },
  { n: 40, g: 'G', home: 'New Zealand', away: 'Egypt',       date: '2026-06-21' },
  { n: 41, g: 'G', home: 'Egypt',       away: 'Iran',        date: '2026-06-26' },
  { n: 42, g: 'G', home: 'New Zealand', away: 'Belgium',     date: '2026-06-26' },
  // Group H
  { n: 43, g: 'H', home: 'Spain',       away: 'Cape Verde',  date: '2026-06-15' },
  { n: 44, g: 'H', home: 'Saudi Arabia',away: 'Uruguay',     date: '2026-06-15' },
  { n: 45, g: 'H', home: 'Spain',       away: 'Saudi Arabia',date: '2026-06-21' },
  { n: 46, g: 'H', home: 'Uruguay',     away: 'Cape Verde',  date: '2026-06-21' },
  { n: 47, g: 'H', home: 'Cape Verde',  away: 'Saudi Arabia',date: '2026-06-26' },
  { n: 48, g: 'H', home: 'Uruguay',     away: 'Spain',       date: '2026-06-26' },
  // Group I
  { n: 49, g: 'I', home: 'France',  away: 'Senegal', date: '2026-06-16' },
  { n: 50, g: 'I', home: 'Iraq',    away: 'Norway',  date: '2026-06-16' },
  { n: 51, g: 'I', home: 'France',  away: 'Iraq',    date: '2026-06-22' },
  { n: 52, g: 'I', home: 'Norway',  away: 'Senegal', date: '2026-06-22' },
  { n: 53, g: 'I', home: 'Norway',  away: 'France',  date: '2026-06-26' },
  { n: 54, g: 'I', home: 'Senegal', away: 'Iraq',    date: '2026-06-26' },
  // Group J
  { n: 55, g: 'J', home: 'Argentina', away: 'Algeria',  date: '2026-06-16' },
  { n: 56, g: 'J', home: 'Austria',   away: 'Jordan',   date: '2026-06-16' },
  { n: 57, g: 'J', home: 'Argentina', away: 'Austria',  date: '2026-06-22' },
  { n: 58, g: 'J', home: 'Jordan',    away: 'Algeria',  date: '2026-06-22' },
  { n: 59, g: 'J', home: 'Algeria',   away: 'Austria',  date: '2026-06-27' },
  { n: 60, g: 'J', home: 'Jordan',    away: 'Argentina',date: '2026-06-27' },
  // Group K
  { n: 61, g: 'K', home: 'Portugal',                  away: 'DR Congo',   date: '2026-06-17' },
  { n: 62, g: 'K', home: 'Uzbekistan',                away: 'Colombia',   date: '2026-06-17' },
  { n: 63, g: 'K', home: 'Portugal',                  away: 'Uzbekistan', date: '2026-06-23' },
  { n: 64, g: 'K', home: 'Colombia',                  away: 'DR Congo',   date: '2026-06-23' },
  { n: 65, g: 'K', home: 'Colombia',                  away: 'Portugal',   date: '2026-06-27' },
  { n: 66, g: 'K', home: 'DR Congo',                  away: 'Uzbekistan', date: '2026-06-27' },
  // Group L
  { n: 67, g: 'L', home: 'England', away: 'Croatia', date: '2026-06-17' },
  { n: 68, g: 'L', home: 'Ghana',   away: 'Panama',  date: '2026-06-17' },
  { n: 69, g: 'L', home: 'England', away: 'Ghana',   date: '2026-06-23' },
  { n: 70, g: 'L', home: 'Panama',  away: 'Croatia', date: '2026-06-23' },
  { n: 71, g: 'L', home: 'Panama',  away: 'England', date: '2026-06-27' },
  { n: 72, g: 'L', home: 'Croatia', away: 'Ghana',   date: '2026-06-27' },
];

export async function seedMatches(): Promise<void> {
  const [rows] = await pool.execute('SELECT COUNT(*) as count FROM matches');
  const count = (rows as Array<{ count: number }>)[0].count;
  if (count > 0) return;

  for (const m of MATCHES) {
    await pool.execute(
      'INSERT INTO matches (match_number, group_name, home_team, away_team, match_date) VALUES (?, ?, ?, ?, ?)',
      [m.n, m.g, m.home, m.away, m.date],
    );
  }
  console.log('Seeded 72 group stage matches');
}
