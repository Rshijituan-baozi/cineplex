const http = require('http');

let users = [
  { id: 1, userName: 'Soybean', realName: 'Soybean', email: 'soybean@example.com', phone: '13800000001', avatar: '', roles: ['R_SUPER'], status: '1', createTime: '2024-01-01 10:00:00', updateTime: '2024-01-01 10:00:00' },
  { id: 2, userName: 'Admin', realName: '管理员', email: 'admin@example.com', phone: '13800000002', avatar: '', roles: ['R_ADMIN'], status: '1', createTime: '2024-01-02 10:00:00', updateTime: '2024-01-02 10:00:00' },
  { id: 3, userName: 'User', realName: '普通用户', email: 'user@example.com', phone: '13800000003', avatar: '', roles: ['R_USER'], status: '1', createTime: '2024-01-03 10:00:00', updateTime: '2024-01-03 10:00:00' },
  { id: 4, userName: 'test1', realName: '测试用户1', email: 'test1@example.com', phone: '13800000004', avatar: '', roles: ['R_USER'], status: '2', createTime: '2024-01-04 10:00:00', updateTime: '2024-01-04 10:00:00' },
  { id: 5, userName: 'test2', realName: '测试用户2', email: 'test2@example.com', phone: '13800000005', avatar: '', roles: ['R_USER'], status: '1', createTime: '2024-01-05 10:00:00', updateTime: '2024-01-05 10:00:00' },
];

const TOKEN_STORE = {};

function json(data, code = '0000', msg = '请求成功') {
  return JSON.stringify({ code, msg, data });
}

function paginate(arr, page = 1, pageSize = 10) {
  const total = arr.length;
  const start = (page - 1) * pageSize;
  const records = arr.slice(start, start + pageSize);
  return { records, current: page, size: pageSize, total };
}

function parseBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

const routes = {
  'POST /auth/login': async (body) => {
    const { userName, password } = body;
    const user = users.find(u => u.userName === userName);
    if (!user || password !== '123456') {
      return { status: 200, body: json(null, '1001', '用户名或密码错误') };
    }
    const token = 'mock_token_' + userName + '_' + Date.now();
    const refreshToken = 'mock_refresh_' + userName + '_' + Date.now();
    TOKEN_STORE[token] = user;
    return { status: 200, body: json({ token, refreshToken }) };
  },

  'GET /auth/getUserInfo': async (body, headers) => {
    const auth = headers.authorization || '';
    const token = auth.replace('Bearer ', '');
    const user = TOKEN_STORE[token];
    if (!user) {
      return { status: 200, body: json(null, '8888', '用户未登录') };
    }
    return { status: 200, body: json({ userId: String(user.id), userName: user.userName, roles: user.roles, buttons: ['B_CODE1', 'B_CODE2', 'B_CODE3'] }) };
  },

  'POST /auth/refreshToken': async (body) => {
    return { status: 200, body: json({ token: 'refreshed_token', refreshToken: 'refreshed_refresh' }) };
  },

  'GET /user/list': async (body, headers, query) => {
    let filtered = [...users];
    if (query?.userName) filtered = filtered.filter(u => u.userName.includes(query.userName));
    if (query?.realName) filtered = filtered.filter(u => u.realName.includes(query.realName));
    if (query?.status) filtered = filtered.filter(u => u.status === query.status);
    const page = parseInt(query?.page || query?.current) || 1;
    const pageSize = parseInt(query?.pageSize || query?.size) || 10;
    return { status: 200, body: json(paginate(filtered, page, pageSize)) };
  },

  'POST /user/create': async (body) => {
    const maxId = users.reduce((max, u) => Math.max(max, u.id), 0);
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const newUser = { id: maxId + 1, ...body, createTime: now, updateTime: now };
    users.push(newUser);
    return { status: 200, body: json(null) };
  },

  'POST /user/update': async (body) => {
    const idx = users.findIndex(u => u.id === body.id);
    if (idx === -1) return { status: 200, body: json(null, '1002', '用户不存在') };
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    users[idx] = { ...users[idx], ...body, updateTime: now };
    return { status: 200, body: json(null) };
  },

  'DELETE /user/delete': async (body) => {
    const { ids } = body;
    users = users.filter(u => !ids.includes(String(u.id)));
    return { status: 200, body: json(null) };
  },

  'GET /user/detail': async (body, headers, query) => {
    const user = users.find(u => u.id === parseInt(query?.id));
    if (!user) return { status: 200, body: json(null, '1002', '用户不存在') };
    return { status: 200, body: json(user) };
  }
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apifoxToken');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const query = Object.fromEntries(url.searchParams.entries());
  const routeKey = `${req.method} ${path}`;

  const body = req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE' ? await parseBody(req) : {};

  const handler = routes[routeKey];

  if (handler) {
    const result = await handler(body, req.headers, query);
    res.writeHead(result.status || 200);
    res.end(result.body);
  } else {
    res.writeHead(404);
    res.end(json(null, '1003', '接口不存在'));
  }
});

const PORT = 9528;
server.listen(PORT, () => {
  console.log(`Mock server running at http://localhost:${PORT}`);
});
