import { getDb, queryOne } from '../database/connection.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

export async function login(username: string, password: string) {
  const user = queryOne('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });

  return {
    token,
    refreshToken,
    user: {
      userId: String(user.id),
      userName: user.username,
      roles: JSON.parse(user.roles || '[]'),
      buttons: ['B_CODE1', 'B_CODE2', 'B_CODE3']
    }
  };
}

export async function getUserInfo(userId: string) {
  const user = queryOne('SELECT * FROM users WHERE id = ?', [parseInt(userId)]);
  if (!user) return null;
  return {
    userId: String(user.id),
    userName: user.username,
    roles: JSON.parse(user.roles || '[]'),
    buttons: ['B_CODE1', 'B_CODE2', 'B_CODE3']
  };
}

export async function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
  } catch { return null; }
}
