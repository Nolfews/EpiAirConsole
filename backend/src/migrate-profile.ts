import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'epiconsole',
  password: process.env.DB_PASSWORD || 'postgres',
  port: Number(process.env.DB_PORT) || 5432,
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting migration...');

    console.log('Adding columns to users table...');
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS bio TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline'
    `);
    console.log('✅ Users table updated');

    console.log('Dropping existing user_profiles table if exists...');
    await client.query(`DROP TABLE IF EXISTS user_profiles CASCADE`);
    console.log('✅ Old user_profiles table dropped');

    console.log('Creating user_profiles table...');
    await client.query(`
      CREATE TABLE user_profiles (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        total_games INTEGER DEFAULT 0,
        total_wins INTEGER DEFAULT 0,
        total_playtime INTEGER DEFAULT 0,
        current_win_streak INTEGER DEFAULT 0,
        best_win_streak INTEGER DEFAULT 0,
        last_game_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ user_profiles table created');

    console.log('Creating profiles for existing users...');
    await client.query(`
      INSERT INTO user_profiles (user_id)
      SELECT id FROM users
      WHERE id NOT IN (SELECT user_id FROM user_profiles)
    `);
    console.log('✅ Profiles created for existing users');

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
