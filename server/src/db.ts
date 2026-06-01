import mysql from 'mysql2/promise';
import 'dotenv/config';

export const MATCH_COUNT = 72;

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});

async function columnExists(table: string, column: string): Promise<boolean> {
  const [rows] = await pool.execute(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return (rows as unknown[]).length > 0;
}

export async function initDb(): Promise<void> {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id              CHAR(36)      PRIMARY KEY,
      username        VARCHAR(50)   UNIQUE NOT NULL,
      first_name      VARCHAR(100)  NOT NULL,
      last_name       VARCHAR(100)  NOT NULL,
      email           VARCHAR(255)  UNIQUE NOT NULL,
      password_hash   VARCHAR(255)  NOT NULL,
      payment_status  ENUM('NO', 'WANTS_TO_PAY', 'HAS_PAID') NOT NULL DEFAULT 'NO',
      active          TINYINT(1)    NOT NULL DEFAULT 1,
      created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (!(await columnExists('users', 'active'))) {
    await pool.execute(`ALTER TABLE users ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1`);
  }

  // Add match prediction columns (match1…match72) if not present
  if (!(await columnExists('users', 'match1'))) {
    const cols = Array.from(
      { length: MATCH_COUNT },
      (_, i) => `ADD COLUMN match${i + 1} ENUM('H', 'D', 'A') NULL`,
    ).join(', ');
    await pool.execute(`ALTER TABLE users ${cols}`);
  }

  // Migrate any existing data from the old predictions table, then drop it
  const [tableRows] = await pool.execute(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'predictions'`,
  );
  if ((tableRows as unknown[]).length > 0) {
    // Copy predictions into the users columns
    const [preds] = await pool.execute(
      `SELECT p.user_id, m.match_number, p.prediction
       FROM predictions p JOIN matches m ON m.id = p.match_id`,
    );
    for (const row of preds as Array<{ user_id: string; match_number: number; prediction: string }>) {
      await pool.execute(
        `UPDATE users SET match${row.match_number} = ? WHERE id = ?`,
        [row.prediction, row.user_id],
      );
    }
    await pool.execute(`DROP TABLE predictions`);
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS matches (
      id             INT          PRIMARY KEY AUTO_INCREMENT,
      match_number   INT          NOT NULL,
      group_name     CHAR(1)      NOT NULL,
      home_team      VARCHAR(100) NOT NULL,
      away_team      VARCHAR(100) NOT NULL,
      match_datetime DATETIME     NOT NULL,
      location       VARCHAR(200) NULL
    )
  `);

  if (!(await columnExists('matches', 'match_datetime'))) {
    await pool.execute(`ALTER TABLE matches ADD COLUMN match_datetime DATETIME NULL`);
  }
  if (await columnExists('matches', 'match_date')) {
    await pool.execute(`
      UPDATE matches
      SET match_datetime = DATE_ADD(
        CONCAT(match_date, ' ', IFNULL(match_time, '00:00'), ':00'),
        INTERVAL 4 HOUR
      )
      WHERE match_datetime IS NULL
    `);
    await pool.execute(`ALTER TABLE matches DROP COLUMN match_date`);
  }
  if (await columnExists('matches', 'match_time')) {
    await pool.execute(`ALTER TABLE matches DROP COLUMN match_time`);
  }
  if (!(await columnExists('matches', 'location'))) {
    await pool.execute(`ALTER TABLE matches ADD COLUMN location VARCHAR(200) NULL`);
  }
}
