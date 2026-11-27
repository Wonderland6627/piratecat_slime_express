// 通用奖励解析服务（内部使用，不对外暴露接口）
const { logger } = require('../utils/logger');
const configManager = require('../config/luban/configManager');
const { ITEM_TYPE } = require('../config/constants');
const db = require('../utils/db');
const resourceService = require('./resourceService');
const { AppError } = require('../middlewares/errorHandler');

/**
 * 从 TbReward 解析奖励条目，按 item_type 分组返回
 * @param {number} rewardId - TbReward 表的 id
 * @returns {{ reward: Object, resourceUpdates: Array<{ resourceType: number, change: number }>, goodsUpdates: Array<{ goodsId: number, change: number }> }}
 */
function resolveReward(rewardId) {
  const reward = configManager.tables.tbreward.get(rewardId);
  if (!reward) throw new Error(`Reward not found: ${rewardId}`);

  const resourceUpdates = [];
  const goodsUpdates = [];
  for (const entry of reward.reward_items) {
    switch (entry.item_type) {
      case ITEM_TYPE.RESOURCE:
        resourceUpdates.push({
          resourceType: entry.item_id,
          change: entry.amount,
        });
        break;
      case ITEM_TYPE.GOODS:
        goodsUpdates.push({
          goodsId: entry.item_id,
          change: entry.amount,
        });
        break;
      default:
        logger.warn(`[RewardService] Unknown item_type: ${entry.item_type}, rewardId: ${rewardId}`);
    }
  }
  return { reward, resourceUpdates, goodsUpdates };
}

/**
 * 统一奖励条目（与客户端 RewardItemData 一致：itemType + itemId + amount + source）
 * @param {Array<{ resourceType: number, change: number }>} resourceUpdates
 * @param {Array<{ goodsId: number, change: number }>} goodsUpdates
 * @param {string} source
 * @returns {Array<{ itemType: number, itemId: number, amount: number, source: string }>}
 */
function buildRewardEntries(resourceUpdates, goodsUpdates, source) {
  const items = [];
  for (const u of resourceUpdates) {
    items.push({
      itemType: ITEM_TYPE.RESOURCE,
      itemId: u.resourceType,
      amount: u.change,
      source,
    });
  }
  for (const u of goodsUpdates) {
    items.push({
      itemType: ITEM_TYPE.GOODS,
      itemId: u.goodsId,
      amount: u.change,
      source,
    });
  }
  return items;
}

/**
 * 在同一条 UPDATE 中发放资源、物品，并可附带一次性领取条件。
 * @param {string} openid
 * @param {Array<{resourceType: number, change: number, source?: string}>} resourceUpdates
 * @param {Array<{goodsId: number, change: number, source?: string}>} goodsUpdates
 * @param {{extraSets?: Object, claimedChestIdToAdd?: number|null, checkinDate?: string|null}} [options]
 * @returns {Promise<Object>}
 */
async function grantRewardItems(openid, resourceUpdates = [], goodsUpdates = [], options = {}) {
  const userData = await db.findUserByOpenID(openid);
  if (!userData) throw new Error('User not found');

  const planned = resourceService.planResourceBatch(
    userData,
    resourceUpdates,
    options.extraSets || {}
  );
  const goodsIncrements = {};
  const tbGoods = configManager.tables.tbgoods;

  for (const item of goodsUpdates) {
    if (!Number.isFinite(Number(item.change)) || item.change <= 0) continue;
    if (!tbGoods || !tbGoods.get(item.goodsId)) {
      throw new AppError(`Invalid goods id: ${item.goodsId}`);
    }
    goodsIncrements[item.goodsId] = (goodsIncrements[item.goodsId] || 0) + item.change;
  }

  const updatedUser = await db.batchUpdateAndIncrement(
    openid,
    planned.setFields,
    planned.increments,
    goodsIncrements,
    options.claimedChestIdToAdd ?? null,
    { checkinDate: options.checkinDate ?? null }
  );
  if (!updatedUser) {
    throw new AppError(options.checkinDate
      ? 'Daily check-in already claimed today'
      : 'Reward claim condition failed');
  }

  return {
    user: updatedUser,
    resources: resourceService.normalizeResources(updatedUser.resources),
    goods: updatedUser.goods || {}
  };
}

module.exports = {
  resolveReward,
  buildRewardEntries,
  grantRewardItems,
};
