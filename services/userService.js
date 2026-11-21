// 用户服务层（业务逻辑）
const db = require('../utils/db');
const { getDefaultResources, normalizeResources } = require('./resourceService');

/**
 * 获取用户游戏信息
 * @param {string} openid
 * @returns {Promise<Object>}
 */
async function getUserGameInfo(openid) {
  let userData = await db.findUserByOpenID(openid);
  let isNewRecord = false;

  if (!userData) {
    const now = new Date();
    userData = await db.createUser({
      openID: openid,
      resources: getDefaultResources(),
      goods: {},
      createdAt: now,
      updatedAt: now
    });
    isNewRecord = true;
  }

  if (!isNewRecord) {
    const normalizedResources = normalizeResources(userData.resources);
    if (hasIncompleteResources(userData.resources, normalizedResources)) {
      userData = await db.updateUser(openid, { resources: normalizedResources });
    } else {
      userData = { ...userData, resources: normalizedResources };
    }
  }

  return {
    data: userData,
    isNewRecord
  };
}

/**
 * 设置用户游戏信息
 * @param {string} openid
 * @param {Object} gameInfo
 * @returns {Promise<Object>}
 */
async function setUserGameInfo(openid, gameInfo) {
  const { openid: _, openID: __, ...cleanGameInfo } = gameInfo;

  if (cleanGameInfo.resources !== undefined && cleanGameInfo.resources !== null) {
    cleanGameInfo.resources = normalizeResources(cleanGameInfo.resources);
  }

  const existingUser = await db.findUserByOpenID(openid);

  if (existingUser) {
    return await db.updateUser(openid, cleanGameInfo);
  }

  const now = new Date();
  return await db.createUser({
    openID: openid,
    resources: getDefaultResources(),
    goods: {},
    createdAt: now,
    updatedAt: now,
    ...cleanGameInfo
  });
}

/**
 * 获取微信上下文信息
 * @param {string} openid
 * @param {Object} eventData
 * @returns {Object}
 */
function getUserWXContext(openid, eventData) {
  return {
    event: eventData,
    openid: openid,
    appid: process.env.WX_APPID,
    unionid: null
  };
}

function hasIncompleteResources(resources, normalizedResources) {
  if (!resources || typeof resources !== 'object') return true;
  return Object.keys(normalizedResources).some(key => !Object.prototype.hasOwnProperty.call(resources, key));
}

module.exports = {
  getUserGameInfo,
  setUserGameInfo,
  getUserWXContext
};
