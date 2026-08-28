import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SessionStats } from '../src/services/stats.js';

describe('SessionStats Service', () => {
  test('initializes with zero correct and incorrect', () => {
    const stats = new SessionStats('Translate Mode');
    assert.equal(stats.mode, 'Translate Mode');
    assert.equal(stats.correct, 0);
    assert.equal(stats.incorrect, 0);
  });

  test('correctly tallies correct and incorrect answers and calculates accuracy', () => {
    const stats = new SessionStats('Verbs Gym');
    stats.recordCorrect();
    stats.recordCorrect();
    stats.recordCorrect();
    stats.recordIncorrect('past_tense');

    const summary = stats.getSummary();
    assert.equal(summary.correct, 3);
    assert.equal(summary.incorrect, 1);
    assert.deepEqual(summary.topErrors, ['past_tense']);
  });

  test('sorts multiple error types by highest frequency', () => {
    const stats = new SessionStats('Listening Lab');
    stats.recordIncorrect('spelling');
    stats.recordIncorrect('phonetics');
    stats.recordIncorrect('spelling');
    stats.recordIncorrect('spelling');
    stats.recordIncorrect('phonetics');

    const summary = stats.getSummary();
    assert.equal(summary.topErrors[0], 'spelling');
    assert.equal(summary.topErrors[1], 'phonetics');
  });
});
