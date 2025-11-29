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

async function clearFriendsData() {
  try {
    console.log('Clearing friendships table...');
    await pool.query('DELETE FROM friendships');
    console.log('✓ Friendships cleared');

    console.log('Clearing room_invitations table...');
    await pool.query('DELETE FROM room_invitations');
    console.log('✓ Room invitations cleared');

    console.log('\n✅ All friends data cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    process.exit(1);
  }
}

clearFriendsData();
