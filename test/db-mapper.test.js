const test = require('node:test');
const assert = require('node:assert/strict');

const { mapUserRow } = require('../utils/db');

test('mapUserRow maps postgres row to client-compatible payload', () => {
  const mapped = mapUserRow({
    id: 'abc123',
    open_id: 'ox_test',
    progress_level_id: 7,
    nick_name: '测试',
    avatar_url: 'https://example.com/a.png',
    resources: { '1': 100, '2': 150, '3': 0 },
    goods: { '1001': 2 },
    claimed_level_chests: [2, 5],
    created_at: new Date('2025-05-07T16:02:50.522Z'),
    updated_at: new Date('2025-12-15T00:01:32.211Z')
  });

  assert.equal(mapped._id, 'abc123');
  assert.equal(mapped.openID, 'ox_test');
  assert.equal(mapped.progressLevelID, 7);
  assert.equal(mapped.nickName, '测试');
  assert.equal(mapped.avatarUrl, 'https://example.com/a.png');
  assert.deepEqual(mapped.resources, { '1': 100, '2': 150, '3': 0 });
  assert.deepEqual(mapped.goods, { '1001': 2 });
  assert.deepEqual(mapped.claimedLevelChests, [2, 5]);
  assert.equal(mapped.createdAt, '2025-05-07T16:02:50.522Z');
  assert.equal(mapped.updatedAt, '2025-12-15T00:01:32.211Z');
});

test('mapUserRow returns null for empty input', () => {
  assert.equal(mapUserRow(null), null);
  assert.equal(mapUserRow(undefined), null);
});

test('mapUserRow fills defaults for sparse rows', () => {
  const mapped = mapUserRow({
    id: 'sparse',
    open_id: 'ox_sparse',
    progress_level_id: null,
    nick_name: null,
    avatar_url: null,
    resources: null,
    goods: null,
    claimed_level_chests: null,
    created_at: null,
    updated_at: null
  });

  assert.equal(mapped.progressLevelID, 0);
  assert.equal(mapped.nickName, '');
  assert.equal(mapped.avatarUrl, '');
  assert.deepEqual(mapped.resources, {});
  assert.deepEqual(mapped.goods, {});
  assert.deepEqual(mapped.claimedLevelChests, []);
  assert.equal(mapped.createdAt, null);
  assert.equal(mapped.updatedAt, null);
});
