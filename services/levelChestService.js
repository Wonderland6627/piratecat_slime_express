// 推关激励宝箱服务层
const { logger } = require('../utils/logger');
const configManager = require('../config/luban/configManager');
const db = require('../utils/db');
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
  const granted = await rewardService.grantRewardItems(
    openid,
    resUpdates,
    goodsUpdates,
    { claimedChestIdToAdd: chestLevelId }
  );

  const rewards = rewardService.buildRewardEntries(
    resourceUpdates,
    goodsUpdates,
    RESOURCE_SOURCE.CHEST_REWARD
  );

  const updatedResources = granted.resources;
  const updatedGoods = granted.goods;
  const updatedClaimed = granted.user.claimedLevelChests || [...claimed, chestLevelId];

  logger.info(`[LevelChest] Claimed level chest: chestLevelId=${chestLevelId}, rewardId=${milestone.reward_id}, items=${rewards.length}`, { openid });

  return { rewards, claimedLevelChests: updatedClaimed, resources: updatedResources, goods: updatedGoods };
}

module.exports = {
  claimLevelChest,
};
