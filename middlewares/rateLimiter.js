const rateLimitModule = require('express-rate-limit');
const rateLimit = rateLimitModule.default || rateLimitModule;
const { ipKeyGenerator } = rateLimitModule;

// 全局速率限制：每个 IP 每分钟最多 300 次请求。
// 小游戏用户可能共享学校、公司或家庭公网 IP，不能把用户数直接当成 IP 数。
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: -1, msg: 'Too many requests, please try again later.' },
  validate: { xForwardedForHeader: false, forwardedHeader: false },
});

// 业务写操作按用户 openid 限速，避免同一账号通过多 IP 连续刷奖励。
const userActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.user?.openid || ipKeyGenerator(req.ip || ''),
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: -1, msg: 'Too many actions, please try again later.' },
  validate: { xForwardedForHeader: false, forwardedHeader: false },
});

// 登录接口限制：每个 IP 每分钟最多 10 次
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: -1, msg: 'Too many login attempts, please try again later.' },
  validate: { xForwardedForHeader: false, forwardedHeader: false },
});

module.exports = { globalLimiter, loginLimiter, userActionLimiter };
