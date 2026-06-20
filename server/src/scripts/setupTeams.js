import mysql from 'mysql2/promise';

(async () => {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'spf-admin',
    password: '6QaDk6M1',
    database: 'spf2026'
  });

  try {
    // Create teams table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        active TINYINT(1) NOT NULL DEFAULT 1
      )
    `);
    console.log('✓ Teams table created or already exists');

    // Get all unique team names from matches table
    const [teams] = await connection.execute(`
      SELECT DISTINCT home_team as team FROM matches
      UNION
      SELECT DISTINCT away_team as team FROM matches
      ORDER BY team
    `);

    console.log(`Found ${teams.length} unique teams`);

    // Insert teams into teams table
    let inserted = 0;
    let duplicates = 0;
    for (const row of teams) {
      const teamName = row.team;
      try {
        await connection.execute(
          'INSERT INTO teams (name, active) VALUES (?, 1)',
          [teamName]
        );
        inserted++;
        console.log(`✓ Inserted: ${teamName}`);
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          duplicates++;
        } else {
          console.error(`✗ Error inserting ${teamName}:`, e.message);
        }
      }
    }

    console.log(`\n✓ Teams table setup complete`);
    console.log(`  Inserted: ${inserted}`);
    console.log(`  Duplicates: ${duplicates}`);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await connection.end();
  }
})();
