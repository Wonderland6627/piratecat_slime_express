#!/usr/bin/env node
/**
 * Import CloudBase UserGameInfos export into PostgreSQL.
 *
 * Usage:
 *   node scripts/import-cloudbase-data.js <export.json> --dry-run
 *   DATABASE_URL=... node scripts/import-cloudbase-data.js <export.json>
 */
const path = require('path');
const { Pool } = require('pg');

const {
  parseExportDocuments,
  normalizeUserDocument,
  mergeUsersByOpenID
} = require('./lib/importCloudbaseUsers');

function printUsage() {
  console.log(`Usage:
  node scripts/import-cloudbase-data.js <export-file> [--dry-run]

Examples:
  node scripts/import-cloudbase-data.js /tmp/users_export.json --dry-run
  DATABASE_URL=postgresql://slime_prod_user:...@127.0.0.1:5432/slime_prod \\
    node scripts/import-cloudbase-data.js /tmp/users_export.json
`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileArg = args.find(a => !a.startsWith('--'));

  if (!fileArg) {
    printUsage();
    process.exit(1);
  }

  const filePath = path.resolve(fileArg);
  console.log(`[Import] Reading: ${filePath}`);
  console.log(`[Import] Mode: ${dryRun ? 'DRY-RUN (parse only)' : 'WRITE'}`);

  // Lazy require so dry-run can work even before Luban/DB is fully configured
  let defaultResources = { '1': 0, '2': 150, '3': 0 };
  try {
    const { getDefaultResources } = require('../services/resourceService');
    defaultResources = getDefaultResources();
  } catch (e) {
    console.warn(`[Import] Using fallback default resources (${e.message})`);
  }

  const rawDocs = parseExportDocuments(filePath);
  console.log(`[Import] Parsed documents: ${rawDocs.length}`);

  let skippedNoOpenID = 0;
  const normalized = [];
  for (const doc of rawDocs) {
    const user = normalizeUserDocument(doc, defaultResources);
    if (!user) {
      skippedNoOpenID += 1;
      continue;
    }
    normalized.push(user);
  }

  const merged = mergeUsersByOpenID(normalized);
  console.log(`[Import] Normalized users: ${normalized.length}`);
  console.log(`[Import] Unique openID after merge: ${merged.length}`);
  console.log(`[Import] Skipped (no openID): ${skippedNoOpenID}`);

  const withProgress = merged.filter(u => u.progressLevelID > 0).length;
  const withNickname = merged.filter(u => u.nickName).length;
  console.log(`[Import] With progressLevelID>0: ${withProgress}`);
  console.log(`[Import] With nickName: ${withNickname}`);

  const top = [...merged]
    .filter(u => u.progressLevelID > 0 && u.nickName)
    .sort((a, b) => b.progressLevelID - a.progressLevelID)
    .slice(0, 5);
  console.log('[Import] Sample top-5 rank candidates:');
  for (const u of top) {
    console.log(`  - ${u.nickName} lv${u.progressLevelID} (${u.openID})`);
  }

  if (dryRun) {
    console.log('[Import] DRY-RUN complete. No database writes.');
    return;
  }

  if (!process.env.DATABASE_URL && !process.env.PG_DATABASE) {
    console.error('[Import] DATABASE_URL (or PG_*) is required for write mode');
    process.exit(1);
  }

  const dbConfig = require('../config/database');
  const pool = new Pool(dbConfig.getPoolConfig());
  const client = await pool.connect();

  const batchSize = 500;
  let upserted = 0;

  try {
    await client.query('BEGIN');

    for (let i = 0; i < merged.length; i += batchSize) {
      const batch = merged.slice(i, i + batchSize);
      for (const user of batch) {
        await client.query(
          `INSERT INTO user_game_infos (
             id, open_id, progress_level_id, nick_name, avatar_url,
             resources, goods, claimed_level_chests, created_at, updated_at
           ) VALUES (
             COALESCE($1, replace(gen_random_uuid()::text, '-', '')),
             $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10
           )
           ON CONFLICT (open_id) DO UPDATE SET
             id = COALESCE(user_game_infos.id, EXCLUDED.id),
             progress_level_id = GREATEST(user_game_infos.progress_level_id, EXCLUDED.progress_level_id),
             nick_name = CASE
               WHEN EXCLUDED.nick_name <> '' THEN EXCLUDED.nick_name
               ELSE user_game_infos.nick_name
             END,
             avatar_url = CASE
               WHEN EXCLUDED.avatar_url <> '' THEN EXCLUDED.avatar_url
               ELSE user_game_infos.avatar_url
             END,
             resources = user_game_infos.resources || EXCLUDED.resources,
             goods = user_game_infos.goods || EXCLUDED.goods,
             claimed_level_chests = (
               SELECT ARRAY(
                 SELECT DISTINCT unnest(user_game_infos.claimed_level_chests || EXCLUDED.claimed_level_chests)
                 ORDER BY 1
               )
             ),
             updated_at = GREATEST(user_game_infos.updated_at, EXCLUDED.updated_at)`,
          [
            user._id,
            user.openID,
            user.progressLevelID,
            user.nickName,
            user.avatarUrl,
            JSON.stringify(user.resources),
            JSON.stringify(user.goods),
            user.claimedLevelChests,
            user.createdAt,
            user.updatedAt
          ]
        );
        upserted += 1;
      }
      console.log(`[Import] Upserted ${Math.min(i + batch.length, merged.length)} / ${merged.length}`);
    }

    await client.query('COMMIT');

    const countRes = await client.query('SELECT COUNT(*)::int AS c FROM user_game_infos');
    const rankRes = await client.query(
      `SELECT nick_name, progress_level_id
       FROM user_game_infos
       WHERE progress_level_id > 0 AND nick_name <> ''
       ORDER BY progress_level_id DESC
       LIMIT 5`
    );

    console.log(`[Import] DONE. Upserted rows: ${upserted}`);
    console.log(`[Import] Table total rows: ${countRes.rows[0].c}`);
    console.log('[Import] DB top-5:');
    for (const row of rankRes.rows) {
      console.log(`  - ${row.nick_name} lv${row.progress_level_id}`);
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Import] FAILED, rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('[Import] Unexpected error:', e);
  process.exit(1);
});
