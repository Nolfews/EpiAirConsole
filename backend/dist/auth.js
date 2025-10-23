"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("./db"));
const crypto_1 = require("crypto");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
router.post('/signup', async (req, res) => {
    const { firstName, lastName, username, email, password } = req.body || {};
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'username, email and password required' });
    }
    try {
        const id = (0, crypto_1.randomUUID)();
        const password_hash = await bcryptjs_1.default.hash(password, 10);
        await db_1.default.query('INSERT INTO users(id, first_name, last_name, username, email, password_hash) VALUES($1,$2,$3,$4,$5,$6)', [id, firstName || null, lastName || null, username, email, password_hash]);
        const token = jsonwebtoken_1.default.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ ok: true, token });
    }
    catch (err) {
        console.error('signup error', err);
        res.status(500).json({ error: err.message || 'signup failed' });
    }
});
router.post('/signin', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password)
        return res.status(400).json({ error: 'username and password required' });
    try {
        const r = await db_1.default.query('SELECT id, username, password_hash FROM users WHERE username = $1 OR email = $1 LIMIT 1', [username]);
        if (r.rowCount === 0)
            return res.status(401).json({ error: 'invalid credentials' });
        const user = r.rows[0];
        const ok = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!ok)
            return res.status(401).json({ error: 'invalid credentials' });
        const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ ok: true, token });
    }
    catch (err) {
        console.error('signin error', err);
        res.status(500).json({ error: err.message || 'signin failed' });
    }
});
exports.default = router;
