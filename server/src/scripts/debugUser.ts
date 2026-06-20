import 'dotenv/config';
import { pool } from '../db.js';
import { getPredictedGroupStandingsForUser } from '../jobs/groupStandings.js';

async function main() {
  try {
    const email = '1oddvar@gmail.com';

    // Get user
    const [userRows] = await pool.execute('SELECT id, email, pred_group_a, best_third_a FROM users WHERE email = ?', [email]);
    const user = (userRows as any[])[0];

    if (!user) {
      console.log('User not found');
      process.exit(1);
    }

    console.log('User:', user.email);
    console.log('best_third_a:', user.best_third_a);
    console.log('pred_group_a (raw):', user.pred_group_a);

    // Get calculated standings
    const standings = await getPredictedGroupStandingsForUser(user.id, 'A');
    console.log('Calculated standings:', standings);

    // Get oddvar's standings
    const [oddvarRows] = await pool.execute('SELECT pred_group_a FROM users WHERE email = ?', [
      'oddvar@geheb.com',
    ]);
    const oddvar = (oddvarRows as any[])[0];
    console.log('Oddvar pred_group_a:', oddvar.pred_group_a);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
