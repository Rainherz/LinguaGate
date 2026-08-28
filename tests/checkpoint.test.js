import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { loadCheckpoint, isCheckpointUnlocked, isLevelCertified, completeCheckpoint } from '../src/services/checkpoint.js';
import { loadProgress } from '../src/services/progress.js';

describe('Checkpoint Exam & Level Certification Service', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'checkpoint-test-'));
    process.env.LINGUAGATE_DATA_DIR = tempDir;
  });

  afterEach(() => {
    delete process.env.LINGUAGATE_DATA_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('loadCheckpoint loads 20-question exam for A1 and A2', () => {
    const a1Exam = loadCheckpoint('A1');
    assert.ok(a1Exam);
    assert.equal(a1Exam.totalQuestions, 20);
    assert.equal(a1Exam.passingScore, 16);
    assert.equal(a1Exam.questions.length, 20);

    const a2Exam = loadCheckpoint('A2');
    assert.ok(a2Exam);
    assert.equal(a2Exam.totalQuestions, 20);
  });

  test('isCheckpointUnlocked returns true only when all unit lessons are completed', () => {
    const mockLessons = [
      { id: 'A1.1', unitLevel: 'A1' },
      { id: 'A1.2', unitLevel: 'A1' },
      { id: 'A1.3', unitLevel: 'A1' }
    ];

    const incompleteProgress = { completedLessons: ['A1.1', 'A1.2'] };
    assert.equal(isCheckpointUnlocked('A1', incompleteProgress, mockLessons), false);

    const completeProgress = { completedLessons: ['A1.1', 'A1.2', 'A1.3'] };
    assert.equal(isCheckpointUnlocked('A1', completeProgress, mockLessons), true);
  });

  test('completeCheckpoint grants certification badge, records history and awards XP', () => {
    const result = completeCheckpoint('A1', 18, 20);
    assert.ok(result.certificate.includes('A1 Certified'));
    assert.equal(result.xpEarned, 200);

    const progress = loadProgress();
    assert.ok(progress.certifications.includes('A1'));
    assert.equal(progress.xp, 200);
    assert.ok(progress.checkpointHistory.length > 0);
    assert.equal(progress.checkpointHistory[0].level, 'A1');
    assert.equal(progress.checkpointHistory[0].passed, true);
    assert.equal(isLevelCertified('A1', progress), true);
  });
});
