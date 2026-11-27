const test = require('node:test');
const assert = require('node:assert/strict');

const resourceService = require('../services/resourceService');
const levelRewardController = require('../controllers/levelRewardController');

test('production rejects client-side positive resource changes', async () => {
  const previous = process.env.ENABLE_TEST_MODE;
  process.env.ENABLE_TEST_MODE = 'false';

  try {
    await assert.rejects(
      resourceService.updateResource('test-openid', 1, 100, 'client'),
      (error) => error.code === -4 && error.statusCode === 403
    );
  } finally {
    if (previous === undefined) {
      delete process.env.ENABLE_TEST_MODE;
    } else {
      process.env.ENABLE_TEST_MODE = previous;
    }
  }
});

test('level reward controller rejects non-integer level ids', async () => {
  let receivedError = null;
  await levelRewardController.claimLevelReward(
    { user: { openid: 'test-openid' }, body: { levelId: 1.5 } },
    {},
    (error) => {
      receivedError = error;
    }
  );

  assert.equal(receivedError.code, -4);
  assert.equal(receivedError.statusCode, 400);
});
