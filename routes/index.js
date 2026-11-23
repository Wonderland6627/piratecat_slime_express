var express = require('express');
var router = express.Router();
const { getVersionInfo } = require('../utils/version');
const db = require('../utils/db');

/* GET home page - 由 express.static 提供 public/index.html，此为 fallback */
router.get('/', function(req, res) {
  res.json({ status: 'ok', service: 'Slime Express' });
});

/**
 * GET /api/version
 * 获取服务版本信息（用于验证部署版本）
 */
router.get('/api/version', function(req, res, next) {
  res.json({
    code: 0,
    data: getVersionInfo(),
    msg: 'success'
  });
});

/**
 * POST /api/time
 * 获取服务器时间
 */
router.post('/api/time', function(req, res, next) {
  const now = new Date();
  res.json({
    code: 0,
    data: {
      timestamp: now.getTime(),
      datetime: now.toISOString()
    },
    msg: 'success'
  });
});

/**
 * GET /health
 * 健康检查端点（用于云托管健康检查）
 */
router.get('/health', function(req, res, next) {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /ready
 * 数据库是否可查询。给发布后的人工确认用，不作为宝塔探活地址。
 */
router.get('/ready', async function(req, res) {
  try {
    await db.getPool().query('SELECT 1');
    res.json({
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(503).json({
      status: 'unavailable',
      database: 'down',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
