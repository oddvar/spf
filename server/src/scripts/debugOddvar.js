import mysql from 'mysql2/promise';

(async () => {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'spf-admin',
    password: '6QaDk6M1',
    database: 'spf2026'
  });

  try {
    // Get user ID and group predictions
    const [users] = await connection.execute(
      'SELECT id, pred_group_a, pred_group_b, pred_group_c, pred_group_d FROM users WHERE email = ?',
      ['1oddvar@gmail.com']
    );
    if (users.length === 0) {
      console.log('User not found');
      return;
    }
    const userId = users[0].id;
    console.log('User ID:', userId);
    console.log('\nUser predicted groups:');
    console.log('Group A:', users[0].pred_group_a);
    console.log('Group B:', users[0].pred_group_b);
    console.log('Group C:', users[0].pred_group_c);
    console.log('Group D:', users[0].pred_group_d);

    // Get oddvar's group predictions (the correct answers)
    const [oddvar] = await connection.execute(
      'SELECT pred_group_a, pred_group_b, pred_group_c, pred_group_d FROM users WHERE email = ?',
      ['oddvar@geheb.com']
    );
    console.log('\nOddvar predicted groups (correct answers):');
    console.log('Group A:', oddvar[0].pred_group_a);
    console.log('Group B:', oddvar[0].pred_group_b);
    console.log('Group C:', oddvar[0].pred_group_c);
    console.log('Group D:', oddvar[0].pred_group_d);

    // Get all group stage matches with results
    const [groupMatches] = await connection.execute(
      'SELECT match_number, group_name, home_team, away_team, result FROM matches WHERE stage IS NULL ORDER BY match_number'
    );

    // Get user's group predictions
    const [predictions] = await connection.execute(
      'SELECT match1, match2, match3, match4, match5, match6, match7, match8, match9, match10, match11, match12, match13, match14, match15, match16, match17, match18, match19, match20, match21, match22, match23, match24 FROM users WHERE id = ?',
      [userId]
    );
    const preds = predictions[0];

    // Show group A matches
    console.log('\nGroup A matches:');
    for (const m of groupMatches) {
      if (m.group_name === 'A') {
        const pred = preds[`match${m.match_number}`];
        const correct = (pred === 'H' && m.result === 'H') || (pred === 'A' && m.result === 'A') || (pred === 'D' && m.result === 'D');
        console.log(`Match ${m.match_number}: ${m.home_team} vs ${m.away_team}, Result: ${m.result}, Pred: ${pred}, Correct: ${correct}`);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await connection.end();
  }
})();
