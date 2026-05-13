import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { join } from 'path';
import routes from './routes/index.js';
import { setupWebSocket } from './ws/payment-ws.js';
import { initTables } from './database/connection.js';
import bcrypt from 'bcryptjs';
import { getDb, queryOne, run } from './database/connection.js';

const HTTP_PORT = parseInt(process.env.HTTP_PORT || '9528');
const app = express();

app.use(cors());
app.use(express.json());

// Serve static customer payment page
app.use(express.static(join(process.cwd(), '../../public')));
app.use('/', routes);

async function start() {
  await initTables();

  // Seed default admin users
  const hash = await bcrypt.hash('123456', 10);
  const defaults = [
    { username: 'Super', real_name: '超级管理员', roles: '["R_SUPER"]' },
    { username: 'Soybean', real_name: 'Soybean', roles: '["R_SUPER"]' },
    { username: 'Admin', real_name: '管理员', roles: '["R_ADMIN"]' },
    { username: 'User', real_name: '普通用户', roles: '["R_USER"]' },
  ];
  for (const u of defaults) {
    const exists = queryOne('SELECT id FROM users WHERE username=?', [u.username]);
    if (!exists) {
      run('INSERT INTO users (username, password_hash, real_name, email, phone, roles, status) VALUES (?,?,?,?,?,?,?)',
        [u.username, hash, u.real_name, '', '', u.roles, '1']);
      console.log('[Seed] Created user:', u.username);
    }
  }

  const server = http.createServer(app);
  await setupWebSocket(server);

  server.listen(HTTP_PORT, () => {
    console.log('[Server] HTTP + WS running on port', HTTP_PORT);
  });
}

start().catch(e => { console.error(e); process.exit(1); });
