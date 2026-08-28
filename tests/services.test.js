import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { updateStreak, reviewSrsCard, getTopErrors } from '../src/services/history.js';
import { isLessonUnlocked, unlockUpToLevel } from '../src/services/progress.js';

describe('History & SRS Service Integration', () => {
  test('streak increments on correct and resets to zero on wrong', () => {
    const s1 = updateStreak(true);
    assert.ok(s1 >= 1);
    const s2 = updateStreak(true);
    assert.equal(s2, s1 + 1);

    const s3 = updateStreak(false);
    assert.equal(s3, 0);
  });
});

describe('Progress Service Integration', () => {
  test('first lesson is always unlocked', () => {
    const mockLessons = [
      { id: 'A1.1', unitLevel: 'A1' },
      { id: 'A1.2', unitLevel: 'A1' }
    ];
    assert.equal(isLessonUnlocked('A1.1', mockLessons), true);
  });
});
