// 游戏服务层（业务逻辑）
const db = require('../utils/db');
const { DEFAULTS } = require('../config/constants');

/**
 * 获取用户排行榜
 * @param {number} limit - 返回数量限制
 * @param {string} currentOpenID - 当前用户openID（可选）
 * @returns {Promise<Array>} 排行榜列表
 */
async function getUserRankList(limit, currentOpenID = null) {
  const actualLimit = limit || DEFAULTS.RANK_LIMIT;
  const rankList = await db.findRankUsers(actualLimit);

  if (!currentOpenID) {
    return rankList;
  }

  const selfInList = rankList.some(item => item.openID === currentOpenID);
  if (selfInList) {
    return rankList;
  }

  const selfData = await db.findUserByOpenID(currentOpenID);
  if (!selfData || !(selfData.progressLevelID > 0)) {
    return rankList;
  }

  if (rankList.length < actualLimit) {
    rankList.push(selfData);
    return rankList;
  }

  if (rankList.length > 0) {
    const lastRankProgressLevelID = rankList[rankList.length - 1].progressLevelID || 0;
    if (selfData.progressLevelID >= lastRankProgressLevelID) {
      rankList[rankList.length - 1] = selfData;
    }
  }

  return rankList;
}

module.exports = {
  getUserRankList
};
