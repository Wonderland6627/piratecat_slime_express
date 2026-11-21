// PostgreSQL DAO 层（替代原 CloudBase 文档库）
const { Pool } = require('pg');
const { logger } = require('./logger');
const dbConfig = require('../config/database');

/** @type {import('pg').Pool|null} */
let _pool = null;

const USER_UPDATE_WHITELIST = new Set([
  'progressLevelID',
  'nickName',
  'avatarUrl',
  'resources',
  'goods',
  'claimedLevelChests'
]);

/**
 * @returns {import('pg').Pool}
 */
function getPool() {
  if (_pool) return _pool;

  const config = dbConfig.getPoolConfig();
  _pool = new Pool(config);
  _pool.on('error', (err) => {
    logger.error('[PostgreSQL] Unexpected pool error', { error: err.message });
  });

  logger.info(`[PostgreSQL] Pool created: ${dbConfig.getDatabaseLabel()}, max=${config.max}`);
  return _pool;
}

/**
 * 后台预热：服务启动后异步调用
 */
async function warmUp() {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    logger.info('[PostgreSQL] Connected successfully');
  } catch (e) {
    logger.warn('[PostgreSQL] Warm-up failed:', { error: e.message });
  }
}

/**
 * 优雅关闭连接池
 */
async function close() {
  if (!_pool) return;
  try {
    await _pool.end();
    logger.info('[PostgreSQL] Pool closed');
  } catch (e) {
    logger.warn('[PostgreSQL] Pool close failed', { error: e.message });
  } finally {
    _pool = null;
  }
}

/**
 * 将 DB 行映射为与旧 CloudBase API 兼容的客户端 JSON 结构
 * @param {Object|null} row
 * @returns {Object|null}
 */
function mapUserRow(row) {
  if (!row) return null;
  return {
    _id: row.id,
    openID: row.open_id,
    progressLevelID: row.progress_level_id ?? 0,
    nickName: row.nick_name ?? '',
    avatarUrl: row.avatar_url ?? '',
    resources: row.resources || {},
    goods: row.goods || {},
    claimedLevelChests: Array.isArray(row.claimed_level_chests) ? row.claimed_level_chests : [],
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

/**
 * @param {string} openID
 * @returns {Promise<Object|null>}
 */
async function findUserByOpenID(openID) {
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM user_game_infos WHERE open_id = $1 LIMIT 1',
      [openID]
    );
    return mapUserRow(result.rows[0] || null);
  } catch (error) {
    logger.error('findUserByOpenID error', { openID, error: error.message });
    throw error;
  }
}

/**
 * @param {Object} userData
 * @returns {Promise<Object>}
 */
async function createUser(userData) {
  try {
    const pool = getPool();
    const now = new Date();
    const id = userData._id || userData.id || null;
    const openID = userData.openID;
    if (!openID) throw new Error('openID is required');

    const resources = userData.resources || {};
    const goods = userData.goods || {};
    const claimed = Array.isArray(userData.claimedLevelChests) ? userData.claimedLevelChests : [];
    const createdAt = userData.createdAt ? new Date(userData.createdAt) : now;
    const updatedAt = userData.updatedAt ? new Date(userData.updatedAt) : now;

    const result = id
      ? await pool.query(
          `INSERT INTO user_game_infos (
             id, open_id, progress_level_id, nick_name, avatar_url,
             resources, goods, claimed_level_chests, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10)
           RETURNING *`,
          [
            id,
            openID,
            userData.progressLevelID || 0,
            userData.nickName || '',
            userData.avatarUrl || '',
            JSON.stringify(resources),
            JSON.stringify(goods),
            claimed,
            createdAt,
            updatedAt
          ]
        )
      : await pool.query(
          `INSERT INTO user_game_infos (
             open_id, progress_level_id, nick_name, avatar_url,
             resources, goods, claimed_level_chests, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)
           RETURNING *`,
          [
            openID,
            userData.progressLevelID || 0,
            userData.nickName || '',
            userData.avatarUrl || '',
            JSON.stringify(resources),
            JSON.stringify(goods),
            claimed,
            createdAt,
            updatedAt
          ]
        );

    return mapUserRow(result.rows[0]);
  } catch (error) {
    logger.error('createUser error', { openID: userData?.openID, error: error.message });
    throw error;
  }
}

/**
 * @param {string} openID
 * @param {Object} updateData
 * @returns {Promise<Object>}
 */
async function updateUser(openID, updateData) {
  try {
    const pool = getPool();
    const sets = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updateData || {})) {
      if (!USER_UPDATE_WHITELIST.has(key)) continue;

      switch (key) {
        case 'progressLevelID':
          sets.push(`progress_level_id = $${idx++}`);
          values.push(value);
          break;
        case 'nickName':
          sets.push(`nick_name = $${idx++}`);
          values.push(value ?? '');
          break;
        case 'avatarUrl':
          sets.push(`avatar_url = $${idx++}`);
          values.push(value ?? '');
          break;
        case 'resources':
          sets.push(`resources = $${idx++}::jsonb`);
          values.push(JSON.stringify(value || {}));
          break;
        case 'goods':
          sets.push(`goods = $${idx++}::jsonb`);
          values.push(JSON.stringify(value || {}));
          break;
        case 'claimedLevelChests':
          sets.push(`claimed_level_chests = $${idx++}`);
          values.push(Array.isArray(value) ? value : []);
          break;
        default:
          break;
      }
    }

    sets.push('updated_at = NOW()');
    values.push(openID);

    if (sets.length === 1) {
      // only updated_at — still refresh row timestamp and return current user
    }

    const result = await pool.query(
      `UPDATE user_game_infos
       SET ${sets.join(', ')}
       WHERE open_id = $${idx}
       RETURNING *`,
      values
    );

    if (!result.rows[0]) {
      throw new Error('User not found after update');
    }
    return mapUserRow(result.rows[0]);
  } catch (error) {
    logger.error('updateUser error', { openID, error: error.message });
    throw error;
  }
}

/**
 * 排行榜查询
 * @param {number} limit
 * @returns {Promise<Object[]>}
 */
async function findRankUsers(limit) {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT *
       FROM user_game_infos
       WHERE progress_level_id > 0
         AND nick_name <> ''
       ORDER BY progress_level_id DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(mapUserRow);
  } catch (error) {
    logger.error('findRankUsers error', { error: error.message });
    throw error;
  }
}

/**
 * @deprecated 使用 findRankUsers；保留兼容旧调用签名
 */
async function findUsersByCondition(_condition, options = {}) {
  return findRankUsers(options.limit || 100);
}

/**
 * 直接设置资源值
 * @param {string} openID
 * @param {number|string} resourceTypeId
 * @param {number} value
 * @returns {Promise<Object>}
 */
async function setResource(openID, resourceTypeId, value) {
  try {
    const pool = getPool();
    const key = String(resourceTypeId);
    const result = await pool.query(
      `UPDATE user_game_infos
       SET resources = COALESCE(resources, '{}'::jsonb) || jsonb_build_object($2::text, to_jsonb($3::int)),
           updated_at = NOW()
       WHERE open_id = $1
       RETURNING *`,
      [openID, key, value]
    );
    if (!result.rows[0]) throw new Error('User not found after resource set');
    return mapUserRow(result.rows[0]);
  } catch (error) {
    logger.error('setResource error', { openID, resourceTypeId, error: error.message });
    throw error;
  }
}

/**
 * 原子增减资源
 * @param {string} openID
 * @param {number|string} resourceTypeId
 * @param {number} amount
 * @returns {Promise<Object>}
 */
async function incrementResource(openID, resourceTypeId, amount) {
  try {
    const pool = getPool();
    const key = String(resourceTypeId);
    const result = await pool.query(
      `UPDATE user_game_infos
       SET resources = jsonb_set(
             COALESCE(resources, '{}'::jsonb),
             ARRAY[$2::text],
             to_jsonb(COALESCE((resources->>$2)::int, 0) + $3::int),
             true
           ),
           updated_at = NOW()
       WHERE open_id = $1
       RETURNING *`,
      [openID, key, amount]
    );
    if (!result.rows[0]) throw new Error('User not found after resource update');
    return mapUserRow(result.rows[0]);
  } catch (error) {
    logger.error('incrementResource error', { openID, resourceTypeId, error: error.message });
    throw error;
  }
}

/**
 * 原子增减物品
 * @param {string} openID
 * @param {number|string} goodsId
 * @param {number} amount
 * @returns {Promise<Object>}
 */
async function incrementGoods(openID, goodsId, amount) {
  try {
    const pool = getPool();
    const key = String(goodsId);
    const result = await pool.query(
      `UPDATE user_game_infos
       SET goods = jsonb_set(
             COALESCE(goods, '{}'::jsonb),
             ARRAY[$2::text],
             to_jsonb(COALESCE((goods->>$2)::int, 0) + $3::int),
             true
           ),
           updated_at = NOW()
       WHERE open_id = $1
       RETURNING *`,
      [openID, key, amount]
    );
    if (!result.rows[0]) throw new Error('User not found after goods update');
    return mapUserRow(result.rows[0]);
  } catch (error) {
    logger.error('incrementGoods error', { openID, goodsId, error: error.message });
    throw error;
  }
}

/**
 * 一次原子操作同时 set / inc resources / goods，并可追加 claimed chest
 * @param {string} openID
 * @param {Object} sets - 直接赋值字段，如 { progressLevelID: 5 }；嵌套路径 resources.1 / goods.1001 也支持
 * @param {Object} resourceIncrements - { 1: 175, 2: 3 }
 * @param {Object} [goodsIncrements]
 * @param {number|null} [claimedChestIdToAdd]
 * @returns {Promise<Object>}
 */
async function batchUpdateAndIncrement(
  openID,
  sets = {},
  resourceIncrements = {},
  goodsIncrements = {},
  claimedChestIdToAdd = null
) {
  try {
    const pool = getPool();
    const setClauses = [];
    const values = [openID];
    let idx = 2;

    // Flatten nested resource/goods absolute sets from CloudBase-style paths
    const absoluteResourceSets = {};
    const absoluteGoodsSets = {};
    const topLevelSets = {};

    for (const [key, value] of Object.entries(sets || {})) {
      if (key.startsWith('resources.')) {
        absoluteResourceSets[key.slice('resources.'.length)] = value;
        continue;
      }
      if (key.startsWith('goods.')) {
        absoluteGoodsSets[key.slice('goods.'.length)] = value;
        continue;
      }
      if (USER_UPDATE_WHITELIST.has(key) || key === 'claimedLevelChests') {
        topLevelSets[key] = value;
      }
    }

    if (topLevelSets.progressLevelID !== undefined) {
      setClauses.push(`progress_level_id = $${idx++}`);
      values.push(topLevelSets.progressLevelID);
    }
    if (topLevelSets.nickName !== undefined) {
      setClauses.push(`nick_name = $${idx++}`);
      values.push(topLevelSets.nickName ?? '');
    }
    if (topLevelSets.avatarUrl !== undefined) {
      setClauses.push(`avatar_url = $${idx++}`);
      values.push(topLevelSets.avatarUrl ?? '');
    }
    if (topLevelSets.resources !== undefined) {
      setClauses.push(`resources = $${idx++}::jsonb`);
      values.push(JSON.stringify(topLevelSets.resources || {}));
    }
    if (topLevelSets.goods !== undefined) {
      setClauses.push(`goods = $${idx++}::jsonb`);
      values.push(JSON.stringify(topLevelSets.goods || {}));
    }
    if (Array.isArray(topLevelSets.claimedLevelChests)) {
      setClauses.push(`claimed_level_chests = $${idx++}`);
      values.push(topLevelSets.claimedLevelChests);
    }

    // Build resources expression: start from current, apply absolute sets, then increments
    const resourceOps = [];
    for (const [resourceTypeId, amount] of Object.entries(resourceIncrements || {})) {
      if (amount === 0) continue;
      resourceOps.push({ type: 'inc', key: String(resourceTypeId), amount: Number(amount) });
    }
    for (const [resourceTypeId, value] of Object.entries(absoluteResourceSets)) {
      resourceOps.push({ type: 'set', key: String(resourceTypeId), amount: Number(value) });
    }

    if (resourceOps.length > 0 && topLevelSets.resources === undefined) {
      let resourcesExpr = `COALESCE(resources, '{}'::jsonb)`;
      for (const op of resourceOps) {
        if (op.type === 'set') {
          resourcesExpr = `(${resourcesExpr} || jsonb_build_object($${idx}::text, to_jsonb($${idx + 1}::int)))`;
          values.push(op.key, op.amount);
          idx += 2;
        } else {
          resourcesExpr = `jsonb_set(
            ${resourcesExpr},
            ARRAY[$${idx}::text],
            to_jsonb(COALESCE((${resourcesExpr}->>$${idx})::int, 0) + $${idx + 1}::int),
            true
          )`;
          values.push(op.key, op.amount);
          idx += 2;
        }
      }
      setClauses.push(`resources = ${resourcesExpr}`);
    }

    const goodsOps = [];
    for (const [goodsId, amount] of Object.entries(goodsIncrements || {})) {
      if (amount === 0) continue;
      goodsOps.push({ type: 'inc', key: String(goodsId), amount: Number(amount) });
    }
    for (const [goodsId, value] of Object.entries(absoluteGoodsSets)) {
      goodsOps.push({ type: 'set', key: String(goodsId), amount: Number(value) });
    }

    if (goodsOps.length > 0 && topLevelSets.goods === undefined) {
      let goodsExpr = `COALESCE(goods, '{}'::jsonb)`;
      for (const op of goodsOps) {
        if (op.type === 'set') {
          goodsExpr = `(${goodsExpr} || jsonb_build_object($${idx}::text, to_jsonb($${idx + 1}::int)))`;
          values.push(op.key, op.amount);
          idx += 2;
        } else {
          goodsExpr = `jsonb_set(
            ${goodsExpr},
            ARRAY[$${idx}::text],
            to_jsonb(COALESCE((${goodsExpr}->>$${idx})::int, 0) + $${idx + 1}::int),
            true
          )`;
          values.push(op.key, op.amount);
          idx += 2;
        }
      }
      setClauses.push(`goods = ${goodsExpr}`);
    }

    if (claimedChestIdToAdd !== null && claimedChestIdToAdd !== undefined) {
      setClauses.push(
        `claimed_level_chests = CASE
           WHEN NOT ($${idx} = ANY(claimed_level_chests))
           THEN array_append(claimed_level_chests, $${idx}::int)
           ELSE claimed_level_chests
         END`
      );
      values.push(Number(claimedChestIdToAdd));
      idx += 1;
    }

    setClauses.push('updated_at = NOW()');

    if (setClauses.length === 1) {
      // only updated_at — return current user
      return findUserByOpenID(openID);
    }

    const result = await pool.query(
      `UPDATE user_game_infos
       SET ${setClauses.join(', ')}
       WHERE open_id = $1
       RETURNING *`,
      values
    );

    if (!result.rows[0]) throw new Error('User not found after batch update');
    return mapUserRow(result.rows[0]);
  } catch (error) {
    logger.error('batchUpdateAndIncrement error', { openID, error: error.message });
    throw error;
  }
}

module.exports = {
  findUserByOpenID,
  createUser,
  updateUser,
  findRankUsers,
  findUsersByCondition,
  setResource,
  incrementResource,
  incrementGoods,
  batchUpdateAndIncrement,
  mapUserRow,
  warmUp,
  close,
  getPool
};
