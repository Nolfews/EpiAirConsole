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
  // Table users
  const usersTable = `
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
  await pool.query(usersTable);

  // Table game_sessions (rooms)
  const sessionsTable = `
    CREATE TABLE IF NOT EXISTS game_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id TEXT UNIQUE NOT NULL,
      pin TEXT NOT NULL,
      game_type TEXT,
      host_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      started_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ,
      status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'finished'))
    );
  `;
  await pool.query(sessionsTable);

  // Table game_scores
  const scoresTable = `
    CREATE TABLE IF NOT EXISTS game_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      game_type TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      kills INTEGER DEFAULT 0,
      deaths INTEGER DEFAULT 0,
      level_reached INTEGER DEFAULT 1,
      lines_cleared INTEGER DEFAULT 0,
      won BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(session_id, user_id)
    );
  `;
  await pool.query(scoresTable);

  // Index for faster queries
  const indexes = `
    CREATE INDEX IF NOT EXISTS idx_game_scores_user_id ON game_scores(user_id);
    CREATE INDEX IF NOT EXISTS idx_game_scores_game_type ON game_scores(game_type);
    CREATE INDEX IF NOT EXISTS idx_game_sessions_room_id ON game_sessions(room_id);
    CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
  `;
  await pool.query(indexes);

  console.log('Database initialized');
}

// Helper functions for game sessions
export async function createGameSession(roomId: string, pin: string, gameType?: string, hostUserId?: string) {
  const result = await pool.query(
    `INSERT INTO game_sessions (room_id, pin, game_type, host_user_id, status)
     VALUES ($1, $2, $3, $4, 'waiting')
     RETURNING *`,
    [roomId, pin, gameType, hostUserId]
  );
  return result.rows[0];
}

export async function startGameSession(roomId: string, gameType: string) {
  const result = await pool.query(
    `UPDATE game_sessions
     SET status = 'in_progress', started_at = now(), game_type = $2
     WHERE room_id = $1
     RETURNING *`,
    [roomId, gameType]
  );
  return result.rows[0];
}

export async function endGameSession(roomId: string) {
  const result = await pool.query(
    `UPDATE game_sessions
     SET status = 'finished', ended_at = now()
     WHERE room_id = $1
     RETURNING *`,
    [roomId]
  );
  return result.rows[0];
}

export async function getGameSession(roomId: string) {
  const result = await pool.query(
    `SELECT * FROM game_sessions WHERE room_id = $1`,
    [roomId]
  );
  return result.rows[0];
}

// Helper functions for game scores
export async function saveGameScore(data: {
  sessionId: string;
  userId?: string;
  username: string;
  gameType: string;
  score?: number;
  kills?: number;
  deaths?: number;
  levelReached?: number;
  linesCleared?: number;
  won?: boolean;
}) {
  const result = await pool.query(
    `INSERT INTO game_scores
     (session_id, user_id, username, game_type, score, kills, deaths, level_reached, lines_cleared, won)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (session_id, user_id)
     DO UPDATE SET
       score = EXCLUDED.score,
       kills = EXCLUDED.kills,
       deaths = EXCLUDED.deaths,
       level_reached = EXCLUDED.level_reached,
       lines_cleared = EXCLUDED.lines_cleared,
       won = EXCLUDED.won
     RETURNING *`,
    [
      data.sessionId,
      data.userId || null,
      data.username,
      data.gameType,
      data.score || 0,
      data.kills || 0,
      data.deaths || 0,
      data.levelReached || 1,
      data.linesCleared || 0,
      data.won || false
    ]
  );
  return result.rows[0];
}

export async function getPlayerScores(userId: string, gameType?: string) {
  let query = `
    SELECT gs.*, s.room_id, s.created_at as session_date
    FROM game_scores gs
    JOIN game_sessions s ON gs.session_id = s.id
    WHERE gs.user_id = $1
  `;
  const params: any[] = [userId];

  if (gameType) {
    query += ` AND gs.game_type = $2`;
    params.push(gameType);
  }

  query += ` ORDER BY gs.created_at DESC LIMIT 50`;

  const result = await pool.query(query, params);
  return result.rows;
}

export async function getLeaderboard(gameType: string, limit: number = 10) {
  const result = await pool.query(
    `SELECT
       username,
       game_type,
       MAX(score) as best_score,
       SUM(kills) as total_kills,
       SUM(CASE WHEN won THEN 1 ELSE 0 END) as wins,
       COUNT(*) as games_played
     FROM game_scores
     WHERE game_type = $1
     GROUP BY username, game_type
     ORDER BY best_score DESC
     LIMIT $2`,
    [gameType, limit]
  );
  return result.rows;
}

export default pool;
