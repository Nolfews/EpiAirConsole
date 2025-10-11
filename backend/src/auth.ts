import { Router } from 'express';
import pool from './db';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

router.post('/signup', async (req, res) => {
    const { firstName, lastName, username, email, password } = req.body || {};
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'username, email and password required' });
    }
    try {
        const id = randomUUID();
        const password_hash = await bcrypt.hash(password, 10);
        await pool.query(
        'INSERT INTO users(id, first_name, last_name, username, email, password_hash) VALUES($1,$2,$3,$4,$5,$6)',
        [id, firstName || null, lastName || null, username, email, password_hash]
        );
        const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ ok: true, token });
    } catch (err: any) {
        console.error('signup error', err);
        res.status(500).json({ error: err.message || 'signup failed' });
    }
});

router.post('/signin', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password)
        return res.status(400).json({ error: 'username and password required' });
    try {
        const r = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1 OR email = $1 LIMIT 1', [username]);
        if (r.rowCount === 0) return res.status(401).json({ error: 'invalid credentials' });
        const user = r.rows[0];
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'invalid credentials' });
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ ok: true, token });
    } catch (err: any) {
        console.error('signin error', err);
        res.status(500).json({ error: err.message || 'signin failed' });
    }
});

export default router;
