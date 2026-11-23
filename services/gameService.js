// 游戏服务层（业务逻辑）
const db = require('../utils/db');
const { DEFAULTS } = require('../config/constants');

/**
 * 把自己按关卡插进排行榜。空昵称不进榜。超出上限时丢掉最后一名。
 * @param {Object[]} rankList
 * @param {Object|null} selfData
 * @param {number} limit
 * @returns {Object[]}
 */
function insertSelfIntoRank(rankList, selfData, limit) {
  const next = Array.isArray(rankList) ? rankList.slice() : [];
  if (!selfData || !(selfData.progressLevelID > 0) || !selfData.nickName) {
    return next;
  }
  if (next.some(item => item.openID === selfData.openID)) {
    return next;
  }

  const index = next.findIndex(item => (item.progressLevelID || 0) < selfData.progressLevelID);
  if (index === -1) {
    if (next.length < limit) {
      next.push(selfData);
      return next;
    }
    const lastProgress = next.length > 0 ? (next[next.length - 1].progressLevelID || 0) : 0;
    if (selfData.progressLevelID >= lastProgress) {
      next[next.length - 1] = selfData;
    }
    return next;
  }

  next.splice(index, 0, selfData);
  if (next.length > limit) {
    next.length = limit;
  }
  return next;
}

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

  const selfData = await db.findUserByOpenID(currentOpenID);
  return insertSelfIntoRank(rankList, selfData, actualLimit);
}

module.exports = {
  getUserRankList,
  insertSelfIntoRank
};
