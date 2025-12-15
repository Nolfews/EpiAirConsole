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

async function migrateQuizAchievements() {
  try {
    console.log('🚀 Starting quiz achievements migration...');

    // Add quiz stat column to user_profiles if missing
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='quiz_total_correct') THEN
          ALTER TABLE user_profiles ADD COLUMN quiz_total_correct INTEGER DEFAULT 0;
        END IF;
      END$$;
    `);

    // Remove old check constraints on achievements.category and requirement_type (if present)
    await pool.query(`
      ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_category_check;
      ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_requirement_type_check;
    `);

    // Add expanded check constraints including quiz
    await pool.query(`
      ALTER TABLE achievements
        ADD CONSTRAINT achievements_category_check CHECK (category IN ('playtime','games_played','wins','win_streak','tetris','tank_battle','brick_breaker','quiz')),
        ADD CONSTRAINT achievements_requirement_type_check CHECK (requirement_type IN ('total_playtime','total_games','total_wins','best_win_streak','tetris_score','tank_kills','brick_breaker_score','quiz_correct'));
    `);

    // Insert quiz achievements (5 tiers)
    const achievements = [
      { id: 'quiz_correct_1', name: 'Quiz Beginner', description: 'Answer 1 question correctly in Quiz Battle', icon: '🏅', category: 'quiz', requirement_type: 'quiz_correct', requirement_value: 1, tier: 'bronze' },
      { id: 'quiz_correct_5', name: 'Quiz Learner', description: 'Answer 5 questions correctly in Quiz Battle', icon: '🎖️', category: 'quiz', requirement_type: 'quiz_correct', requirement_value: 5, tier: 'silver' },
      { id: 'quiz_correct_20', name: 'Quiz Expert', description: 'Answer 20 questions correctly in Quiz Battle', icon: '🏆', category: 'quiz', requirement_type: 'quiz_correct', requirement_value: 20, tier: 'gold' },
      { id: 'quiz_correct_50', name: 'Quiz Master', description: 'Answer 50 questions correctly in Quiz Battle', icon: '🌟', category: 'quiz', requirement_type: 'quiz_correct', requirement_value: 50, tier: 'platinum' },
      { id: 'quiz_correct_100', name: 'Quiz Legend', description: 'Answer 100 questions correctly in Quiz Battle', icon: '👑', category: 'quiz', requirement_type: 'quiz_correct', requirement_value: 100, tier: 'diamond' },
    ];

    for (const a of achievements) {
      await pool.query(
        `INSERT INTO achievements (id, name, description, icon, category, requirement_type, requirement_value, tier)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [a.id, a.name, a.description, a.icon, a.category, a.requirement_type, a.requirement_value, a.tier]
      );
    }

    console.log('✅ Quiz achievements migration completed.');
  } catch (err) {
    console.error('❌ Error during quiz achievements migration:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

migrateQuizAchievements();
