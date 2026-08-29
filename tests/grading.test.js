import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { gradeFillBlank, sanitizeForSpeech, parseAudioAction } from '../src/services/grading.js';

describe('Grading rules', () => {
  describe('gradeFillBlank', () => {
    test('accepts an exact match', () => {
      assert.strictEqual(gradeFillBlank('depend', 'depend'), true);
    });

    test('ignores case and surrounding whitespace on both sides', () => {
      assert.strictEqual(gradeFillBlank('  DePeNd  ', ' depend '), true);
    });

    test('rejects a different word', () => {
      assert.strictEqual(gradeFillBlank('depends', 'depend'), false);
    });

    test('rejects empty input rather than matching an empty answer', () => {
      assert.strictEqual(gradeFillBlank('', ''), false);
      assert.strictEqual(gradeFillBlank('   ', 'depend'), false);
      assert.strictEqual(gradeFillBlank(undefined, 'depend'), false);
    });

    test('rejects when the expected answer is missing', () => {
      assert.strictEqual(gradeFillBlank('depend', undefined), false);
    });
  });

  describe('sanitizeForSpeech', () => {
    test('strips markup so the TTS engine never reads a tag aloud', () => {
      assert.strictEqual(sanitizeForSpeech('I <b>want</b> to go'), 'I want to go');
      assert.strictEqual(sanitizeForSpeech('a <br/> b'), 'a  b');
    });

    test('trims and passes plain text through', () => {
      assert.strictEqual(sanitizeForSpeech('  hello world  '), 'hello world');
    });

    test('returns an empty string when nothing speakable remains', () => {
      assert.strictEqual(sanitizeForSpeech('<b></b>'), '');
      assert.strictEqual(sanitizeForSpeech(''), '');
      assert.strictEqual(sanitizeForSpeech(undefined), '');
      assert.strictEqual(sanitizeForSpeech(null), '');
    });
  });

  describe('parseAudioAction', () => {
    test('Enter and the quit sentinel both continue', () => {
      for (const input of ['', '   ', 'next', 'c', '/quit']) {
        assert.strictEqual(parseAudioAction(input), 'continue', `"${input}" should continue`);
      }
    });

    test('recognizes the normal-speed playback keys', () => {
      assert.strictEqual(parseAudioAction('a'), 'normal');
      assert.strictEqual(parseAudioAction('audio'), 'normal');
      assert.strictEqual(parseAudioAction('  A  '), 'normal');
    });

    test('recognizes the slow playback keys', () => {
      assert.strictEqual(parseAudioAction('s'), 'slow');
      assert.strictEqual(parseAudioAction('slow'), 'slow');
      assert.strictEqual(parseAudioAction('SLOW'), 'slow');
    });

    test('an unknown key is ignored rather than continuing', () => {
      // Continuing on a typo would skip past feedback the learner wanted to hear.
      assert.strictEqual(parseAudioAction('x'), 'unknown');
      assert.strictEqual(parseAudioAction('9'), 'unknown');
    });
  });
});
