import test from 'node:test';
import assert from 'node:assert/strict';
import { advancePaper, canFlip, chargeProgress, normalizeSubject, HOLD_MS } from '../src/rules.mjs';
test('a release flips only after the hold threshold, including exact boundary', () => {
  assert.equal(canFlip(null, 99999), false);
  assert.equal(canFlip(100, 100 + HOLD_MS - 1), false);
  assert.equal(canFlip(100, 100 + HOLD_MS), true);
  assert.equal(canFlip(100, 100 + HOLD_MS + 20000), true);
  assert.equal(chargeProgress(null, 100), 0);
  assert.equal(chargeProgress(100, 100 + HOLD_MS + 100), 1);
});
test('papers need the full sequence; completed papers cannot be processed twice', () => {
  for (const [mode, steps] of [['crumple', 6], ['shred', 8]]) {
    const paper = { mode: '', progress: 0, done: false };
    for (let i = 1; i <= steps; i++) {
      assert.equal(advancePaper(paper, mode), true);
      assert.equal(paper.done, i === steps);
    }
    assert.equal(advancePaper(paper, mode), false);
    assert.equal(paper.progress, steps);
  }
});
test('switching methods starts the new sequence, and flip does not process one paper', () => {
  const paper = { mode: 'crumple', progress: 5, done: false };
  advancePaper(paper, 'shred');
  assert.deepEqual(paper, { mode: 'shred', progress: 1, done: false });
  assert.equal(advancePaper(paper, 'flip'), false);
});
test('subject input accepts Korean, trims whitespace, and limits display length', () => {
  assert.equal(normalizeSubject('  미적분학   1  '), '미적분학 1');
  assert.equal(normalizeSubject('   '), '');
  assert.equal(normalizeSubject('가'.repeat(100)).length, 24);
});
