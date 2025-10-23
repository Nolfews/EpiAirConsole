"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = initDb;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = new pg_1.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    user: process.env.DB_USER || undefined,
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME || undefined,
});
async function initDb() {
    const sql = `
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
    await pool.query(sql);
}
exports.default = pool;
