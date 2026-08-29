import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import {
  recordError,
  recordPronunciationError,
  reviewSrsCard,
  pronunciationCardKey,
  loadHistory,
  saveHistory
} from '../src/services/history.js';
import { getWeakSpots, displayLabel, masteryWeight } from '../src/services/weakspots.js';

describe('Weak Spots Analytics', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'weakspots-test-'));
    process.env.LINGUAGATE_DATA_DIR = tempDir;
  });

  afterEach(() => {
    delete process.env.LINGUAGATE_DATA_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('displayLabel', () => {
    test('strips the internal namespace from a pronunciation key', () => {
      assert.strictEqual(displayLabel('pronunciation:prioritize'), 'prioritize');
      assert.strictEqual(displayLabel('pronunciation:production outage'), 'production outage');
    });

    test('leaves a grammar rule name untouched', () => {
      assert.strictEqual(displayLabel('past_simple_irregular'), 'past_simple_irregular');
    });

    test('survives empty input', () => {
      assert.strictEqual(displayLabel(''), '');
      assert.strictEqual(displayLabel(undefined), '');
    });
  });

  describe('masteryWeight', () => {
    test('an actively failing card carries its full weight', () => {
      assert.strictEqual(masteryWeight(0), 1);
    });

    test('weight decays as the SM-2 repetition streak grows', () => {
      assert.ok(masteryWeight(3) < masteryWeight(1));
      assert.ok(masteryWeight(1) < masteryWeight(0));
      assert.ok(masteryWeight(10) > 0, 'never reaches zero — a mastered rule can still resurface');
    });
  });

  describe('getWeakSpots', () => {
    test('aggregates repeated mistakes and labels each by kind', () => {
      recordError('past_simple_irregular', 'I go yesterday', 'I went yesterday');
      recordError('past_simple_irregular', 'she go', 'she went');
      recordPronunciationError({ target: 'prioritize', spoken: 'pre-write the sign', confidence: 0.97 });

      const spots = getWeakSpots();
      const grammar = spots.find((s) => s.label === 'past_simple_irregular');
      const spoken = spots.find((s) => s.label === 'prioritize');

      assert.strictEqual(grammar.kind, 'grammar');
      assert.strictEqual(grammar.count, 2);
      assert.strictEqual(spoken.kind, 'pronunciation');
      assert.strictEqual(spoken.count, 1);
    });

    test('carries the last attempt so the learner sees what came out', () => {
      recordPronunciationError({ target: 'schedule', spoken: 'es-schedule', confidence: 0.71 });

      const spot = getWeakSpots().find((s) => s.label === 'schedule');
      assert.strictEqual(spot.lastAttempt, 'es-schedule');
    });

    test('ranks an actively failing rule above an equally frequent mastered one', () => {
      recordError('mastered_rule', 'a', 'b');
      recordError('mastered_rule', 'a', 'b');
      recordPronunciationError({ target: 'prioritize', spoken: 'pre-write', confidence: 0.9 });
      recordPronunciationError({ target: 'prioritize', spoken: 'priority ties', confidence: 0.9 });

      // Same error count, but the grammar rule has been cleared four times.
      for (let i = 0; i < 4; i += 1) reviewSrsCard('mastered_rule', true);

      const spots = getWeakSpots();
      assert.strictEqual(spots[0].label, 'prioritize', `expected prioritize first, got ${spots.map((s) => s.label)}`);
      assert.ok(spots[0].priority > spots[1].priority);
    });

    test('a mastered rule is demoted but never disappears', () => {
      recordError('mastered_rule', 'a', 'b');
      for (let i = 0; i < 6; i += 1) reviewSrsCard('mastered_rule', true);

      const spots = getWeakSpots();
      assert.strictEqual(spots.length, 1);
      assert.ok(spots[0].priority > 0);
      assert.ok(spots[0].repetition >= 6);
    });

    test('respects the requested limit', () => {
      for (const rule of ['a', 'b', 'c', 'd', 'e']) recordError(rule, 'x', 'y');
      assert.strictEqual(getWeakSpots(3).length, 3);
    });

    test('returns an empty list for a fresh history', () => {
      assert.deepStrictEqual(getWeakSpots(), []);
    });

    test('still reports an error whose SRS card no longer exists', () => {
      recordPronunciationError({ target: 'prioritize', spoken: 'pre-write', confidence: 0.9 });
      const data = loadHistory();
      delete data.srsCards[pronunciationCardKey('prioritize')];
      saveHistory(data);

      const spots = getWeakSpots();
      assert.strictEqual(spots.length, 1);
      assert.strictEqual(spots[0].repetition, 0);
    });
  });
});
