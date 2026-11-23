const test = require('node:test');
const assert = require('node:assert/strict');

const { insertSelfIntoRank } = require('../services/gameService');

function user(openID, progressLevelID, nickName) {
  return { openID, progressLevelID, nickName };
}

test('insertSelfIntoRank skips empty nickname', () => {
  const rank = [user('a', 10, '甲')];
  const next = insertSelfIntoRank(rank, user('me', 20, ''), 100);
  assert.deepEqual(next.map(item => item.openID), ['a']);
});

test('insertSelfIntoRank inserts by progress and drops the tail', () => {
  const rank = [
    user('a', 30, '甲'),
    user('b', 20, '乙'),
    user('c', 10, '丙')
  ];
  const next = insertSelfIntoRank(rank, user('me', 25, '我'), 3);
  assert.deepEqual(next.map(item => item.openID), ['a', 'me', 'b']);
});

test('insertSelfIntoRank keeps a tied self when the board is full', () => {
  const rank = [
    user('a', 10, '甲'),
    user('b', 10, '乙')
  ];
  const next = insertSelfIntoRank(rank, user('me', 10, '我'), 2);
  assert.equal(next[next.length - 1].openID, 'me');
  assert.equal(next.length, 2);
});
