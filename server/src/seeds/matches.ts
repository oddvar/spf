import { pool } from '../db.js';

// Convert a date ("YYYY-MM-DD") and EDT time ("HH:MM") to a UTC datetime string
// for MySQL DATETIME storage ("YYYY-MM-DD HH:MM:SS").
function toUtcDatetime(date: string, edtTime: string): string {
  return new Date(`${date}T${edtTime}:00-04:00`)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, '');
}

// All times are in EDT (UTC-4). Locations are venue, city.
const MATCHES = [
  // Group A
  { n: 1,  g: 'A', home: 'Mexico',       away: 'South Africa',          date: '2026-06-11', time: '15:00', location: 'Estadio Azteca, Mexico City' },
  { n: 2,  g: 'A', home: 'South Korea',  away: 'Czechia',               date: '2026-06-11', time: '22:00', location: 'Estadio Akron, Zapopan' },
  { n: 3,  g: 'A', home: 'Czechia',      away: 'South Africa',          date: '2026-06-18', time: '12:00', location: 'Mercedes-Benz Stadium, Atlanta' },
  { n: 4,  g: 'A', home: 'Mexico',       away: 'South Korea',           date: '2026-06-18', time: '21:00', location: 'Estadio Akron, Zapopan' },
  { n: 5,  g: 'A', home: 'Czechia',      away: 'Mexico',                date: '2026-06-24', time: '21:00', location: 'Estadio Azteca, Mexico City' },
  { n: 6,  g: 'A', home: 'South Africa', away: 'South Korea',           date: '2026-06-24', time: '21:00', location: 'Estadio BBVA, Guadalupe' },
  // Group B
  { n: 7,  g: 'B', home: 'Canada',                away: 'Bosnia and Herzegovina', date: '2026-06-12', time: '15:00', location: 'BMO Field, Toronto' },
  { n: 8,  g: 'B', home: 'Qatar',                 away: 'Switzerland',            date: '2026-06-13', time: '15:00', location: "Levi's Stadium, Santa Clara" },
  { n: 9,  g: 'B', home: 'Switzerland',           away: 'Bosnia and Herzegovina', date: '2026-06-18', time: '15:00', location: 'SoFi Stadium, Inglewood' },
  { n: 10, g: 'B', home: 'Canada',                away: 'Qatar',                  date: '2026-06-18', time: '18:00', location: 'BC Place, Vancouver' },
  { n: 11, g: 'B', home: 'Switzerland',           away: 'Canada',                 date: '2026-06-24', time: '15:00', location: 'BC Place, Vancouver' },
  { n: 12, g: 'B', home: 'Bosnia and Herzegovina',away: 'Qatar',                  date: '2026-06-24', time: '15:00', location: 'Lumen Field, Seattle' },
  // Group C
  { n: 13, g: 'C', home: 'Brazil',   away: 'Morocco',  date: '2026-06-13', time: '18:00', location: 'MetLife Stadium, East Rutherford' },
  { n: 14, g: 'C', home: 'Haiti',    away: 'Scotland',  date: '2026-06-13', time: '21:00', location: 'Gillette Stadium, Foxborough' },
  { n: 15, g: 'C', home: 'Scotland', away: 'Morocco',  date: '2026-06-19', time: '18:00', location: 'Gillette Stadium, Foxborough' },
  { n: 16, g: 'C', home: 'Brazil',   away: 'Haiti',    date: '2026-06-19', time: '21:00', location: 'Lincoln Financial Field, Philadelphia' },
  { n: 17, g: 'C', home: 'Scotland', away: 'Brazil',   date: '2026-06-24', time: '18:00', location: 'Hard Rock Stadium, Miami Gardens' },
  { n: 18, g: 'C', home: 'Morocco',  away: 'Haiti',    date: '2026-06-24', time: '18:00', location: 'Mercedes-Benz Stadium, Atlanta' },
  // Group D
  { n: 19, g: 'D', home: 'USA',       away: 'Paraguay',  date: '2026-06-12', time: '21:00', location: 'SoFi Stadium, Inglewood' },
  { n: 20, g: 'D', home: 'Australia', away: 'Turkiye',   date: '2026-06-13', time: '23:59', location: 'BC Place, Vancouver' },
  { n: 21, g: 'D', home: 'USA',       away: 'Australia', date: '2026-06-19', time: '15:00', location: 'Lumen Field, Seattle' },
  { n: 22, g: 'D', home: 'Turkiye',   away: 'Paraguay',  date: '2026-06-19', time: '23:59', location: "Levi's Stadium, Santa Clara" },
  { n: 23, g: 'D', home: 'Turkiye',   away: 'USA',       date: '2026-06-25', time: '22:00', location: 'SoFi Stadium, Inglewood' },
  { n: 24, g: 'D', home: 'Paraguay',  away: 'Australia', date: '2026-06-25', time: '22:00', location: "Levi's Stadium, Santa Clara" },
  // Group E
  { n: 25, g: 'E', home: 'Germany',     away: 'Curacao',     date: '2026-06-14', time: '13:00', location: 'NRG Stadium, Houston' },
  { n: 26, g: 'E', home: 'Ivory Coast', away: 'Ecuador',     date: '2026-06-14', time: '19:00', location: 'Lincoln Financial Field, Philadelphia' },
  { n: 27, g: 'E', home: 'Germany',     away: 'Ivory Coast', date: '2026-06-20', time: '16:00', location: 'BMO Field, Toronto' },
  { n: 28, g: 'E', home: 'Ecuador',     away: 'Curacao',     date: '2026-06-20', time: '20:00', location: 'Arrowhead Stadium, Kansas City' },
  { n: 29, g: 'E', home: 'Ecuador',     away: 'Germany',     date: '2026-06-25', time: '16:00', location: 'MetLife Stadium, East Rutherford' },
  { n: 30, g: 'E', home: 'Curacao',     away: 'Ivory Coast', date: '2026-06-25', time: '16:00', location: 'Lincoln Financial Field, Philadelphia' },
  // Group F
  { n: 31, g: 'F', home: 'Netherlands', away: 'Japan',       date: '2026-06-14', time: '16:00', location: 'AT&T Stadium, Arlington' },
  { n: 32, g: 'F', home: 'Sweden',      away: 'Tunisia',     date: '2026-06-14', time: '22:00', location: 'Estadio BBVA, Guadalupe' },
  { n: 33, g: 'F', home: 'Netherlands', away: 'Sweden',      date: '2026-06-20', time: '13:00', location: 'NRG Stadium, Houston' },
  { n: 34, g: 'F', home: 'Tunisia',     away: 'Japan',       date: '2026-06-20', time: '23:59', location: 'Estadio BBVA, Guadalupe' },
  { n: 35, g: 'F', home: 'Japan',       away: 'Sweden',      date: '2026-06-25', time: '19:00', location: 'AT&T Stadium, Arlington' },
  { n: 36, g: 'F', home: 'Tunisia',     away: 'Netherlands', date: '2026-06-25', time: '19:00', location: 'Arrowhead Stadium, Kansas City' },
  // Group G
  { n: 37, g: 'G', home: 'Iran',        away: 'New Zealand', date: '2026-06-15', time: '21:00', location: 'SoFi Stadium, Inglewood' },
  { n: 38, g: 'G', home: 'Belgium',     away: 'Egypt',       date: '2026-06-15', time: '15:00', location: 'Lumen Field, Seattle' },
  { n: 39, g: 'G', home: 'Belgium',     away: 'Iran',        date: '2026-06-21', time: '15:00', location: 'SoFi Stadium, Inglewood' },
  { n: 40, g: 'G', home: 'New Zealand', away: 'Egypt',       date: '2026-06-21', time: '21:00', location: 'BC Place, Vancouver' },
  { n: 41, g: 'G', home: 'Egypt',       away: 'Iran',        date: '2026-06-26', time: '23:00', location: 'Lumen Field, Seattle' },
  { n: 42, g: 'G', home: 'New Zealand', away: 'Belgium',     date: '2026-06-26', time: '23:00', location: 'BC Place, Vancouver' },
  // Group H
  { n: 43, g: 'H', home: 'Spain',        away: 'Cape Verde',  date: '2026-06-15', time: '12:00', location: 'Mercedes-Benz Stadium, Atlanta' },
  { n: 44, g: 'H', home: 'Saudi Arabia', away: 'Uruguay',     date: '2026-06-15', time: '18:00', location: 'Hard Rock Stadium, Miami Gardens' },
  { n: 45, g: 'H', home: 'Spain',        away: 'Saudi Arabia',date: '2026-06-21', time: '12:00', location: 'Mercedes-Benz Stadium, Atlanta' },
  { n: 46, g: 'H', home: 'Uruguay',      away: 'Cape Verde',  date: '2026-06-21', time: '18:00', location: 'Hard Rock Stadium, Miami Gardens' },
  { n: 47, g: 'H', home: 'Cape Verde',   away: 'Saudi Arabia',date: '2026-06-26', time: '20:00', location: 'NRG Stadium, Houston' },
  { n: 48, g: 'H', home: 'Uruguay',      away: 'Spain',       date: '2026-06-26', time: '20:00', location: 'Estadio Akron, Zapopan' },
  // Group I
  { n: 49, g: 'I', home: 'France',  away: 'Senegal', date: '2026-06-16', time: '15:00', location: 'MetLife Stadium, East Rutherford' },
  { n: 50, g: 'I', home: 'Iraq',    away: 'Norway',  date: '2026-06-16', time: '18:00', location: 'Gillette Stadium, Foxborough' },
  { n: 51, g: 'I', home: 'France',  away: 'Iraq',    date: '2026-06-22', time: '17:00', location: 'Lincoln Financial Field, Philadelphia' },
  { n: 52, g: 'I', home: 'Norway',  away: 'Senegal', date: '2026-06-22', time: '20:00', location: 'MetLife Stadium, East Rutherford' },
  { n: 53, g: 'I', home: 'Norway',  away: 'France',  date: '2026-06-26', time: '15:00', location: 'Gillette Stadium, Foxborough' },
  { n: 54, g: 'I', home: 'Senegal', away: 'Iraq',    date: '2026-06-26', time: '15:00', location: 'BMO Field, Toronto' },
  // Group J
  { n: 55, g: 'J', home: 'Argentina', away: 'Algeria',   date: '2026-06-16', time: '21:00', location: 'Arrowhead Stadium, Kansas City' },
  { n: 56, g: 'J', home: 'Austria',   away: 'Jordan',    date: '2026-06-16', time: '23:59', location: "Levi's Stadium, Santa Clara" },
  { n: 57, g: 'J', home: 'Argentina', away: 'Austria',   date: '2026-06-22', time: '13:00', location: 'AT&T Stadium, Arlington' },
  { n: 58, g: 'J', home: 'Jordan',    away: 'Algeria',   date: '2026-06-22', time: '23:00', location: "Levi's Stadium, Santa Clara" },
  { n: 59, g: 'J', home: 'Algeria',   away: 'Austria',   date: '2026-06-27', time: '22:00', location: 'Arrowhead Stadium, Kansas City' },
  { n: 60, g: 'J', home: 'Jordan',    away: 'Argentina', date: '2026-06-27', time: '22:00', location: 'AT&T Stadium, Arlington' },
  // Group K
  { n: 61, g: 'K', home: 'Portugal',  away: 'DR Congo',   date: '2026-06-17', time: '13:00', location: 'NRG Stadium, Houston' },
  { n: 62, g: 'K', home: 'Uzbekistan',away: 'Colombia',   date: '2026-06-17', time: '22:00', location: 'Estadio Azteca, Mexico City' },
  { n: 63, g: 'K', home: 'Portugal',  away: 'Uzbekistan', date: '2026-06-23', time: '13:00', location: 'NRG Stadium, Houston' },
  { n: 64, g: 'K', home: 'Colombia',  away: 'DR Congo',   date: '2026-06-23', time: '22:00', location: 'Estadio Akron, Zapopan' },
  { n: 65, g: 'K', home: 'Colombia',  away: 'Portugal',   date: '2026-06-27', time: '19:30', location: 'Hard Rock Stadium, Miami Gardens' },
  { n: 66, g: 'K', home: 'DR Congo',  away: 'Uzbekistan', date: '2026-06-27', time: '19:30', location: 'Mercedes-Benz Stadium, Atlanta' },
  // Group L
  { n: 67, g: 'L', home: 'England', away: 'Croatia', date: '2026-06-17', time: '16:00', location: 'AT&T Stadium, Arlington' },
  { n: 68, g: 'L', home: 'Ghana',   away: 'Panama',  date: '2026-06-17', time: '19:00', location: 'BMO Field, Toronto' },
  { n: 69, g: 'L', home: 'England', away: 'Ghana',   date: '2026-06-23', time: '16:00', location: 'Gillette Stadium, Foxborough' },
  { n: 70, g: 'L', home: 'Panama',  away: 'Croatia', date: '2026-06-23', time: '19:00', location: 'BMO Field, Toronto' },
  { n: 71, g: 'L', home: 'Panama',  away: 'England', date: '2026-06-27', time: '17:00', location: 'MetLife Stadium, East Rutherford' },
  { n: 72, g: 'L', home: 'Croatia', away: 'Ghana',   date: '2026-06-27', time: '17:00', location: 'Lincoln Financial Field, Philadelphia' },
];

export async function seedMatches(): Promise<void> {
  const [rows] = await pool.execute('SELECT COUNT(*) as count FROM matches');
  const count = (rows as Array<{ count: number }>)[0].count;

  if (count === 0) {
    for (const m of MATCHES) {
      await pool.execute(
        'INSERT INTO matches (match_number, group_name, home_team, away_team, match_datetime, location) VALUES (?, ?, ?, ?, ?, ?)',
        [m.n, m.g, m.home, m.away, toUtcDatetime(m.date, m.time), m.location],
      );
    }
    console.log('Seeded 72 group stage matches');
    return;
  }

  // Backfill match_datetime if null (migration ran before old columns were populated)
  const [nullDtRows] = await pool.execute('SELECT COUNT(*) as count FROM matches WHERE match_datetime IS NULL');
  if ((nullDtRows as Array<{ count: number }>)[0].count > 0) {
    for (const m of MATCHES) {
      await pool.execute(
        'UPDATE matches SET match_datetime = ? WHERE match_number = ? AND match_datetime IS NULL',
        [toUtcDatetime(m.date, m.time), m.n],
      );
    }
    console.log('Backfilled match datetimes');
  }

  // Backfill location for rows that predate this column
  const [nullLocRows] = await pool.execute('SELECT COUNT(*) as count FROM matches WHERE location IS NULL');
  if ((nullLocRows as Array<{ count: number }>)[0].count > 0) {
    for (const m of MATCHES) {
      await pool.execute(
        'UPDATE matches SET location = ? WHERE match_number = ? AND location IS NULL',
        [m.location, m.n],
      );
    }
    console.log('Backfilled match locations');
  }

  // Rename venues that have changed naming rights
  await pool.execute(
    `UPDATE matches SET location = 'Estadio Azteca, Mexico City' WHERE location = 'Estadio Banorte, Mexico City'`,
  );
}

const KO_MATCHES = [
  { n: 1,  home: '2A',      away: '2B',      date: '2026-06-28', time: '15:00', location: 'SoFi Stadium, Inglewood' },
  { n: 2,  home: '1C',      away: '2F',      date: '2026-06-29', time: '13:00', location: 'NRG Stadium, Houston' },
  { n: 3,  home: '1E',      away: '3ABCDF',  date: '2026-06-29', time: '16:30', location: 'Gillette Stadium, Foxborough' },
  { n: 4,  home: '1F',      away: '2C',      date: '2026-06-29', time: '21:00', location: 'Estadio BBVA, Guadalupe' },
  { n: 5,  home: '2E',      away: '2I',      date: '2026-06-30', time: '14:00', location: 'AT&T Stadium, Arlington' },
  { n: 6,  home: '1I',      away: '3CDFGH',  date: '2026-06-30', time: '17:00', location: 'MetLife Stadium, East Rutherford' },
  { n: 7,  home: '1A',      away: '3CEFHI',  date: '2026-06-30', time: '21:00', location: 'Estadio Azteca, Mexico City' },
  { n: 8,  home: '1L',      away: '3EHIJK',  date: '2026-07-01', time: '12:00', location: 'Mercedes-Benz Stadium, Atlanta' },
  { n: 9,  home: '1G',      away: '3AEHIJ',  date: '2026-07-01', time: '16:00', location: 'Lumen Field, Seattle' },
  { n: 10, home: '1D',      away: '3BEFIJ',  date: '2026-07-01', time: '20:00', location: "Levi's Stadium, Santa Clara" },
  { n: 11, home: '1H',      away: '2J',      date: '2026-07-02', time: '15:00', location: 'SoFi Stadium, Inglewood' },
  { n: 12, home: '2K',      away: '2L',      date: '2026-07-02', time: '19:00', location: 'BMO Field, Toronto' },
  { n: 13, home: '2B',      away: '3EFGIJ',  date: '2026-07-02', time: '23:00', location: 'BC Place, Vancouver' },
  { n: 14, home: '2D',      away: '2G',      date: '2026-07-03', time: '14:00', location: 'AT&T Stadium, Arlington' },
  { n: 15, home: '1J',      away: '2H',      date: '2026-07-03', time: '18:00', location: 'Hard Rock Stadium, Miami Gardens' },
  { n: 16, home: '1K',      away: '3DEIJL',  date: '2026-07-03', time: '21:30', location: 'Arrowhead Stadium, Kansas City' },
];

export async function seedKnockoutMatches(): Promise<void> {
  const [rows] = await pool.execute(`SELECT COUNT(*) as count FROM matches WHERE stage = 'r32'`);
  if ((rows as Array<{ count: number }>)[0].count > 0) return;

  for (const m of KO_MATCHES) {
    await pool.execute(
      `INSERT INTO matches (home_team, away_team, match_datetime, location, stage, ko_number)
       VALUES (?, ?, ?, ?, 'r32', ?)`,
      [m.home, m.away, toUtcDatetime(m.date, m.time), m.location, m.n],
    );
  }
  console.log('Seeded 16 Round of 32 matches');
}
