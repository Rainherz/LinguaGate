import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { loadHistory, saveHistory } from '../src/services/history.js';
import { summarizeProgress, trendOf } from '../src/services/progress-report.js';

const session = (mode, correct, incorrect, daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return { mode, correct, incorrect, duration: 300, topErrors: [], date: date.toISOString() };
};

const seed = (sessions) => {
  const data = loadHistory();
  data.sessions = sessions;
  saveHistory(data);
};

describe('Progress report', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'progress-report-'));
    process.env.LINGUAGATE_DATA_DIR = tempDir;
  });

  afterEach(() => {
    delete process.env.LINGUAGATE_DATA_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('trendOf', () => {
    test('reports improvement when the recent half beats the earlier half', () => {
      assert.strictEqual(trendOf(50, 80), 'improving');
    });

    test('reports decline when it is worse by a clear margin', () => {
      assert.strictEqual(trendOf(85, 60), 'declining');
    });

    test('small swings are steady, not noise dressed as a trend', () => {
      assert.strictEqual(trendOf(78, 80), 'steady');
      assert.strictEqual(trendOf(80, 76), 'steady');
    });
  });

  describe('summarizeProgress', () => {
    test('aggregates accuracy per mode', () => {
      seed([
        session('translate', 8, 2, 5),
        session('translate', 9, 1, 1),
        session('listening', 3, 7, 2)
      ]);

      const report = summarizeProgress();
      const translate = report.modes.find((m) => m.mode === 'translate');
      const listening = report.modes.find((m) => m.mode === 'listening');

      assert.strictEqual(translate.sessions, 2);
      assert.strictEqual(translate.accuracy, 85);
      assert.strictEqual(listening.accuracy, 30);
    });

    test('ranks the weakest mode first so it is the one you see', () => {
      seed([session('translate', 9, 1, 1), session('listening', 2, 8, 1)]);

      assert.strictEqual(summarizeProgress().modes[0].mode, 'listening');
    });

    test('detects improvement across a mode history', () => {
      seed([
        session('translate', 3, 7, 20),
        session('translate', 4, 6, 15),
        session('translate', 9, 1, 3),
        session('translate', 10, 0, 1)
      ]);

      assert.strictEqual(summarizeProgress().modes[0].trend, 'improving');
    });

    test('a single session has no trend to report yet', () => {
      seed([session('translate', 5, 5, 1)]);
      assert.strictEqual(summarizeProgress().modes[0].trend, 'unknown');
    });

    test('totals cover every session', () => {
      seed([session('translate', 8, 2, 3), session('listening', 4, 6, 1)]);

      const { totals } = summarizeProgress();
      assert.strictEqual(totals.sessions, 2);
      assert.strictEqual(totals.correct, 12);
      assert.strictEqual(totals.incorrect, 8);
      assert.strictEqual(totals.accuracy, 60);
    });

    test('an empty history reports nothing rather than dividing by zero', () => {
      seed([]);
      const report = summarizeProgress();

      assert.deepStrictEqual(report.modes, []);
      assert.strictEqual(report.totals.sessions, 0);
      assert.strictEqual(report.totals.accuracy, 0);
    });

    test('a session with no attempts does not corrupt the average', () => {
      seed([session('translate', 0, 0, 1), session('translate', 8, 2, 1)]);
      assert.strictEqual(summarizeProgress().modes[0].accuracy, 80);
    });
  });
});
