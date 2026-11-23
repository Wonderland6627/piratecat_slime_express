const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const {
  parseExportDocuments,
  normalizeUserDocument,
  parseCloudDate
} = require('../scripts/lib/importCloudbaseUsers');

test('parseCloudDate supports $date string and number', () => {
  assert.equal(
    parseCloudDate({ $date: '2025-05-07T16:02:50.522Z' }).toISOString(),
    '2025-05-07T16:02:50.522Z'
  );
  const ms = Date.parse('2025-05-15T09:12:32.104Z');
  assert.equal(
    parseCloudDate({ $date: ms }).toISOString(),
    '2025-05-15T09:12:32.104Z'
  );
  assert.equal(
    parseCloudDate('2025-05-07T16:02:50.522Z').toISOString(),
    '2025-05-07T16:02:50.522Z'
  );
});

test('normalizeUserDocument prefers openID and fills defaults', () => {
  const { getDefaultResources } = require('../services/resourceService');
  const defaults = getDefaultResources();

  const normalized = normalizeUserDocument({
    _id: 'id1',
    openid: 'ox_old',
    openID: 'ox_new',
    progressLevelID: 3,
    nickName: '🎩',
    createdAt: { $date: '2025-05-07T16:02:50.522Z' },
    updatedAt: { $date: '2025-12-15T00:01:32.211Z' }
  }, defaults);

  assert.equal(normalized.openID, 'ox_new');
  assert.equal(normalized.progressLevelID, 3);
  assert.equal(normalized.nickName, '🎩');
  assert.deepEqual(normalized.resources, defaults);
  assert.deepEqual(normalized.goods, {});
  assert.deepEqual(normalized.claimedLevelChests, []);
});

test('normalizeUserDocument merges existing resources over defaults', () => {
  const defaults = { '1': 0, '2': 150, '3': 0 };
  const normalized = normalizeUserDocument({
    _id: 'id2',
    openID: 'ox2',
    resources: { '1': 190, '2': 120 },
    claimedLevelChests: [5, 2],
    goods: {}
  }, defaults);

  assert.deepEqual(normalized.resources, { '1': 190, '2': 120, '3': 0 });
  assert.deepEqual(normalized.claimedLevelChests, [5, 2]);
});

test('normalizeUserDocument truncates fractional resource and goods values', () => {
  const { coerceIntMap } = require('../scripts/lib/importCloudbaseUsers');
  assert.deepEqual(coerceIntMap({ '1': 190.9, bad: 'nope', '2': '15' }), { '1': 190, '2': 15 });

  const normalized = normalizeUserDocument({
    _id: 'id3',
    openID: 'ox3',
    resources: { '1': 10.8 },
    goods: { '1001': '3.2' }
  }, { '1': 0, '2': 150 });

  assert.deepEqual(normalized.resources, { '1': 10, '2': 150 });
  assert.deepEqual(normalized.goods, { '1001': 3 });
});

test('parseExportDocuments reads sample JSONL fragment', () => {
  const sample = [
    '{"_id":"a","openID":"ox1","progressLevelID":1}',
    '{"_id":"b","openid":"ox2","nickName":"x"}'
  ].join('\n');

  const tmp = path.join(__dirname, 'tmp-sample-export.jsonl');
  fs.writeFileSync(tmp, sample, 'utf8');
  try {
    const docs = parseExportDocuments(tmp);
    assert.equal(docs.length, 2);
    assert.equal(docs[0].openID, 'ox1');
    assert.equal(docs[1].openid, 'ox2');
  } finally {
    fs.unlinkSync(tmp);
  }
});
