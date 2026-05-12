import { getDb, queryAll, queryOne, run } from '../database/connection.js';
import bcrypt from 'bcryptjs';

export async function getUserList(params: any) {
  const db = await getDb();
  let sql = 'SELECT * FROM users WHERE 1=1';
  const bindings: any[] = [];

  if (params.userName) { sql += ' AND username LIKE ?'; bindings.push('%' + params.userName + '%'); }
  if (params.realName) { sql += ' AND real_name LIKE ?'; bindings.push('%' + params.realName + '%'); }
  if (params.status) { sql += ' AND status = ?'; bindings.push(params.status); }

  const totalRow = queryAll('SELECT COUNT(*) as count FROM (' + sql + ')', bindings);
  const total = totalRow[0]?.count || 0;

  const page = parseInt(params.current) || 1;
  const pageSize = parseInt(params.size) || 10;
  sql += ' LIMIT ? OFFSET ?';
  bindings.push(pageSize, (page - 1) * pageSize);

  const rows = queryAll(sql, bindings);

  return {
    records: rows.map((r: any) => ({
      id: r.id, userName: r.username, realName: r.real_name,
      email: r.email, phone: r.phone, avatar: '',
      roles: JSON.parse(r.roles || '[]'),
      status: r.status,
      createTime: r.created_at, updateTime: r.updated_at
    })),
    current: page, size: pageSize, total
  };
}

export async function createUser(data: any) {
  const hash = await bcrypt.hash(data.password || '123456', 10);
  const roles = JSON.stringify(data.roles || ['R_USER']);
  run('INSERT INTO users (username, password_hash, real_name, email, phone, roles, status) VALUES (?,?,?,?,?,?,?)',
    [data.userName, hash, data.realName, data.email, data.phone, roles, data.status || '1']);
}

export async function updateUser(data: any) {
  const sets: string[] = [];
  const vals: any[] = [];
  sets.push('username=?'); vals.push(data.userName);
  sets.push('real_name=?'); vals.push(data.realName);
  sets.push('email=?'); vals.push(data.email);
  sets.push('phone=?'); vals.push(data.phone);
  sets.push('roles=?'); vals.push(JSON.stringify(data.roles || ['R_USER']));
  sets.push('status=?'); vals.push(data.status || '1');
  sets.push("updated_at=datetime('now')");

  if (data.password) {
    const hash = await bcrypt.hash(data.password, 10);
    sets.push('password_hash=?');
    vals.push(hash);
  }
  vals.push(data.id);
  run('UPDATE users SET ' + sets.join(',') + ' WHERE id=?', vals);
}

export async function deleteUsers(ids: string[]) {
  run('DELETE FROM users WHERE id IN (' + ids.map(() => '?').join(',') + ')', ids.map(Number));
}
