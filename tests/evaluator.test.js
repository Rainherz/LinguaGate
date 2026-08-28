import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { promptAudioFollowup, evaluateTranslationExercise, evaluateFillBlankExercise, evaluateChatExercise } from '../src/services/evaluator.js';

describe('Evaluator Service with Audio Integration', () => {
  test('evaluator functions are properly exported', () => {
    assert.equal(typeof promptAudioFollowup, 'function');
    assert.equal(typeof evaluateTranslationExercise, 'function');
    assert.equal(typeof evaluateFillBlankExercise, 'function');
    assert.equal(typeof evaluateChatExercise, 'function');
  });

  test('promptAudioFollowup handles empty phrases gracefully without errors', async () => {
    await assert.doesNotReject(async () => {
      await promptAudioFollowup('');
      await promptAudioFollowup(null);
      await promptAudioFollowup('   ');
    });
  });
});
