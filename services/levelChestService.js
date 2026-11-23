// 推关激励宝箱服务层
const { logger } = require('../utils/logger');
const configManager = require('../config/luban/configManager');
const db = require('../utils/db');
const resourceService = require('./resourceService');
const rewardService = require('./rewardService');
const { RESOURCE_SOURCE } = require('../config/constants');
const { AppError } = require('../middlewares/errorHandler');

/**
 * 领取推关激励宝箱
 * @param {string} openid
 * @param {number} chestLevelId - 里程碑关卡ID（tblevelchest 表的 level_id）
 * @returns {Promise<{ rewards: Array, claimedLevelChests: number[], resources: Object, goods: Object }>}
 */
async function claimLevelChest(openid, chestLevelId) {
  const allMilestones = configManager.tables.tblevelchest.getAll();
  const milestone = allMilestones.find(m => m.level_id === chestLevelId);
  if (!milestone) {
    throw new AppError(`Invalid chestLevelId: ${chestLevelId}`);
  }

  const userData = await db.findUserByOpenID(openid);
  if (!userData) throw new AppError('User not found');

  const progressLevelID = userData.progressLevelID || 0;
  if (progressLevelID < chestLevelId) {
    throw new AppError(`Level not cleared: need ${chestLevelId}, current ${progressLevelID}`);
  }

  const claimed = userData.claimedLevelChests || [];
  if (claimed.includes(chestLevelId)) {
    throw new AppError(`Level chest already claimed: ${chestLevelId}`);
  }

  const { resourceUpdates, goodsUpdates } = rewardService.resolveReward(milestone.reward_id);

  const resUpdates = resourceUpdates.map(u => ({
    resourceType: u.resourceType,
    change: u.change,
    source: RESOURCE_SOURCE.CHEST_REWARD,
  }));
  const planned = resourceService.planResourceBatch(userData, resUpdates, {});

  const goodsIncrements = {};
  const tbGoods = configManager.tables.tbgoods;
  for (const item of goodsUpdates) {
    if (item.change <= 0) continue;
    if (!tbGoods || !tbGoods.get(item.goodsId)) {
      throw new Error(`Invalid goods id: ${item.goodsId}`);
    }
    goodsIncrements[item.goodsId] = (goodsIncrements[item.goodsId] || 0) + item.change;
    logger.info(`[Goods] Batch: +${item.change} goods(${item.goodsId}) from ${RESOURCE_SOURCE.CHEST_REWARD}`, { openid });
  }

  const updatedUser = await db.batchUpdateAndIncrement(
    openid,
    planned.setFields,
    planned.increments,
    goodsIncrements,
    chestLevelId
  );
  if (!updatedUser) {
    const latest = await db.findUserByOpenID(openid);
    if (!latest) throw new AppError('User not found');
    if ((latest.claimedLevelChests || []).includes(chestLevelId)) {
      throw new AppError(`Level chest already claimed: ${chestLevelId}`);
    }
    throw new AppError(`Level not cleared: need ${chestLevelId}, current ${latest.progressLevelID || 0}`);
  }

  const rewards = rewardService.buildRewardEntries(
    resourceUpdates,
    goodsUpdates,
    RESOURCE_SOURCE.CHEST_REWARD
  );

  const updatedResources = resourceService.normalizeResources(updatedUser.resources);
  const updatedGoods = updatedUser.goods || {};
  const updatedClaimed = updatedUser.claimedLevelChests || [...claimed, chestLevelId];

  logger.info(`[LevelChest] Claimed level chest: chestLevelId=${chestLevelId}, rewardId=${milestone.reward_id}, items=${rewards.length}`, { openid });

  return { rewards, claimedLevelChests: updatedClaimed, resources: updatedResources, goods: updatedGoods };
}

module.exports = {
  claimLevelChest,
};
