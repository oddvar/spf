import mysql from 'mysql2/promise';

(async () => {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'spf-admin',
    password: '6QaDk6M1',
    database: 'spf2026'
  });

  try {
    // Get all unique team names from matches table
    const [teams] = await connection.execute(`
      SELECT DISTINCT home_team as team FROM matches
      UNION
      SELECT DISTINCT away_team as team FROM matches
      ORDER BY team
    `);

    console.log(`Found ${teams.length} unique teams`);

    // Insert teams into teams table
    for (const row of teams) {
      const teamName = row.team;
      try {
        await connection.execute(
          'INSERT INTO teams (name, active) VALUES (?, 1)',
          [teamName]
        );
        console.log(`✓ Inserted: ${teamName}`);
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          console.log(`  (already exists): ${teamName}`);
        } else {
          console.error(`✗ Error inserting ${teamName}:`, e.message);
        }
      }
    }

    console.log('✓ Teams table populated');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await connection.end();
  }
})();
