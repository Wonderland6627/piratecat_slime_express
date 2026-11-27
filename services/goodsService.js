// 物品服务层 —— 管理 goods 类型物品的增减
const db = require('../utils/db');
const { logger } = require('../utils/logger');
const configManager = require('../config/luban/configManager');
const { AppError } = require('../middlewares/errorHandler');
const { RESPONSE_CODE } = require('../config/constants');

/**
 * 获取用户所有物品
 * @param {string} openid
 * @returns {Promise<Object>} goods map e.g. { 1001: 3, 1002: 1 }
 */
async function getGoods(openid) {
  const userData = await db.findUserByOpenID(openid);
  if (!userData) throw new AppError('User not found', RESPONSE_CODE.NOT_FOUND, 404);
  return userData.goods || {};
}

/**
 * 获取单项物品数量
 * @param {string} openid
 * @param {number} goodsId
 * @returns {Promise<number>}
 */
async function getGoodsItem(openid, goodsId) {
  validateGoodsId(goodsId);
  const goods = await getGoods(openid);
  return goods[goodsId] ?? 0;
}

/**
 * 发放物品（奖励等场景）
 * @param {string} openid
 * @param {number} goodsId
 * @param {number} amount - 必须 > 0
 * @param {string} source
 * @returns {Promise<{ goodsId: number, value: number, change: number }>}
 */
async function addGoods(openid, goodsId, amount, source) {
  validateGoodsId(goodsId);
  if (!Number.isFinite(Number(amount)) || amount <= 0) {
    throw new AppError('Add amount must be positive', RESPONSE_CODE.VALIDATION_ERROR, 400);
  }

  const updatedUser = await db.incrementGoods(openid, goodsId, amount);
  const finalValue = (updatedUser.goods && updatedUser.goods[goodsId]) ?? amount;

  logger.info(`[Goods] +${amount} goods(${goodsId}) from ${source}. Current: ${finalValue}`, { openid });
  return { goodsId, value: finalValue, change: amount };
}

/**
 * 消耗物品（含余量校验）
 * @param {string} openid
 * @param {number} goodsId
 * @param {number} amount - 必须 > 0
 * @param {string} source
 * @returns {Promise<{ goodsId: number, value: number, change: number }>}
 */
async function consumeGoods(openid, goodsId, amount, source) {
  validateGoodsId(goodsId);
  if (!Number.isFinite(Number(amount)) || amount <= 0) {
    throw new AppError('Consume amount must be positive', RESPONSE_CODE.VALIDATION_ERROR, 400);
  }

  const updatedUser = await db.decrementGoods(openid, goodsId, amount);
  if (!updatedUser) {
    const userData = await db.findUserByOpenID(openid);
    if (!userData) throw new AppError('User not found', RESPONSE_CODE.NOT_FOUND, 404);
    const currentValue = (userData.goods && userData.goods[goodsId]) ?? 0;
    const name = getGoodsName(goodsId);
    throw new AppError(
      `Insufficient ${name}. Current: ${currentValue}, Need: ${amount}`,
      RESPONSE_CODE.RESOURCE_NOT_ENOUGH,
      400
    );
  }

  const finalValue = (updatedUser.goods && updatedUser.goods[goodsId]) ?? 0;

  logger.info(`[Goods] -${amount} goods(${goodsId}) from ${source}. Current: ${finalValue}`, { openid });
  return { goodsId, value: finalValue, change: -amount };
}

/**
 * 批量发放物品（用于奖励结算）
 * @param {string} openid
 * @param {Array<{ goodsId: number, change: number, source: string }>} updates
 * @param {Object} [extraSets] - 额外的 set 字段
 * @returns {Promise<Object>} updated goods map
 */
async function batchAddGoods(openid, updates, extraSets = {}) {
  const increments = {};

  for (const { goodsId, change, source } of updates) {
    validateGoodsId(goodsId);
    if (change <= 0) continue;

    increments[goodsId] = (increments[goodsId] || 0) + change;
    logger.info(`[Goods] Batch: +${change} goods(${goodsId}) from ${source}`, { openid });
  }

  if (Object.keys(increments).length === 0 && Object.keys(extraSets).length === 0) {
    const userData = await db.findUserByOpenID(openid);
    return userData?.goods || {};
  }

  const updatedUser = await db.batchUpdateAndIncrement(openid, extraSets, {}, increments);
  return updatedUser.goods || {};
}

function validateGoodsId(goodsId) {
  const tbGoods = configManager.tables.tbgoods;
  if (!tbGoods || !tbGoods.get(goodsId)) {
    throw new AppError(
      `Invalid goods id: ${goodsId}`,
      RESPONSE_CODE.VALIDATION_ERROR,
      400
    );
  }
}

function getGoodsName(goodsId) {
  const tbGoods = configManager.tables.tbgoods;
  const goods = tbGoods?.get(goodsId);
  return goods?.name || `goods(${goodsId})`;
}

module.exports = {
  getGoods,
  getGoodsItem,
  addGoods,
  consumeGoods,
  batchAddGoods,
};
