import mysql from 'mysql2/promise';
import 'dotenv/config';

export const MATCH_COUNT = 72;
export const KO_MATCH_COUNT = 16;  // Round of 32
export const KO_R16_COUNT  = 8;   // Round of 16
export const KO_QF_COUNT   = 4;   // Quarter-finals
export const KO_SF_COUNT   = 2;   // Semi-finals
export const KO_F_COUNT    = 1;   // Final
export const KO_T_COUNT    = 1;   // Third place

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
    CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      event_type VARCHAR(50) NOT NULL,
      user_id VARCHAR(36),
      user_email VARCHAR(255),
      user_first_name VARCHAR(100),
      user_last_name VARCHAR(100),
      viewed_user_id VARCHAR(36),
      description VARCHAR(255),
      KEY (timestamp),
      KEY (event_type)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id              CHAR(36)      PRIMARY KEY,
      first_name      VARCHAR(100)  NOT NULL,
      last_name       VARCHAR(100)  NOT NULL,
      email           VARCHAR(255)  UNIQUE NOT NULL,
      password_hash   VARCHAR(255)  NOT NULL,
      payment_status  ENUM('NO', 'WANTS_TO_PAY', 'HAS_PAID') NOT NULL DEFAULT 'NO',
      active          TINYINT(1)    NOT NULL DEFAULT 1,
      last_login      DATETIME      NULL,
      created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (await columnExists('users', 'username')) {
    await pool.execute(`ALTER TABLE users DROP COLUMN username`);
  }
  if (!(await columnExists('users', 'active'))) {
    await pool.execute(`ALTER TABLE users ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1`);
  }
  if (!(await columnExists('users', 'last_login'))) {
    await pool.execute(`ALTER TABLE users ADD COLUMN last_login DATETIME NULL`);
  }
  if (!(await columnExists('users', 'can_edit'))) {
    await pool.execute(`ALTER TABLE users ADD COLUMN can_edit TINYINT(1) NOT NULL DEFAULT 1`);
  }
  if (!(await columnExists('users', 'can_view_others'))) {
    await pool.execute(`ALTER TABLE users ADD COLUMN can_view_others TINYINT(1) NOT NULL DEFAULT 0`);
  }
  if (!(await columnExists('users', 'theme'))) {
    await pool.execute(`ALTER TABLE users ADD COLUMN theme ENUM('light', 'dark') NOT NULL DEFAULT 'light'`);
  }

  // Add best-thirds prediction columns (best_third_a…best_third_l)
  if (!(await columnExists('users', 'best_third_a'))) {
    const cols = ['A','B','C','D','E','F','G','H','I','J','K','L']
      .map((g) => `ADD COLUMN best_third_${g.toLowerCase()} TINYINT(1) NULL`)
      .join(', ');
    await pool.execute(`ALTER TABLE users ${cols}`);
  }

  // Add group stage prediction columns (match1…match72)
  if (!(await columnExists('users', 'match1'))) {
    const cols = Array.from(
      { length: MATCH_COUNT },
      (_, i) => `ADD COLUMN match${i + 1} ENUM('H', 'D', 'A') NULL`,
    ).join(', ');
    await pool.execute(`ALTER TABLE users ${cols}`);
  }

  // Add knockout prediction columns (ko1…ko16 R32, ko17…ko24 R16)
  if (!(await columnExists('users', 'ko1'))) {
    const cols = Array.from(
      { length: KO_MATCH_COUNT },
      (_, i) => `ADD COLUMN ko${i + 1} ENUM('H', 'A') NULL`,
    ).join(', ');
    await pool.execute(`ALTER TABLE users ${cols}`);
  }
  if (!(await columnExists('users', 'ko17'))) {
    const cols = Array.from(
      { length: KO_R16_COUNT },
      (_, i) => `ADD COLUMN ko${i + 17} ENUM('H', 'A') NULL`,
    ).join(', ');
    await pool.execute(`ALTER TABLE users ${cols}`);
  }
  if (!(await columnExists('users', 'ko25'))) {
    const cols = Array.from(
      { length: KO_QF_COUNT },
      (_, i) => `ADD COLUMN ko${i + 25} ENUM('H', 'A') NULL`,
    ).join(', ');
    await pool.execute(`ALTER TABLE users ${cols}`);
  }
  if (!(await columnExists('users', 'ko29'))) {
    const cols = Array.from(
      { length: KO_SF_COUNT },
      (_, i) => `ADD COLUMN ko${i + 29} ENUM('H', 'A') NULL`,
    ).join(', ');
    await pool.execute(`ALTER TABLE users ${cols}`);
  }
  if (!(await columnExists('users', 'ko31'))) {
    await pool.execute(`ALTER TABLE users ADD COLUMN ko31 ENUM('H', 'A') NULL`);
  }
  if (!(await columnExists('users', 'ko32'))) {
    await pool.execute(`ALTER TABLE users ADD COLUMN ko32 ENUM('H', 'A') NULL`);
  }

  // Migrate any existing data from the old predictions table, then drop it
  const [tableRows] = await pool.execute(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'predictions'`,
  );
  if ((tableRows as unknown[]).length > 0) {
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
      match_number   INT          NULL,
      group_name     CHAR(1)      NULL,
      home_team      VARCHAR(100) NOT NULL,
      away_team      VARCHAR(100) NOT NULL,
      match_datetime DATETIME     NOT NULL,
      location       VARCHAR(200) NULL,
      stage          VARCHAR(20)  NULL,
      ko_number      INT          NULL
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
  if (!(await columnExists('matches', 'stage'))) {
    await pool.execute(`ALTER TABLE matches ADD COLUMN stage VARCHAR(20) NULL`);
  }
  if (!(await columnExists('matches', 'ko_number'))) {
    await pool.execute(`ALTER TABLE matches ADD COLUMN ko_number INT NULL`);
  }
  if (!(await columnExists('matches', 'result'))) {
    await pool.execute(`ALTER TABLE matches ADD COLUMN result ENUM('H', 'D', 'A') NULL`);
  }
  // Make match_number and group_name nullable so knockout rows (which have neither) can be inserted
  const [mnRows] = await pool.execute(
    `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'match_number'`,
  );
  if ((mnRows as Array<{ IS_NULLABLE: string }>)[0]?.IS_NULLABLE === 'NO') {
    await pool.execute(`ALTER TABLE matches MODIFY COLUMN match_number INT NULL`);
  }
  const [gnRows] = await pool.execute(
    `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'group_name'`,
  );
  if ((gnRows as Array<{ IS_NULLABLE: string }>)[0]?.IS_NULLABLE === 'NO') {
    await pool.execute(`ALTER TABLE matches MODIFY COLUMN group_name CHAR(1) NULL`);
  }

  // Fix knockout match 13: first team should be 1B (winner group B), not 2B
  await pool.execute(
    `UPDATE matches SET home_team = '1B' WHERE stage = 'r32' AND ko_number = 13 AND home_team = '2B'`,
  );

  // Add columns for knockout stage progression tracking
  if (!(await columnExists('users', 'ko_r32_matches'))) {
    await pool.execute(`ALTER TABLE users ADD COLUMN ko_r32_matches JSON NULL COMMENT 'Array of R32 match predictions with teams'`);
  }
  if (!(await columnExists('users', 'ko_r16_matches'))) {
    await pool.execute(`ALTER TABLE users ADD COLUMN ko_r16_matches JSON NULL COMMENT 'Array of R16 match predictions with teams'`);
  }
  if (!(await columnExists('users', 'ko_qf_matches'))) {
    await pool.execute(`ALTER TABLE users ADD COLUMN ko_qf_matches JSON NULL COMMENT 'Array of QF match predictions with teams'`);
  }
  if (!(await columnExists('users', 'ko_sf_matches'))) {
    await pool.execute(`ALTER TABLE users ADD COLUMN ko_sf_matches JSON NULL COMMENT 'Array of SF match predictions with teams'`);
  }
  if (!(await columnExists('users', 'ko_f_match'))) {
    await pool.execute(`ALTER TABLE users ADD COLUMN ko_f_match JSON NULL COMMENT 'Final match prediction with teams'`);
  }
  if (!(await columnExists('users', 'ko_third_match'))) {
    await pool.execute(`ALTER TABLE users ADD COLUMN ko_third_match JSON NULL COMMENT '3rd place match prediction with teams'`);
  }
  if (!(await columnExists('users', 'ko_winner'))) {
    await pool.execute(`ALTER TABLE users ADD COLUMN ko_winner VARCHAR(100) NULL`);
  }
  if (!(await columnExists('users', 'ko_third_place_winner'))) {
    await pool.execute(`ALTER TABLE users ADD COLUMN ko_third_place_winner VARCHAR(100) NULL`);
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS shouts (
      id        INT          PRIMARY KEY AUTO_INCREMENT,
      user_id   CHAR(36)     NOT NULL,
      comment   TEXT         NOT NULL,
      created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}
