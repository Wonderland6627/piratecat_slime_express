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
 * 仅更新客户端可以公开修改的资料字段。
 * 游戏进度、资源、物品和已领奖励不能通过普通接口覆盖。
 * @param {string} openid
 * @param {Object} profile
 * @returns {Promise<Object>}
 */
async function updateUserProfile(openid, profile = {}) {
  const updateData = {};

  if (profile.nickName !== undefined) {
    updateData.nickName = normalizeProfileText(profile.nickName, 64, 'nickName');
  }
  if (profile.avatarUrl !== undefined) {
    updateData.avatarUrl = normalizeProfileText(profile.avatarUrl, 512, 'avatarUrl');
  }

  const existingUser = await db.findUserByOpenID(openid);
  if (!existingUser) {
    const now = new Date();
    return db.createUser({
      openID: openid,
      resources: getDefaultResources(),
      goods: {},
      createdAt: now,
      updatedAt: now,
      ...updateData
    });
  }

  return db.updateUser(openid, updateData);
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

function normalizeProfileText(value, maxLength, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  return value.trim().slice(0, maxLength);
}

module.exports = {
  getUserGameInfo,
  setUserGameInfo,
  updateUserProfile,
  getUserWXContext
};
