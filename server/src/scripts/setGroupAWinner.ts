import 'dotenv/config';
import { pool } from '../db.js';
import { calculateAndStoreGroupStandings } from '../jobs/groupStandings.js';

async function main() {
  try {
    // Get oddvar@geheb.com user
    const [userRows] = await pool.execute('SELECT id FROM users WHERE email = ?', [
      'oddvar@geheb.com',
    ]);

    const oddvarUser = (userRows as any[])[0];
    if (!oddvarUser) {
      console.error('oddvar@geheb.com not found');
      process.exit(1);
    }

    console.log('Calculating and storing group A standings for oddvar@geheb.com...');
    const standings = await calculateAndStoreGroupStandings(oddvarUser.id, 'A');

    console.log('✓ Group A standings stored:');
    standings.forEach((s: any) => {
      console.log(`  ${s.position}. ${s.team}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
