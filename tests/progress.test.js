import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { isLessonUnlocked, unlockUpToLevel, completeLesson, loadProgress } from '../src/services/progress.js';

describe('Progress & Curriculum Path Service', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'progress-test-'));
    process.env.LINGUAGATE_DATA_DIR = tempDir;
  });

  afterEach(() => {
    delete process.env.LINGUAGATE_DATA_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  const mockLessons = [
    { id: 'A1.1', unitLevel: 'A1' },
    { id: 'A1.2', unitLevel: 'A1' },
    { id: 'A2.1', unitLevel: 'A2' },
    { id: 'B1.1', unitLevel: 'B1' }
  ];

  test('first lesson is always unlocked', () => {
    assert.equal(isLessonUnlocked('A1.1', mockLessons), true);
  });

  test('subsequent lessons require previous completion', () => {
    assert.equal(isLessonUnlocked('A1.2', mockLessons), false);
  });

  test('unlockUpToLevel unlocks all prior lessons and grants XP', () => {
    const progress = unlockUpToLevel('B1', mockLessons);
    assert.equal(progress.placedLevel, 'B1');
    assert.ok(progress.completedLessons.includes('A1.1'));
    assert.ok(progress.completedLessons.includes('A1.2'));
    assert.ok(progress.completedLessons.includes('A2.1'));
    assert.ok(progress.xp > 0);
  });

  test('completeLesson adds lesson to completed list and increases XP', () => {
    const initialProgress = loadProgress();
    const initialXp = initialProgress.xp || 0;

    const updated = completeLesson('TEST.1', 50);
    assert.ok(updated.completedLessons.includes('TEST.1'));
    assert.equal(updated.xp, initialXp + 50);
  });
});
