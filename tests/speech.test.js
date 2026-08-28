import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWpm,
  detectFillerWords,
  calculateWordAccuracy,
  evaluateSpeechMetrics
} from '../src/services/speech.js';
import { isRecorderAvailable, detectRecorderDriver } from '../src/services/recorder.js';
import { PRACTICE_SENTENCES } from '../src/modes/speaking.js';

describe('Speech & Pronunciation Evaluation Engine', () => {
  test('isRecorderAvailable returns a boolean indicating recording support', () => {
    const available = isRecorderAvailable();
    assert.strictEqual(typeof available, 'boolean');
    const driver = detectRecorderDriver();
    if (available) {
      assert.ok(driver);
    }
  });

  test('PRACTICE_SENTENCES contains target sentences with traps and self-checks', () => {
    assert.ok(PRACTICE_SENTENCES.length >= 4);
    for (const item of PRACTICE_SENTENCES) {
      assert.ok(item.sentence);
      assert.ok(item.phonetics);
      assert.ok(item.stressTip);
      assert.ok(Array.isArray(item.traps) && item.traps.length > 0);
      assert.ok(Array.isArray(item.checks) && item.checks.length > 0);
    }
  });

  test('calculateWpm correctly calculates WPM and speed classifications', () => {
    // 20 words in 10 seconds = 120 WPM (fluent)
    const fluent = calculateWpm(20, 10);
    assert.strictEqual(fluent.wpm, 120);
    assert.strictEqual(fluent.category, 'fluent');

    // 5 words in 10 seconds = 30 WPM (slow)
    const slow = calculateWpm(5, 10);
    assert.strictEqual(slow.wpm, 30);
    assert.strictEqual(slow.category, 'slow');

    // 40 words in 10 seconds = 240 WPM (fast)
    const fast = calculateWpm(40, 10);
    assert.strictEqual(fast.wpm, 240);
    assert.strictEqual(fast.category, 'fast');
  });

  test('detectFillerWords identifies common hesitation patterns', () => {
    const text = 'Um, I think that, like, basically we should refactor, you know?';
    const result = detectFillerWords(text);

    assert.ok(result.count >= 4);
    assert.ok(result.detected.includes('um'));
    assert.ok(result.detected.includes('like'));
    assert.ok(result.detected.includes('basically'));
    assert.ok(result.detected.includes('you know'));
  });

  test('calculateWordAccuracy calculates percentage match and missing tokens', () => {
    const expected = 'I want to schedule a technical meeting';
    const actual = 'I want to schedule meeting';

    const result = calculateWordAccuracy(expected, actual);
    assert.strictEqual(result.missingWords.includes('a'), true);
    assert.strictEqual(result.missingWords.includes('technical'), true);
    assert.ok(result.accuracyScore > 50 && result.accuracyScore < 100);

    const perfect = calculateWordAccuracy(expected, expected);
    assert.strictEqual(perfect.accuracyScore, 100);
    assert.strictEqual(perfect.missingWords.length, 0);
  });

  test('evaluateSpeechMetrics compiles comprehensive scorecard', () => {
    const expected = 'We deployed the new version with zero downtime.';
    const spoken = 'Um, we deployed the new version with zero downtime.';
    const duration = 4.0; // ~135 WPM

    const metrics = evaluateSpeechMetrics(expected, spoken, duration);
    assert.strictEqual(metrics.wordCount, 9);
    assert.ok(metrics.wpm.wpm > 100);
    assert.strictEqual(metrics.fillers.count, 1);
    assert.ok(metrics.accuracy.accuracyScore >= 90);
    assert.ok(metrics.fluencyScore > 70);
  });
});
