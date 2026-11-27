// 每日签到服务层
const { logger } = require('../utils/logger');
const configManager = require('../config/luban/configManager');
const rewardService = require('./rewardService');
const { RESOURCE_SOURCE } = require('../config/constants');

/**
 * 领取每日签到奖励（服务端原子结算）
 * @param {string} openid
 * @returns {Promise<{ rewards: Array, resources: Object, goods: Object }>}
 */
async function claimDailyCheckin(openid) {
  const gc = configManager.tables.tbglobalconfig.getData();
  if (!gc) throw new Error('TbGlobalConfig not loaded');

  const rewardId = gc.daily_checkin_reward_id;
  const { resourceUpdates, goodsUpdates } = rewardService.resolveReward(rewardId);

  const resUpdates = resourceUpdates.map(u => ({
    resourceType: u.resourceType,
    change: u.change,
    source: RESOURCE_SOURCE.DAILY_CHECKIN,
  }));

  const gdsUpdates = goodsUpdates.map(u => ({
    goodsId: u.goodsId,
    change: u.change,
    source: RESOURCE_SOURCE.DAILY_CHECKIN,
  }));
  const granted = await rewardService.grantRewardItems(
    openid,
    resUpdates,
    gdsUpdates,
    { checkinDate: getBusinessDate() }
  );

  const rewards = rewardService.buildRewardEntries(
    resourceUpdates,
    goodsUpdates,
    RESOURCE_SOURCE.DAILY_CHECKIN
  );

  logger.info(`[DailyCheckin] Claimed daily checkin: rewardId=${rewardId}, items=${rewards.length}`, { openid });

  return { rewards, resources: granted.resources, goods: granted.goods };
}

function getBusinessDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai'
  }).format(new Date());
}

module.exports = {
  claimDailyCheckin,
};
