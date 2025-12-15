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

async function migrateAchievements() {
  try {
    // Table des définitions de trophées
    const achievementsTable = `
      CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('playtime', 'games_played', 'wins', 'win_streak', 'tetris', 'tank_battle', 'brick_breaker')),
        requirement_type TEXT NOT NULL CHECK (requirement_type IN ('total_playtime', 'total_games', 'total_wins', 'best_win_streak', 'tetris_score', 'tank_kills', 'brick_breaker_score')),
        requirement_value INTEGER NOT NULL,
        tier TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `;
    await pool.query(achievementsTable);

    // Table des trophées débloqués par les utilisateurs
    const userAchievementsTable = `
      CREATE TABLE IF NOT EXISTS user_achievements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        achievement_id TEXT REFERENCES achievements(id) ON DELETE CASCADE,
        unlocked_at TIMESTAMPTZ DEFAULT now(),
        progress_value INTEGER DEFAULT 0,
        UNIQUE(user_id, achievement_id)
      );
    `;
    await pool.query(userAchievementsTable);

    // Ajout de colonnes pour stats spécifiques par jeu dans user_profiles
    const addGameStatsColumns = `
      DO $$ 
      BEGIN
        -- Tetris stats
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='user_profiles' AND column_name='tetris_high_score') THEN
          ALTER TABLE user_profiles ADD COLUMN tetris_high_score INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='user_profiles' AND column_name='tetris_total_lines') THEN
          ALTER TABLE user_profiles ADD COLUMN tetris_total_lines INTEGER DEFAULT 0;
        END IF;

        -- Tank Battle stats
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='user_profiles' AND column_name='tank_total_kills') THEN
          ALTER TABLE user_profiles ADD COLUMN tank_total_kills INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='user_profiles' AND column_name='tank_total_deaths') THEN
          ALTER TABLE user_profiles ADD COLUMN tank_total_deaths INTEGER DEFAULT 0;
        END IF;

        -- Brick Breaker stats
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='user_profiles' AND column_name='brick_breaker_high_score') THEN
          ALTER TABLE user_profiles ADD COLUMN brick_breaker_high_score INTEGER DEFAULT 0;
        END IF;
      END $$;
    `;
    await pool.query(addGameStatsColumns);

    // Index pour performance
    const indexes = `
      CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
      CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
    `;
    await pool.query(indexes);

    // Insertion des trophées prédéfinis
    const achievements = [
      // Temps de jeu (en minutes)
      { id: 'playtime_1h', name: 'Beginner', description: 'Play for 1 hour', icon: '🕐', category: 'playtime', requirement_type: 'total_playtime', requirement_value: 60, tier: 'bronze' },
      { id: 'playtime_5h', name: 'Regular Player', description: 'Play for 5 hours', icon: '🕔', category: 'playtime', requirement_type: 'total_playtime', requirement_value: 300, tier: 'silver' },
      { id: 'playtime_10h', name: 'Addict', description: 'Play for 10 hours', icon: '🕙', category: 'playtime', requirement_type: 'total_playtime', requirement_value: 600, tier: 'gold' },
      { id: 'playtime_50h', name: 'Veteran', description: 'Play for 50 hours', icon: '⏰', category: 'playtime', requirement_type: 'total_playtime', requirement_value: 3000, tier: 'platinum' },
      { id: 'playtime_100h', name: 'Legend', description: 'Play for 100 hours', icon: '👑', category: 'playtime', requirement_type: 'total_playtime', requirement_value: 6000, tier: 'diamond' },

      // Nombre de parties
      { id: 'games_10', name: 'First Ten', description: 'Play 10 games', icon: '🎮', category: 'games_played', requirement_type: 'total_games', requirement_value: 10, tier: 'bronze' },
      { id: 'games_50', name: 'Fifty Played', description: 'Play 50 games', icon: '🎯', category: 'games_played', requirement_type: 'total_games', requirement_value: 50, tier: 'silver' },
      { id: 'games_100', name: 'Centurion', description: 'Play 100 games', icon: '💯', category: 'games_played', requirement_type: 'total_games', requirement_value: 100, tier: 'gold' },
      { id: 'games_500', name: 'Marathoner', description: 'Play 500 games', icon: '🏃', category: 'games_played', requirement_type: 'total_games', requirement_value: 500, tier: 'platinum' },
      { id: 'games_1000', name: 'Eternal Champion', description: 'Play 1000 games', icon: '🏆', category: 'games_played', requirement_type: 'total_games', requirement_value: 1000, tier: 'diamond' },

      // Victoires totales
      { id: 'wins_10', name: '10x Winner', description: 'Win 10 games', icon: '🥉', category: 'wins', requirement_type: 'total_wins', requirement_value: 10, tier: 'bronze' },
      { id: 'wins_50', name: 'Champion', description: 'Win 50 games', icon: '🥈', category: 'wins', requirement_type: 'total_wins', requirement_value: 50, tier: 'silver' },
      { id: 'wins_100', name: 'Grand Champion', description: 'Win 100 games', icon: '🥇', category: 'wins', requirement_type: 'total_wins', requirement_value: 100, tier: 'gold' },
      { id: 'wins_500', name: 'Invincible', description: 'Win 500 games', icon: '💪', category: 'wins', requirement_type: 'total_wins', requirement_value: 500, tier: 'platinum' },
      { id: 'wins_1000', name: 'Victory Deity', description: 'Win 1000 games', icon: '⚡', category: 'wins', requirement_type: 'total_wins', requirement_value: 1000, tier: 'diamond' },

      // Win streaks
      { id: 'streak_3', name: 'On A Roll', description: 'Win 3 games in a row', icon: '🔥', category: 'win_streak', requirement_type: 'best_win_streak', requirement_value: 3, tier: 'bronze' },
      { id: 'streak_5', name: 'Hot Streak', description: 'Win 5 games in a row', icon: '🔥🔥', category: 'win_streak', requirement_type: 'best_win_streak', requirement_value: 5, tier: 'silver' },
      { id: 'streak_10', name: 'Unstoppable', description: 'Win 10 games in a row', icon: '🔥🔥🔥', category: 'win_streak', requirement_type: 'best_win_streak', requirement_value: 10, tier: 'gold' },
      { id: 'streak_20', name: 'Total Domination', description: 'Win 20 games in a row', icon: '🌟', category: 'win_streak', requirement_type: 'best_win_streak', requirement_value: 20, tier: 'platinum' },
      { id: 'streak_50', name: 'Absolute Perfection', description: 'Win 50 games in a row', icon: '✨', category: 'win_streak', requirement_type: 'best_win_streak', requirement_value: 50, tier: 'diamond' },

      // Tetris - Scores
      { id: 'tetris_1k', name: 'Tetris Beginner', description: 'Reach 1000 points in Tetris', icon: '🟦', category: 'tetris', requirement_type: 'tetris_score', requirement_value: 1000, tier: 'bronze' },
      { id: 'tetris_5k', name: 'Assembler', description: 'Reach 5000 points in Tetris', icon: '🟨', category: 'tetris', requirement_type: 'tetris_score', requirement_value: 5000, tier: 'silver' },
      { id: 'tetris_10k', name: 'Block Master', description: 'Reach 10000 points in Tetris', icon: '🟩', category: 'tetris', requirement_type: 'tetris_score', requirement_value: 10000, tier: 'gold' },
      { id: 'tetris_50k', name: 'Tetris Expert', description: 'Reach 50000 points in Tetris', icon: '🟪', category: 'tetris', requirement_type: 'tetris_score', requirement_value: 50000, tier: 'platinum' },
      { id: 'tetris_100k', name: 'Tetris Legend', description: 'Reach 100000 points in Tetris', icon: '🟥', category: 'tetris', requirement_type: 'tetris_score', requirement_value: 100000, tier: 'diamond' },

      // Tank Battle - Kills
      { id: 'tank_10', name: 'Tank Novice', description: '10 kills in Tank Battle', icon: '🚗', category: 'tank_battle', requirement_type: 'tank_kills', requirement_value: 10, tier: 'bronze' },
      { id: 'tank_50', name: 'Soldier', description: '50 kills in Tank Battle', icon: '🚙', category: 'tank_battle', requirement_type: 'tank_kills', requirement_value: 50, tier: 'silver' },
      { id: 'tank_100', name: 'Sergeant', description: '100 kills in Tank Battle', icon: '🚕', category: 'tank_battle', requirement_type: 'tank_kills', requirement_value: 100, tier: 'gold' },
      { id: 'tank_500', name: 'General', description: '500 kills in Tank Battle', icon: '🚌', category: 'tank_battle', requirement_type: 'tank_kills', requirement_value: 500, tier: 'platinum' },
      { id: 'tank_1000', name: 'Marshal', description: '1000 kills in Tank Battle', icon: '🚛', category: 'tank_battle', requirement_type: 'tank_kills', requirement_value: 1000, tier: 'diamond' },

      // Brick Breaker - Scores
      { id: 'brick_500', name: 'Brick Breaker', description: '500 points in Brick Breaker', icon: '🧱', category: 'brick_breaker', requirement_type: 'brick_breaker_score', requirement_value: 500, tier: 'bronze' },
      { id: 'brick_2k', name: 'Demolisher', description: '2000 points in Brick Breaker', icon: '🔨', category: 'brick_breaker', requirement_type: 'brick_breaker_score', requirement_value: 2000, tier: 'silver' },
      { id: 'brick_5k', name: 'Destroyer', description: '5000 points in Brick Breaker', icon: '⚒️', category: 'brick_breaker', requirement_type: 'brick_breaker_score', requirement_value: 5000, tier: 'gold' },
      { id: 'brick_10k', name: 'Architect of Chaos', description: '10000 points in Brick Breaker', icon: '🔥', category: 'brick_breaker', requirement_type: 'brick_breaker_score', requirement_value: 10000, tier: 'platinum' },
      { id: 'brick_50k', name: 'Wall Annihilator', description: '50000 points in Brick Breaker', icon: '💥', category: 'brick_breaker', requirement_type: 'brick_breaker_score', requirement_value: 50000, tier: 'diamond' },
    ];

    for (const achievement of achievements) {
      await pool.query(
        `INSERT INTO achievements (id, name, description, icon, category, requirement_type, requirement_value, tier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [achievement.id, achievement.name, achievement.description, achievement.icon, achievement.category, achievement.requirement_type, achievement.requirement_value, achievement.tier]
      );
    }

    console.log('✅ Achievements migration completed successfully!');
    console.log(`   - ${achievements.length} achievements created`);
    console.log('   - user_achievements table created');
    console.log('   - Game-specific stats columns added to user_profiles');
    
  } catch (error) {
    console.error('❌ Error during achievements migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrateAchievements();
