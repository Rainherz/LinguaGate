import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import {
  recordError,
  reviewSrsCard,
  getTopErrors,
  loadHistory,
  recordPronunciationError,
  pronunciationCardKey,
  getCardKind,
  srsCardKey,
  getDueSrsCards
} from '../src/services/history.js';

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

  describe('pronunciation cards', () => {
    test('each substitution span gets its own card, not one shared bucket', () => {
      recordPronunciationError({ target: 'prioritize', spoken: 'pre-write the sign,', confidence: 0.97 });
      recordPronunciationError({ target: 'production outage', spoken: 'revolution of the HMI', confidence: 0.95 });

      const { srsCards } = loadHistory();
      const keys = Object.keys(srsCards);

      assert.strictEqual(keys.length, 2, `expected two distinct cards, got ${keys}`);
      assert.ok(srsCards[pronunciationCardKey('prioritize')]);
      assert.ok(srsCards[pronunciationCardKey('production outage')]);
    });

    test('a pronunciation card carries the target and what was actually said', () => {
      recordPronunciationError({ target: 'prioritize', spoken: 'pre-write the sign,', confidence: 0.97 });

      const card = loadHistory().srsCards[pronunciationCardKey('prioritize')];

      assert.strictEqual(card.kind, 'pronunciation');
      assert.strictEqual(card.target, 'prioritize');
      assert.strictEqual(card.lastSpoken, 'pre-write the sign,');
      assert.strictEqual(card.confidence, 0.97);
      assert.strictEqual(card.interval, 1);
      assert.strictEqual(card.repetition, 0);
      assert.match(card.rule, /prioritize/);
    });

    test('repeating the same mistake bumps the count and resets the interval', () => {
      recordPronunciationError({ target: 'prioritize', spoken: 'pre-write', confidence: 0.9 });
      const key = pronunciationCardKey('prioritize');
      reviewSrsCard(key, true);
      reviewSrsCard(key, true);

      assert.ok(loadHistory().srsCards[key].interval > 1, 'interval should have grown');

      recordPronunciationError({ target: 'prioritize', spoken: 'priority ties', confidence: 0.8 });
      const card = loadHistory().srsCards[key];

      assert.strictEqual(card.count, 2);
      assert.strictEqual(card.interval, 1);
      assert.strictEqual(card.repetition, 0);
      assert.strictEqual(card.lastSpoken, 'priority ties');
    });

    test('the key is case and punctuation insensitive so one phrase means one card', () => {
      recordPronunciationError({ target: 'Prioritize!', spoken: 'pre-write', confidence: 0.9 });
      recordPronunciationError({ target: 'prioritize', spoken: 'pre write', confidence: 0.9 });

      assert.strictEqual(Object.keys(loadHistory().srsCards).length, 1);
      assert.strictEqual(loadHistory().srsCards[pronunciationCardKey('prioritize')].count, 2);
    });

    test('the key never collides with a grammar rule of the same name', () => {
      recordError('prioritize', 'a', 'b');
      recordPronunciationError({ target: 'prioritize', spoken: 'pre-write', confidence: 0.9 });

      const { srsCards } = loadHistory();
      assert.strictEqual(Object.keys(srsCards).length, 2);
      assert.notStrictEqual(pronunciationCardKey('prioritize'), 'prioritize');
    });

    test('ignores an empty or missing target instead of creating a junk card', () => {
      recordPronunciationError({ target: '', spoken: 'x', confidence: 0.5 });
      recordPronunciationError({ target: '   ', spoken: 'x', confidence: 0.5 });
      recordPronunciationError(undefined);

      assert.deepStrictEqual(Object.keys(loadHistory().srsCards), []);
    });

    test('pronunciation cards show up in the due queue alongside grammar cards', () => {
      recordError('past_simple', 'a', 'b');
      recordPronunciationError({ target: 'prioritize', spoken: 'pre-write', confidence: 0.9 });

      const due = getDueSrsCards();
      assert.strictEqual(due.length, 2);
      assert.ok(due.some((c) => getCardKind(c) === 'pronunciation'));
      assert.ok(due.some((c) => getCardKind(c) === 'grammar'));
    });
  });

  describe('getCardKind', () => {
    test('defaults to grammar for cards written before pronunciation existed', () => {
      recordError('legacy_rule', 'a', 'b');
      const card = loadHistory().srsCards['legacy_rule'];

      assert.strictEqual(card.kind, undefined, 'grammar cards stay unchanged on disk');
      assert.strictEqual(getCardKind(card), 'grammar');
    });

    test('reads the explicit kind when present', () => {
      assert.strictEqual(getCardKind({ kind: 'pronunciation' }), 'pronunciation');
      assert.strictEqual(getCardKind({}), 'grammar');
      assert.strictEqual(getCardKind(null), 'grammar');
    });
  });

  describe('srsCardKey', () => {
    test('resolves the storage key for either card kind', () => {
      recordError('past_simple', 'a', 'b');
      recordPronunciationError({ target: 'prioritize', spoken: 'pre-write', confidence: 0.9 });

      const { srsCards } = loadHistory();
      const grammar = srsCards['past_simple'];
      const pronunciation = srsCards[pronunciationCardKey('prioritize')];

      assert.strictEqual(srsCardKey(grammar), 'past_simple');
      assert.strictEqual(srsCardKey(pronunciation), pronunciationCardKey('prioritize'));
    });

    test('a card fetched from the due queue can be scheduled by its key', () => {
      recordPronunciationError({ target: 'prioritize', spoken: 'pre-write', confidence: 0.9 });
      const card = getDueSrsCards().find((c) => getCardKind(c) === 'pronunciation');

      reviewSrsCard(srsCardKey(card), true);

      const updated = loadHistory().srsCards[pronunciationCardKey('prioritize')];
      assert.strictEqual(updated.repetition, 1, 'the card must actually advance');
    });
  });
});
