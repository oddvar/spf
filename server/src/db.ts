import mysql from 'mysql2/promise';
import 'dotenv/config';

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

  // Migrate: add match_datetime from old separate date+time columns (EDT → UTC)
  if (!(await columnExists('matches', 'match_datetime'))) {
    await pool.execute(`ALTER TABLE matches ADD COLUMN match_datetime DATETIME NULL`);
  }
  // Populate from old columns only if they still exist (they may already be dropped)
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
  // Remaining null datetimes (old columns already gone) are backfilled by the seed

  // Add location column for tables that predate it
  if (!(await columnExists('matches', 'location'))) {
    await pool.execute(`ALTER TABLE matches ADD COLUMN location VARCHAR(200) NULL`);
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS predictions (
      user_id    CHAR(36)             NOT NULL,
      match_id   INT                  NOT NULL,
      prediction ENUM('H', 'D', 'A') NOT NULL,
      created_at TIMESTAMP            DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP            DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, match_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    )
  `);
}
