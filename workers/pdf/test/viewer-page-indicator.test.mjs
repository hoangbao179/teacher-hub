import assert from 'node:assert/strict';
import test from 'node:test';
import { PAGE_INDICATOR_RE, parsePageIndicator } from '../src/viewer-page-indicator.ts';

test('parsePageIndicator accepts slash and "of" separators', () => {
  assert.deepEqual(parsePageIndicator('Page 1 / 4'), { index: 1, total: 4 });
  assert.deepEqual(parsePageIndicator('Trang 1 / 4'), { index: 1, total: 4 });
  assert.deepEqual(parsePageIndicator('Page 2 of 4'), { index: 2, total: 4 });
  assert.equal(parsePageIndicator('loading'), null);
  assert.equal(PAGE_INDICATOR_RE.test('1 of 10'), true);
});
