import 'dotenv/config';
import { pool } from '../db.js';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    const migrationPath = path.join(process.cwd(), 'src/migrations/001_add_group_standings.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('Running migration...');

    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter((s) => s.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        try {
          await pool.execute(statement);
        } catch (err: any) {
          // Ignore "Duplicate column" errors
          if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('  (column already exists)');
          } else {
            throw err;
          }
        }
      }
    }

    console.log('✓ Migration applied successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error running migration:', err);
    process.exit(1);
  }
}

main();
