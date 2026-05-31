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
});

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

  // Add active column to existing tables that predate this migration
  const [activeRows] = await pool.execute(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'active'`,
  );
  if ((activeRows as unknown[]).length === 0) {
    await pool.execute(`ALTER TABLE users ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1`);
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS matches (
      id           INT          PRIMARY KEY AUTO_INCREMENT,
      match_number INT          NOT NULL,
      group_name   CHAR(1)      NOT NULL,
      home_team    VARCHAR(100) NOT NULL,
      away_team    VARCHAR(100) NOT NULL,
      match_date   DATE         NOT NULL,
      match_time   VARCHAR(5)   NULL,
      location     VARCHAR(200) NULL
    )
  `);

  // Add columns to existing matches tables that predate this migration
  for (const col of ['match_time VARCHAR(5) NULL', 'location VARCHAR(200) NULL'] as const) {
    const colName = col.split(' ')[0];
    const [colRows] = await pool.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND COLUMN_NAME = ?`,
      [colName],
    );
    if ((colRows as unknown[]).length === 0) {
      await pool.execute(`ALTER TABLE matches ADD COLUMN ${col}`);
    }
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
