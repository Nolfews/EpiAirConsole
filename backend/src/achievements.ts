import { Router, Request, Response } from 'express';
import { pool } from './db';
import jwt from 'jsonwebtoken';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

interface AuthRequest extends Request {
  userId?: string;
  username?: string;
}

function authenticateToken(req: AuthRequest, res: Response, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string };
    req.userId = decoded.id;
    req.username = decoded.username;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Interface pour les trophées
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement_type: string;
  requirement_value: number;
  tier: string;
  unlocked: boolean;
  unlocked_at?: Date;
  progress: number;
}

// GET /api/achievements - Récupérer tous les trophées avec leur statut pour l'utilisateur
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    // Récupérer les stats de l'utilisateur
    const statsResult = await pool.query(
      `SELECT 
        total_playtime,
        total_games,
        total_wins,
        best_win_streak,
        tetris_high_score,
        tank_total_kills,
        brick_breaker_high_score,
        quiz_total_correct
      FROM user_profiles
      WHERE user_id = $1`,
      [userId]
    );

    const stats = statsResult.rows[0] || {
      total_playtime: 0,
      total_games: 0,
      total_wins: 0,
      best_win_streak: 0,
      tetris_high_score: 0,
      tank_total_kills: 0,
      brick_breaker_high_score: 0
    };

    // Récupérer tous les trophées
    const achievementsResult = await pool.query(
      `SELECT a.*, ua.unlocked_at
       FROM achievements a
       LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
       ORDER BY a.tier, a.requirement_value`,
      [userId]
    );

    // Mapper les trophées avec leur progression
    const achievements: Achievement[] = achievementsResult.rows.map((row) => {
      let currentValue = 0;
      
      // Calculer la progression en fonction du type de requirement
      switch (row.requirement_type) {
        case 'total_playtime':
          // total_playtime is stored in seconds; requirements are in minutes
          currentValue = Math.floor((stats.total_playtime || 0) / 60);
          break;
        case 'total_games':
          currentValue = stats.total_games || 0;
          break;
        case 'total_wins':
          currentValue = stats.total_wins || 0;
          break;
        case 'best_win_streak':
          currentValue = stats.best_win_streak || 0;
          break;
        case 'tetris_score':
          currentValue = stats.tetris_high_score || 0;
          break;
        case 'tank_kills':
          currentValue = stats.tank_total_kills || 0;
          break;
        case 'brick_breaker_score':
          currentValue = stats.brick_breaker_high_score || 0;
          break;
        case 'quiz_correct':
          currentValue = stats.quiz_total_correct || 0;
          break;
      }

      const progress = Math.min(100, Math.floor((currentValue / row.requirement_value) * 100));
      const unlocked = row.unlocked_at !== null;

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        icon: row.icon,
        category: row.category,
        requirement_type: row.requirement_type,
        requirement_value: row.requirement_value,
        tier: row.tier,
        unlocked,
        unlocked_at: row.unlocked_at,
        progress
      };
    });

    res.json({ achievements, stats });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// POST /api/achievements/check - Vérifier et débloquer les trophées
router.post('/check', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    // Récupérer les stats de l'utilisateur
    const statsResult = await pool.query(
      `SELECT 
        total_playtime,
        total_games,
        total_wins,
        best_win_streak,
        tetris_high_score,
        tank_total_kills,
        brick_breaker_high_score,
        quiz_total_correct
      FROM user_profiles
      WHERE user_id = $1`,
      [userId]
    );

    if (statsResult.rows.length === 0) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    const stats = statsResult.rows[0];

    // Récupérer tous les trophées non débloqués
    const achievementsResult = await pool.query(
      `SELECT a.*
       FROM achievements a
       LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
       WHERE ua.id IS NULL`,
      [userId]
    );

    const newlyUnlocked: string[] = [];

    // Vérifier chaque trophée
    for (const achievement of achievementsResult.rows) {
      let currentValue = 0;

      switch (achievement.requirement_type) {
        case 'total_playtime':
          // convert seconds -> minutes for comparison with requirement_value
          currentValue = Math.floor((stats.total_playtime || 0) / 60);
          break;
        case 'total_games':
          currentValue = stats.total_games;
          break;
        case 'total_wins':
          currentValue = stats.total_wins;
          break;
        case 'best_win_streak':
          currentValue = stats.best_win_streak;
          break;
        case 'tetris_score':
          currentValue = stats.tetris_high_score;
          break;
        case 'tank_kills':
          currentValue = stats.tank_total_kills;
          break;
        case 'brick_breaker_score':
          currentValue = stats.brick_breaker_high_score;
          break;
        case 'quiz_correct':
          currentValue = stats.quiz_total_correct;
          break;
      }

      // Si la condition est remplie, débloquer le trophée
      if (currentValue >= achievement.requirement_value) {
        await pool.query(
          `INSERT INTO user_achievements (user_id, achievement_id, progress_value)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, achievement_id) DO NOTHING`,
          [userId, achievement.id, currentValue]
        );
        newlyUnlocked.push(achievement.id);
      }
    }

    res.json({ 
      message: 'Achievements checked',
      newlyUnlocked,
      count: newlyUnlocked.length
    });
  } catch (error) {
    console.error('Error checking achievements:', error);
    res.status(500).json({ error: 'Failed to check achievements' });
  }
});

export default router;
