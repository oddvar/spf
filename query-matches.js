const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spf2026',
  });

  const [rows] = await connection.execute(
    `SELECT id, match_number, home_team, away_team, match_datetime
     FROM matches
     WHERE stage IS NULL
     ORDER BY match_datetime
     LIMIT 5`
  );

  console.log('\nMatches included with dropdown value of 5:\n');
  rows.forEach((match, i) => {
    console.log(`${i + 1}. ID: ${match.id}, Match #: ${match.match_number}`);
    console.log(`   ${match.home_team} vs ${match.away_team}`);
    console.log(`   ${new Date(match.match_datetime).toLocaleString()}\n`);
  });

  await connection.end();
}

main().catch(console.error);
