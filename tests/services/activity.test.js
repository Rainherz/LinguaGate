import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTodayKey,
  recordDailyActivity,
  getDailyGoalProgress,
  formatDailyGoalBar,
  getActivityDays,
  renderTerminalHeatmap
} from '../../src/services/activity.js';
import { saveHistory } from '../../src/services/history.js';

describe('Daily Activity & Streak Heatmap Service', () => {
  beforeEach(() => {
    saveHistory({
      errors: [],
      sessions: [],
      streak: 5,
      bestStreak: 10,
      srsCards: {},
      dailyActivity: {}
    });
  });

  test('getTodayKey returns valid YYYY-MM-DD format', () => {
    const key = getTodayKey();
    assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
  });

  test('recordDailyActivity increments daily XP and session counts', () => {
    const today = recordDailyActivity(30, 1);
    assert.strictEqual(today.xp, 30);
    assert.strictEqual(today.sessions, 1);
    assert.strictEqual(today.lessons, 1);

    const updated = recordDailyActivity(25, 0);
    assert.strictEqual(updated.xp, 55);
    assert.strictEqual(updated.sessions, 2);
  });

  test('getDailyGoalProgress calculates percent and completion status correctly', () => {
    recordDailyActivity(25);
    const progress = getDailyGoalProgress(50);
    assert.strictEqual(progress.current, 25);
    assert.strictEqual(progress.target, 50);
    assert.strictEqual(progress.percent, 50);
    assert.strictEqual(progress.completed, false);

    recordDailyActivity(30); // total 55
    const finished = getDailyGoalProgress(50);
    assert.strictEqual(finished.current, 55);
    assert.strictEqual(finished.completed, true);
    assert.strictEqual(finished.percent, 100);
  });

  test('formatDailyGoalBar renders visual progress bar string', () => {
    const bar = formatDailyGoalBar(50);
    assert.ok(bar.includes('Daily Goal'));
    assert.ok(bar.includes('%'));
  });

  test('getActivityDays returns array of 28 days with levels', () => {
    const days = getActivityDays(28);
    assert.strictEqual(days.length, 28);
    assert.ok(days[days.length - 1].date === getTodayKey());
  });

  test('renderTerminalHeatmap produces a multiline heatmap grid', () => {
    const heatmap = renderTerminalHeatmap(28);
    assert.ok(heatmap.includes('Activity Heatmap'));
    assert.ok(heatmap.includes('Legend'));
    assert.ok(heatmap.includes('Mon'));
  });
});
