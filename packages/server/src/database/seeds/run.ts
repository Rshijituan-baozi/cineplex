import db from '../connection.js';
import bcrypt from 'bcryptjs';

export async function run() {
  console.log('Seeding database...');

  const hash = await bcrypt.hash('123456', 10);

  const users = [
    { username: 'Super', password_hash: hash, real_name: '超级管理员', email: 'super@example.com', phone: '', roles: JSON.stringify(['R_SUPER']), status: '1' },
    { username: 'Soybean', password_hash: hash, real_name: 'Soybean', email: 'soybean@example.com', phone: '13800000001', roles: JSON.stringify(['R_SUPER']), status: '1' },
    { username: 'Admin', password_hash: hash, real_name: '管理员', email: 'admin@example.com', phone: '13800000002', roles: JSON.stringify(['R_ADMIN']), status: '1' },
    { username: 'User', password_hash: hash, real_name: '普通用户', email: 'user@example.com', phone: '13800000003', roles: JSON.stringify(['R_USER']), status: '1' },
  ];

  for (const u of users) {
    const exists = await db('users').where({ username: u.username }).first();
    if (!exists) {
      await db('users').insert(u);
      console.log('  Created user:', u.username);
    } else {
      console.log('  Skipped user:', u.username);
    }
  }

  console.log('Seed done.');
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
