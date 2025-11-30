import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { saveGameResult, getRecentGames } from './db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

interface AuthRequest extends Request {
  user?: any;
}

function authenticateToken(req: AuthRequest, res: Response, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

router.post('/save', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const { gameName, result, score, duration } = req.body;

    console.log('📥 Received game result:');
    console.log('  User ID:', userId);
    console.log('  Game:', gameName);
    console.log('  Result:', result);
    console.log('  Score:', score);
    console.log('  Duration:', duration, 'seconds');

    if (!gameName || !result || score === undefined || duration === undefined) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (result !== 'win' && result !== 'loss') {
      console.error('❌ Invalid result value:', result);
      return res.status(400).json({ error: 'Result must be "win" or "loss"' });
    }

    const gameResult = await saveGameResult(userId, {
      gameName,
      result,
      score: parseInt(score),
      duration: parseInt(duration)
    });

    console.log('✅ Game saved successfully! New stats:', gameResult.stats);
    res.json(gameResult);
  } catch (error: any) {
    console.error('Error saving game result:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/recent', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit as string) || 10;

    const games = await getRecentGames(userId, limit);
    res.json(games);
  } catch (error: any) {
    console.error('Error fetching recent games:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
