const fs = require('fs');

/**
 * @param {any} value
 * @returns {Date|null}
 */
function parseCloudDate(value) {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && value.$date !== undefined) {
    return parseCloudDate(value.$date);
  }
  return null;
}

/**
 * @param {any} id
 * @returns {string|null}
 */
function extractId(id) {
  if (id == null) return null;
  if (typeof id === 'string') return id;
  if (typeof id === 'object' && id.$oid) return String(id.$oid);
  return String(id);
}

/**
 * @param {Object} doc
 * @param {Object} defaultResources
 * @returns {Object|null}
 */
function normalizeUserDocument(doc, defaultResources) {
  if (!doc || typeof doc !== 'object') return null;

  const openID = doc.openID || doc.openid || null;
  if (!openID) return null;

  const nested = doc.userGameInfo && typeof doc.userGameInfo === 'object'
    ? doc.userGameInfo
    : {};

  const progressLevelID = Number(
    doc.progressLevelID ?? nested.progressLevelID ?? 0
  ) || 0;

  const nickName = doc.nickName ?? nested.nickName ?? '';
  const avatarUrl = doc.avatarUrl ?? nested.avatarUrl ?? '';

  const rawResources = (doc.resources && typeof doc.resources === 'object')
    ? doc.resources
    : {};
  const resources = { ...defaultResources, ...rawResources };

  const goods = (doc.goods && typeof doc.goods === 'object') ? doc.goods : {};
  const claimedLevelChests = Array.isArray(doc.claimedLevelChests)
    ? doc.claimedLevelChests.map(Number).filter(n => Number.isFinite(n))
    : [];

  return {
    _id: extractId(doc._id),
    openID: String(openID),
    progressLevelID,
    nickName: String(nickName || ''),
    avatarUrl: String(avatarUrl || ''),
    resources,
    goods,
    claimedLevelChests,
    createdAt: parseCloudDate(doc.createdAt) || new Date(),
    updatedAt: parseCloudDate(doc.updatedAt) || new Date()
  };
}

/**
 * 解析导出文件：支持 JSON 数组、JSONL、多根连续 JSON
 * @param {string} filePath
 * @returns {Object[]}
 */
function parseExportDocuments(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Standard JSON array
  if (trimmed.startsWith('[')) {
    const arr = JSON.parse(trimmed);
    if (!Array.isArray(arr)) throw new Error('Expected JSON array at root');
    return arr;
  }

  // JSONL or concatenated objects
  const docs = [];
  const lines = trimmed.split(/\r?\n/);
  let buffer = '';

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;

    // Prefer one-object-per-line JSONL
    if (!buffer && t.startsWith('{') && t.endsWith('}')) {
      docs.push(JSON.parse(t));
      continue;
    }

    buffer += (buffer ? '\n' : '') + line;
    try {
      docs.push(JSON.parse(buffer));
      buffer = '';
    } catch (_) {
      // keep buffering until a full JSON object is formed
    }
  }

  if (buffer.trim()) {
    docs.push(JSON.parse(buffer));
  }

  return docs;
}

/**
 * 按 openID 合并重复记录（保留最高关卡、非空昵称头像、较新 updatedAt）
 * @param {Object[]} normalizedUsers
 * @returns {Object[]}
 */
function mergeUsersByOpenID(normalizedUsers) {
  /** @type {Map<string, Object>} */
  const map = new Map();

  for (const user of normalizedUsers) {
    if (!user || !user.openID) continue;
    const existing = map.get(user.openID);
    if (!existing) {
      map.set(user.openID, user);
      continue;
    }

    const preferNewUpdated =
      new Date(user.updatedAt).getTime() >= new Date(existing.updatedAt).getTime();

    map.set(user.openID, {
      _id: preferNewUpdated ? (user._id || existing._id) : (existing._id || user._id),
      openID: user.openID,
      progressLevelID: Math.max(existing.progressLevelID || 0, user.progressLevelID || 0),
      nickName: (preferNewUpdated ? (user.nickName || existing.nickName) : (existing.nickName || user.nickName)) || '',
      avatarUrl: (preferNewUpdated ? (user.avatarUrl || existing.avatarUrl) : (existing.avatarUrl || user.avatarUrl)) || '',
      resources: preferNewUpdated ? { ...existing.resources, ...user.resources } : { ...user.resources, ...existing.resources },
      goods: preferNewUpdated ? { ...existing.goods, ...user.goods } : { ...user.goods, ...existing.goods },
      claimedLevelChests: Array.from(new Set([
        ...(existing.claimedLevelChests || []),
        ...(user.claimedLevelChests || [])
      ])).sort((a, b) => a - b),
      createdAt: new Date(Math.min(
        new Date(existing.createdAt).getTime(),
        new Date(user.createdAt).getTime()
      )),
      updatedAt: preferNewUpdated ? user.updatedAt : existing.updatedAt
    });
  }

  return Array.from(map.values());
}

module.exports = {
  parseCloudDate,
  extractId,
  normalizeUserDocument,
  parseExportDocuments,
  mergeUsersByOpenID
};
