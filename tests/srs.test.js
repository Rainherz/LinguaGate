import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { recordError, getDueSrsCards, reviewSrsCard, getTopErrors, updateStreak, loadHistory } from '../src/services/history.js';
import { writeJsonAtomic } from '../src/services/storage.js';

describe('SRS (Spaced Repetition / SM-2) Service', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'srs-test-'));
    process.env.LINGUAGATE_DATA_DIR = tempDir;
  });

  afterEach(() => {
    delete process.env.LINGUAGATE_DATA_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('recordError registers error and initializes SRS card with interval 1', () => {
    recordError('past_simple_irregular', 'I go to school yesterday', 'I went to school yesterday');

    const history = loadHistory();
    const card = history.srsCards['past_simple_irregular'];

    assert.ok(card, 'SRS card should be created');
    assert.equal(card.rule, 'past_simple_irregular');
    assert.equal(card.interval, 1);
    assert.equal(card.repetition, 0);
    assert.equal(card.lastMistake.original, 'I go to school yesterday');
    assert.equal(card.lastMistake.corrected, 'I went to school yesterday');
  });

  test('reviewSrsCard progresses interval on consecutive correct answers', () => {
    const rule = 'subject_verb_agreement';
    recordError(rule, 'She go', 'She goes');

    // First correct review -> rep 1, interval 1
    reviewSrsCard(rule, true);
    let card = loadHistory().srsCards[rule];
    assert.equal(card.repetition, 1);
    assert.equal(card.interval, 1);

    // Second correct review -> rep 2, interval 3
    reviewSrsCard(rule, true);
    card = loadHistory().srsCards[rule];
    assert.equal(card.repetition, 2);
    assert.equal(card.interval, 3);

    // Third correct review -> rep 3, interval Math.round(3 * 2.5) = 8
    reviewSrsCard(rule, true);
    card = loadHistory().srsCards[rule];
    assert.equal(card.repetition, 3);
    assert.equal(card.interval, 8);
  });

  test('reviewSrsCard resets repetition and interval to 1 on failure', () => {
    const rule = 'preposition_in_on_at';
    recordError(rule, 'in Monday', 'on Monday');

    // Advance 2 times
    reviewSrsCard(rule, true);
    reviewSrsCard(rule, true);
    let card = loadHistory().srsCards[rule];
    assert.equal(card.interval, 3);

    // Fail review -> reset to interval 1, repetition 0
    reviewSrsCard(rule, false);
    card = loadHistory().srsCards[rule];
    assert.equal(card.repetition, 0);
    assert.equal(card.interval, 1);
  });

  test('getTopErrors sorts errors by frequency', () => {
    recordError('rule_A', 'x', 'y');
    recordError('rule_A', 'x', 'y');
    recordError('rule_B', 'x', 'y');

    const top = getTopErrors(2);
    assert.ok(top.length > 0);
    assert.equal(top[0].type, 'rule_A');
    assert.ok(top[0].count >= 2);
  });
});
