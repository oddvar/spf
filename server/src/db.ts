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
      created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
