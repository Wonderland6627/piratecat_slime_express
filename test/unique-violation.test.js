const test = require('node:test');
const assert = require('node:assert/strict');

const { isUniqueViolation } = require('../utils/db');

test('isUniqueViolation matches PostgreSQL 23505 only', () => {
  assert.equal(isUniqueViolation({ code: '23505' }), true);
  assert.equal(isUniqueViolation({ code: '23503' }), false);
  assert.equal(isUniqueViolation(null), false);
  assert.equal(isUniqueViolation(new Error('duplicate')), false);
});
