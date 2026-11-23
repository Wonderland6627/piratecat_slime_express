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
/**
 * PostgreSQL unique_violation
 * @param {unknown} error
 * @returns {boolean}
 */
function isUniqueViolation(error) {
  return Boolean(error && error.code === '23505');
}

/**
 * 把增减和绝对赋值收成一份 JSON，同一 key 上绝对赋值覆盖增减。
 * @param {Object} increments
 * @param {Object} absoluteSets
 * @returns {Object<string, { op: 'inc'|'set', n: number }>}
 */
function buildJsonOps(increments, absoluteSets) {
  const ops = {};
  for (const [key, amount] of Object.entries(increments || {})) {
    const n = Math.trunc(Number(amount));
    if (!Number.isFinite(n) || n === 0) continue;
    ops[String(key)] = { op: 'inc', n };
  }
  for (const [key, value] of Object.entries(absoluteSets || {})) {
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n)) continue;
    ops[String(key)] = { op: 'set', n };
  }
  return ops;
}

/**
 * 用一份 JSON 参数合并进 jsonb 列。SQL 长度不随 key 数量增长。
 * @param {'resources'|'goods'} column
 * @param {string} paramRef
 * @returns {string}
 */
function jsonbPatchSql(column, paramRef) {
  return `COALESCE(${column}, '{}'::jsonb) || COALESCE((
    SELECT jsonb_object_agg(
      e.key,
      to_jsonb(
        CASE
          WHEN e.value->>'op' = 'set' THEN (e.value->>'n')::int
          ELSE COALESCE((${column}->>e.key)::int, 0) + COALESCE((e.value->>'n')::int, 0)
        END
      )
    )
    FROM jsonb_each(${paramRef}::jsonb) AS e(key, value)
  ), '{}'::jsonb)`;
}

async function createUser(userData) {
  const openID = userData?.openID;
  try {
    const pool = getPool();
    const now = new Date();
    const id = userData._id || userData.id || null;
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
    if (isUniqueViolation(error) && openID) {
      const existing = await findUserByOpenID(openID);
      if (existing) {
        logger.warn('createUser unique conflict, return existing user', { openID });
        return existing;
      }
    }
    logger.error('createUser error', { openID, error: error.message });
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
 * 原子扣物品。余额不足或用户不存在时返回 null，不把数量扣成负数。
 * @param {string} openID
 * @param {number|string} goodsId
 * @param {number} amount - 正数
 * @returns {Promise<Object|null>}
 */
async function decrementGoods(openID, goodsId, amount) {
  try {
    const pool = getPool();
    const key = String(goodsId);
    const n = Math.trunc(Number(amount));
    if (!Number.isFinite(n) || n <= 0) throw new Error('Decrement amount must be positive');

    const result = await pool.query(
      `UPDATE user_game_infos
       SET goods = jsonb_set(
             COALESCE(goods, '{}'::jsonb),
             ARRAY[$2::text],
             to_jsonb(COALESCE((goods->>$2)::int, 0) - $3::int),
             true
           ),
           updated_at = NOW()
       WHERE open_id = $1
         AND COALESCE((goods->>$2)::int, 0) >= $3::int
       RETURNING *`,
      [openID, key, n]
    );
    return mapUserRow(result.rows[0] || null);
  } catch (error) {
    logger.error('decrementGoods error', { openID, goodsId, error: error.message });
    throw error;
  }
}

/**
 * 原子扣资源。字段缺失时按 defaultValue 计余额。不足时返回 null。
 * @param {string} openID
 * @param {number|string} resourceTypeId
 * @param {number} amount - 正数
 * @param {{ defaultValue?: number, min?: number }} [options]
 * @returns {Promise<Object|null>}
 */
async function decrementResource(openID, resourceTypeId, amount, options = {}) {
  try {
    const pool = getPool();
    const key = String(resourceTypeId);
    const n = Math.trunc(Number(amount));
    if (!Number.isFinite(n) || n <= 0) throw new Error('Decrement amount must be positive');

    const defaultValue = Number.isFinite(Number(options.defaultValue))
      ? Math.trunc(Number(options.defaultValue))
      : 0;
    const min = Number.isFinite(Number(options.min))
      ? Math.trunc(Number(options.min))
      : 0;

    const result = await pool.query(
      `UPDATE user_game_infos
       SET resources = jsonb_set(
             COALESCE(resources, '{}'::jsonb),
             ARRAY[$2::text],
             to_jsonb(COALESCE((resources->>$2)::int, $4::int) - $3::int),
             true
           ),
           updated_at = NOW()
       WHERE open_id = $1
         AND COALESCE((resources->>$2)::int, $4::int) - $3::int >= $5::int
       RETURNING *`,
      [openID, key, n, defaultValue, min]
    );
    return mapUserRow(result.rows[0] || null);
  } catch (error) {
    logger.error('decrementResource error', { openID, resourceTypeId, error: error.message });
    throw error;
  }
}

/**
 * 一次更新同时 set / inc resources / goods。
 * 传入 claimedChestIdToAdd 时，资源和物品与已领宝箱写在同一条 UPDATE 里，
 * 并且只有进度够、且该宝箱还没领过时才会更新。更新不到行时返回 null。
 * @param {string} openID
 * @param {Object} sets - 直接赋值字段，如 { progressLevelID: 5 }；嵌套路径 resources.1 / goods.1001 也支持
 * @param {Object} resourceIncrements - { 1: 175, 2: 3 }
 * @param {Object} [goodsIncrements]
 * @param {number|null} [claimedChestIdToAdd]
 * @returns {Promise<Object|null>}
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

    if (topLevelSets.resources === undefined) {
      const resourceOps = buildJsonOps(resourceIncrements, absoluteResourceSets);
      if (Object.keys(resourceOps).length > 0) {
        setClauses.push(`resources = ${jsonbPatchSql('resources', `$${idx}`)}`);
        values.push(JSON.stringify(resourceOps));
        idx += 1;
      }
    }

    if (topLevelSets.goods === undefined) {
      const goodsOps = buildJsonOps({}, absoluteGoodsSets);
      const goodsIncOps = buildJsonOps(goodsIncrements, {});
      const mergedGoodsOps = { ...goodsIncOps, ...goodsOps };
      if (Object.keys(mergedGoodsOps).length > 0) {
        setClauses.push(`goods = ${jsonbPatchSql('goods', `$${idx}`)}`);
        values.push(JSON.stringify(mergedGoodsOps));
        idx += 1;
      }
    }

    let chestGuard = false;
    if (claimedChestIdToAdd !== null && claimedChestIdToAdd !== undefined) {
      const chestId = Math.trunc(Number(claimedChestIdToAdd));
      if (!Number.isFinite(chestId)) throw new Error('claimedChestIdToAdd must be a number');
      setClauses.push(`claimed_level_chests = array_append(claimed_level_chests, $${idx}::int)`);
      values.push(chestId);
      idx += 1;
      chestGuard = true;
    }

    setClauses.push('updated_at = NOW()');

    if (setClauses.length === 1 && !chestGuard) {
      return findUserByOpenID(openID);
    }

    const chestParam = chestGuard ? idx - 1 : null;
    let whereSql = 'open_id = $1';
    if (chestGuard) {
      whereSql += ` AND progress_level_id >= $${chestParam}::int AND NOT ($${chestParam}::int = ANY(claimed_level_chests))`;
    }

    const result = await pool.query(
      `UPDATE user_game_infos
       SET ${setClauses.join(', ')}
       WHERE ${whereSql}
       RETURNING *`,
      values
    );

    if (!result.rows[0]) {
      if (chestGuard) return null;
      throw new Error('User not found after batch update');
    }
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
  decrementResource,
  decrementGoods,
  batchUpdateAndIncrement,
  isUniqueViolation,
  mapUserRow,
  warmUp,
  close,
  getPool
};
