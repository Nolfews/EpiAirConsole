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

  // Table friendships
  const friendshipsTable = `
    CREATE TABLE IF NOT EXISTS friendships (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
      created_at TIMESTAMPTZ DEFAULT now(),
      accepted_at TIMESTAMPTZ,
      UNIQUE(user_id, friend_id)
    );
  `;
  await pool.query(friendshipsTable);

  // Table room_invitations
  const roomInvitationsTable = `
    CREATE TABLE IF NOT EXISTS room_invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
      receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
      room_id TEXT NOT NULL,
      pin TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
      created_at TIMESTAMPTZ DEFAULT now(),
      expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '30 minutes'
    );
  `;
  await pool.query(roomInvitationsTable);

  // Index for faster queries
  const indexes = `
    CREATE INDEX IF NOT EXISTS idx_game_scores_user_id ON game_scores(user_id);
    CREATE INDEX IF NOT EXISTS idx_game_scores_game_type ON game_scores(game_type);
    CREATE INDEX IF NOT EXISTS idx_game_sessions_room_id ON game_sessions(room_id);
    CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
    CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
    CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
    CREATE INDEX IF NOT EXISTS idx_room_invitations_receiver_id ON room_invitations(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_room_invitations_status ON room_invitations(status);
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

export async function sendFriendRequest(userId: string, friendId: string) {
  const existing = await pool.query(
    `SELECT * FROM friendships
     WHERE (user_id = $1 AND friend_id = $2)
        OR (user_id = $2 AND friend_id = $1)`,
    [userId, friendId]
  );

  if (existing.rows.length > 0) {
    throw new Error('Friend request already exists or you are already friends');
  }

  const result = await pool.query(
    `INSERT INTO friendships (user_id, friend_id, status)
     VALUES ($1, $2, 'pending')
     RETURNING *`,
    [userId, friendId]
  );
  return result.rows[0];
}

export async function acceptFriendRequest(userId: string, friendId: string) {
  const result = await pool.query(
    `UPDATE friendships
     SET status = 'accepted', accepted_at = now()
     WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'
     RETURNING *`,
    [friendId, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('Friend request not found');
  }

  return result.rows[0];
}

export async function rejectFriendRequest(userId: string, friendId: string) {
  const result = await pool.query(
    `UPDATE friendships
     SET status = 'rejected'
     WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'
     RETURNING *`,
    [friendId, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('Friend request not found');
  }

  return result.rows[0];
}

export async function removeFriend(userId: string, friendId: string) {
  const result = await pool.query(
    `DELETE FROM friendships
     WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
       AND status = 'accepted'
     RETURNING *`,
    [userId, friendId]
  );

  if (result.rows.length === 0) {
    throw new Error('Friendship not found');
  }

  return result.rows[0];
}

export async function getFriends(userId: string) {
  const result = await pool.query(
    `SELECT
       u.id, u.username, u.first_name, u.last_name,
       f.created_at as friendship_date, f.accepted_at
     FROM friendships f
     JOIN users u ON (
       CASE
         WHEN f.user_id = $1 THEN u.id = f.friend_id
         WHEN f.friend_id = $1 THEN u.id = f.user_id
       END
     )
     WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
     ORDER BY u.username`,
    [userId]
  );
  return result.rows;
}

export async function getPendingFriendRequests(userId: string) {
  const result = await pool.query(
    `SELECT
       f.id as request_id,
       u.id, u.username, u.first_name, u.last_name,
       f.created_at
     FROM friendships f
     JOIN users u ON u.id = f.user_id
     WHERE f.friend_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function searchUsers(query: string, currentUserId: string, limit: number = 20) {
  const result = await pool.query(
    `SELECT id, username, first_name, last_name
     FROM users
     WHERE (username ILIKE $1 OR email ILIKE $1)
       AND id != $2
     LIMIT $3`,
    [`%${query}%`, currentUserId, limit]
  );
  return result.rows;
}

export async function createRoomInvitation(senderId: string, receiverId: string, roomId: string, pin: string) {
  await pool.query(
    `DELETE FROM room_invitations
     WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'`,
    [senderId, receiverId]
  );

  const result = await pool.query(
    `INSERT INTO room_invitations (sender_id, receiver_id, room_id, pin, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`,
    [senderId, receiverId, roomId, pin]
  );
  return result.rows[0];
}

export async function acceptRoomInvitation(invitationId: string, userId: string) {
  const result = await pool.query(
    `UPDATE room_invitations
     SET status = 'accepted'
     WHERE id = $1 AND receiver_id = $2 AND status = 'pending' AND expires_at > now()
     RETURNING *`,
    [invitationId, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('Invitation not found or expired');
  }

  return result.rows[0];
}

export async function rejectRoomInvitation(invitationId: string, userId: string) {
  const result = await pool.query(
    `UPDATE room_invitations
     SET status = 'rejected'
     WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
     RETURNING *`,
    [invitationId, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('Invitation not found');
  }

  return result.rows[0];
}

export async function getPendingRoomInvitations(userId: string) {
  const result = await pool.query(
    `SELECT
       ri.id, ri.room_id, ri.pin, ri.created_at, ri.expires_at,
       u.id as sender_id, u.username as sender_username,
       u.first_name as sender_first_name, u.last_name as sender_last_name
     FROM room_invitations ri
     JOIN users u ON u.id = ri.sender_id
     WHERE ri.receiver_id = $1 AND ri.status = 'pending' AND ri.expires_at > now()
     ORDER BY ri.created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function getUserProfile(userId: string) {
  const result = await pool.query(
    `SELECT
      u.id, u.username, u.first_name, u.last_name, u.email,
      u.avatar_url, u.bio, u.status, u.created_at,
      up.total_games, up.total_wins, up.total_playtime,
      up.current_win_streak, up.best_win_streak, up.last_game_date
    FROM users u
    LEFT JOIN user_profiles up ON u.id = up.user_id
    WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0];
}

export async function updateUserInfo(userId: string, data: {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  bio?: string;
  avatarUrl?: string;
}) {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.firstName !== undefined) {
    fields.push(`first_name = $${paramIndex++}`);
    values.push(data.firstName);
  }
  if (data.lastName !== undefined) {
    fields.push(`last_name = $${paramIndex++}`);
    values.push(data.lastName);
  }
  if (data.username !== undefined) {
    fields.push(`username = $${paramIndex++}`);
    values.push(data.username);
  }
  if (data.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    values.push(data.email);
  }
  if (data.bio !== undefined) {
    fields.push(`bio = $${paramIndex++}`);
    values.push(data.bio);
  }
  if (data.avatarUrl !== undefined) {
    fields.push(`avatar_url = $${paramIndex++}`);
    values.push(data.avatarUrl);
  }

  if (fields.length === 0) return null;

  values.push(userId);
  const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

  const result = await pool.query(query, values);
  return result.rows[0];
}

export async function getUserStats(userId: string) {
  const result = await pool.query(
    `SELECT * FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || {
    user_id: userId,
    total_games: 0,
    total_wins: 0,
    total_playtime: 0,
    current_win_streak: 0,
    best_win_streak: 0,
    last_game_date: null
  };
}

export async function saveGameResult(userId: string, gameData: {
  gameName: string;
  result: 'win' | 'loss';
  score: number;
  duration: number;
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO game_history (user_id, game_name, result, score, duration)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, gameData.gameName, gameData.result, gameData.score, gameData.duration]
    );

    const statsResult = await client.query(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [userId]
    );

    let stats = statsResult.rows[0];
    if (!stats) {
      await client.query(
        `INSERT INTO user_profiles (user_id, total_games, total_wins, total_playtime, current_win_streak, best_win_streak, last_game_date)
         VALUES ($1, 0, 0, 0, 0, 0, NOW())`,
        [userId]
      );
      stats = {
        total_games: 0,
        total_wins: 0,
        total_playtime: 0,
        current_win_streak: 0,
        best_win_streak: 0
      };
    }

    const newTotalGames = stats.total_games + 1;
    const newTotalWins = gameData.result === 'win' ? stats.total_wins + 1 : stats.total_wins;
    const newTotalPlaytime = stats.total_playtime + gameData.duration;

    let newCurrentStreak = stats.current_win_streak;
    let newBestStreak = stats.best_win_streak;

    if (gameData.result === 'win') {
      newCurrentStreak++;
      if (newCurrentStreak > newBestStreak) {
        newBestStreak = newCurrentStreak;
      }
    } else {
      newCurrentStreak = 0;
    }

    await client.query(
      `UPDATE user_profiles
       SET total_games = $1,
           total_wins = $2,
           total_playtime = $3,
           current_win_streak = $4,
           best_win_streak = $5,
           last_game_date = NOW()
       WHERE user_id = $6`,
      [newTotalGames, newTotalWins, newTotalPlaytime, newCurrentStreak, newBestStreak, userId]
    );

    await client.query('COMMIT');

    return {
      success: true,
      stats: {
        total_games: newTotalGames,
        total_wins: newTotalWins,
        total_playtime: newTotalPlaytime,
        current_win_streak: newCurrentStreak,
        best_win_streak: newBestStreak
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getRecentGames(userId: string, limit: number = 10) {
  const result = await pool.query(
    `SELECT id, game_name, result, score, duration, played_at
     FROM game_history
     WHERE user_id = $1
     ORDER BY played_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

export default pool;
