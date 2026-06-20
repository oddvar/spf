import mysql from 'mysql2/promise';

(async () => {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'spf-admin',
    password: '6QaDk6M1',
    database: 'spf2026'
  });

  try {
    // Get all matches with Haiti
    const [allMatches] = await connection.execute(
      'SELECT id, stage, home_team, away_team FROM matches WHERE home_team = ? OR away_team = ?',
      ['Haiti', 'Haiti']
    );
    console.log('All Haiti matches:', JSON.stringify(allMatches, null, 2));

    // Get r32 matches with Haiti
    const [matches] = await connection.execute(
      'SELECT id, ko_number, home_team, away_team FROM matches WHERE stage = ? AND (home_team = ? OR away_team = ?)',
      ['r32', 'Haiti', 'Haiti']
    );
    console.log('Haiti r32 matches:', JSON.stringify(matches, null, 2));

    // Get Haiti's active status
    const [teams] = await connection.execute(
      'SELECT name, active FROM teams WHERE name = ?',
      ['Haiti']
    );
    console.log('Haiti in teams table:', JSON.stringify(teams, null, 2));

    // Simulate the query from the users endpoint
    if (matches.length > 0) {
      const teamNames = matches.flatMap(m => [m.home_team, m.away_team]);
      const placeholders = teamNames.map(() => '?').join(',');
      const [teamRows] = await connection.execute(
        `SELECT name, active FROM teams WHERE name IN (${placeholders})`,
        teamNames
      );
      console.log('Teams query result:', JSON.stringify(teamRows, null, 2));
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await connection.end();
  }
})();
