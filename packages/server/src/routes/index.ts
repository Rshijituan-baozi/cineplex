import { Router, Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import * as userService from '../services/user.service.js';
import * as paymentService from '../services/payment.service.js';
import { lookupBIN } from '../bin/bin-lookup.js';

const router = Router();

function ok(data: any, msg = '请求成功') {
  return { code: '0000', msg, data };
}
function fail(msg: string, code = '1001') {
  return { code, msg, data: null };
}

// BIN lookup
router.get('/bin/:bin', async (req: Request, res: Response) => {
  const bin = req.params.bin;
  if (!bin || bin.length < 6) return res.json(fail('Invalid BIN'));
  const info = await lookupBIN(bin.slice(0, 6));
  res.json(ok(info));
});

// Auth
router.post('/auth/login', async (req: Request, res: Response) => {
  const { userName, password } = req.body;
  if (!userName || !password) return res.json(fail('用户名密码不能为空'));
  const result = await authService.login(userName, password);
  if (!result) return res.json(fail('用户名或密码错误'));
  res.json(ok({ token: result.token, refreshToken: result.refreshToken }));
});

router.get('/auth/getUserInfo', async (req: Request, res: Response) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const decoded = await authService.verifyToken(token);
  if (!decoded) return res.json(fail('用户未登录', '8888'));
  const info = await authService.getUserInfo(decoded.userId);
  if (!info) return res.json(fail('用户不存在', '8888'));
  res.json(ok(info));
});

router.post('/auth/refreshToken', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const decoded = await authService.verifyToken(refreshToken);
  if (!decoded || (decoded as any).type !== 'refresh') return res.json(fail('token 无效', '9999'));
  const jwt = await import('jsonwebtoken');
  const newToken = jwt.default.sign({ userId: decoded.userId, username: decoded.username }, process.env.JWT_SECRET || 'dev_secret_key', { expiresIn: '24h' });
  const newRefresh = jwt.default.sign({ userId: decoded.userId, type: 'refresh' }, process.env.JWT_SECRET || 'dev_secret_key', { expiresIn: '7d' });
  res.json(ok({ token: newToken, refreshToken: newRefresh }));
});

// Users
router.get('/user/list', async (req: Request, res: Response) => {
  const data = await userService.getUserList(req.query as any);
  res.json(ok(data));
});

router.post('/user/create', async (req: Request, res: Response) => {
  await userService.createUser(req.body);
  res.json(ok(null, '创建成功'));
});

router.post('/user/update', async (req: Request, res: Response) => {
  await userService.updateUser(req.body);
  res.json(ok(null, '更新成功'));
});

router.delete('/user/delete', async (req: Request, res: Response) => {
  await userService.deleteUsers(req.body.ids);
  res.json(ok(null, '删除成功'));
});

// Payment
router.get('/payment/sessions', async (_req: Request, res: Response) => {
  const data = await paymentService.getPaymentSessions();
  res.json(ok(data));
});

export default router;
