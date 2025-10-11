import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  user: process.env.DB_USER || undefined,
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_NAME || undefined,
});

export async function initDb() {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `;
  await pool.query(sql);
}

export default pool;
