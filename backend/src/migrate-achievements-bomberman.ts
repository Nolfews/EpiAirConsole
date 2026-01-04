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

async function migrateBombermanAchievements() {
  try {
    console.log('🚀 Starting Bomberman achievements migration...');

    const updateCategoryCheck = `
      ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_category_check;
      ALTER TABLE achievements ADD CONSTRAINT achievements_category_check
        CHECK (category IN ('playtime', 'games_played', 'wins', 'win_streak', 'tetris', 'tank_battle', 'brick_breaker', 'quiz', 'bomberman'));
    `;
    await pool.query(updateCategoryCheck);
    console.log('✅ Updated achievements category constraint');

    const updateRequirementCheck = `
      ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_requirement_type_check;
      ALTER TABLE achievements ADD CONSTRAINT achievements_requirement_type_check
        CHECK (requirement_type IN ('total_playtime', 'total_games', 'total_wins', 'best_win_streak', 'tetris_score', 'tank_kills', 'brick_breaker_score', 'quiz_correct', 'bomberman_wins', 'bomberman_walls_destroyed', 'bomberman_power_ups'));
    `;
    await pool.query(updateRequirementCheck);
    console.log('✅ Updated achievements requirement_type constraint');

    const addBombermanStatsColumns = `
      DO $$
      BEGIN
        -- Bomberman stats
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name='user_profiles' AND column_name='bomberman_wins') THEN
          ALTER TABLE user_profiles ADD COLUMN bomberman_wins INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name='user_profiles' AND column_name='bomberman_walls_destroyed') THEN
          ALTER TABLE user_profiles ADD COLUMN bomberman_walls_destroyed INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name='user_profiles' AND column_name='bomberman_power_ups_collected') THEN
          ALTER TABLE user_profiles ADD COLUMN bomberman_power_ups_collected INTEGER DEFAULT 0;
        END IF;
      END $$;
    `;
    await pool.query(addBombermanStatsColumns);
    console.log('✅ Added Bomberman stats columns to user_profiles');

    const bombermanAchievements = [
      { id: 'bomberman_win_1', name: 'First Explosion', description: 'Win your first Bomberman game', icon: '💣', category: 'bomberman', requirement_type: 'bomberman_wins', requirement_value: 1, tier: 'bronze' },
      { id: 'bomberman_win_5', name: 'Bomb Specialist', description: 'Win 5 Bomberman games', icon: '💥', category: 'bomberman', requirement_type: 'bomberman_wins', requirement_value: 5, tier: 'silver' },
      { id: 'bomberman_win_10', name: 'Explosion Master', description: 'Win 10 Bomberman games', icon: '🔥', category: 'bomberman', requirement_type: 'bomberman_wins', requirement_value: 10, tier: 'gold' },
      { id: 'bomberman_win_25', name: 'Demolition Expert', description: 'Win 25 Bomberman games', icon: '💀', category: 'bomberman', requirement_type: 'bomberman_wins', requirement_value: 25, tier: 'platinum' },
      { id: 'bomberman_win_50', name: 'Bomb Legend', description: 'Win 50 Bomberman games', icon: '👑', category: 'bomberman', requirement_type: 'bomberman_wins', requirement_value: 50, tier: 'diamond' },

      { id: 'bomberman_walls_10', name: 'Wall Breaker', description: 'Destroy 10 walls', icon: '🧱', category: 'bomberman', requirement_type: 'bomberman_walls_destroyed', requirement_value: 10, tier: 'bronze' },
      { id: 'bomberman_walls_50', name: 'Wrecking Crew', description: 'Destroy 50 walls', icon: '🔨', category: 'bomberman', requirement_type: 'bomberman_walls_destroyed', requirement_value: 50, tier: 'silver' },
      { id: 'bomberman_walls_100', name: 'Destruction Master', description: 'Destroy 100 walls', icon: '💥', category: 'bomberman', requirement_type: 'bomberman_walls_destroyed', requirement_value: 100, tier: 'gold' },
      { id: 'bomberman_walls_250', name: 'Demolition Zone', description: 'Destroy 250 walls', icon: '🏚️', category: 'bomberman', requirement_type: 'bomberman_walls_destroyed', requirement_value: 250, tier: 'platinum' },
      { id: 'bomberman_walls_500', name: 'Total Annihilation', description: 'Destroy 500 walls', icon: '☠️', category: 'bomberman', requirement_type: 'bomberman_walls_destroyed', requirement_value: 500, tier: 'diamond' },

      { id: 'bomberman_powerup_5', name: 'Power Hunter', description: 'Collect 5 power-ups', icon: '✨', category: 'bomberman', requirement_type: 'bomberman_power_ups', requirement_value: 5, tier: 'bronze' },
      { id: 'bomberman_powerup_25', name: 'Power Collector', description: 'Collect 25 power-ups', icon: '💎', category: 'bomberman', requirement_type: 'bomberman_power_ups', requirement_value: 25, tier: 'silver' },
      { id: 'bomberman_powerup_50', name: 'Power Master', description: 'Collect 50 power-ups', icon: '🌟', category: 'bomberman', requirement_type: 'bomberman_power_ups', requirement_value: 50, tier: 'gold' },
      { id: 'bomberman_powerup_100', name: 'Power Hoarder', description: 'Collect 100 power-ups', icon: '💫', category: 'bomberman', requirement_type: 'bomberman_power_ups', requirement_value: 100, tier: 'platinum' },
      { id: 'bomberman_powerup_200', name: 'Ultimate Power', description: 'Collect 200 power-ups', icon: '⭐', category: 'bomberman', requirement_type: 'bomberman_power_ups', requirement_value: 200, tier: 'diamond' },
    ];

    for (const achievement of bombermanAchievements) {
      await pool.query(
        `INSERT INTO achievements (id, name, description, icon, category, requirement_type, requirement_value, tier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [achievement.id, achievement.name, achievement.description, achievement.icon, achievement.category, achievement.requirement_type, achievement.requirement_value, achievement.tier]
      );
    }
    console.log(`✅ Inserted ${bombermanAchievements.length} Bomberman achievements`);

    console.log('✨ Bomberman achievements migration completed successfully!');
  } catch (err) {
    console.error('❌ Error during Bomberman achievements migration:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

migrateBombermanAchievements();
