import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadVerbs, getVerbsByLevel, getRandomVerb, evaluateVerbAnswer } from '../src/services/verbs.js';

describe('Irregular Verbs Gym Service', () => {
  test('loadVerbs loads verb database with expected schema', () => {
    const verbs = loadVerbs();
    assert.ok(Array.isArray(verbs));
    assert.ok(verbs.length >= 40, 'Should have a rich list of irregular verbs');

    const sample = verbs[0];
    assert.ok(sample.infinitive);
    assert.ok(sample.past);
    assert.ok(sample.participle);
    assert.ok(sample.spanish);
    assert.ok(sample.level);
    assert.ok(sample.pattern);
  });

  test('getVerbsByLevel filters properly by CEFR level', () => {
    const a1Verbs = getVerbsByLevel('A1');
    assert.ok(a1Verbs.length > 0);
    assert.ok(a1Verbs.every((v) => v.level.toUpperCase() === 'A1'));

    const b2Verbs = getVerbsByLevel('B2');
    assert.ok(b2Verbs.length > 0);
    assert.ok(b2Verbs.every((v) => v.level.toUpperCase() === 'B2'));
  });

  test('getRandomVerb returns a valid verb object', () => {
    const verb = getRandomVerb('A1');
    assert.ok(verb);
    assert.equal(verb.level.toUpperCase(), 'A1');
  });

  test('evaluateVerbAnswer validates exact match and ignores whitespace/case', () => {
    assert.equal(evaluateVerbAnswer('went', 'went'), true);
    assert.equal(evaluateVerbAnswer('went', '  WENT  '), true);
    assert.equal(evaluateVerbAnswer('went', 'go'), false);
  });

  test('evaluateVerbAnswer supports alternative conjugations separated by slash', () => {
    // Example: learnt / learned or dreamt / dreamed
    assert.equal(evaluateVerbAnswer('learnt / learned', 'learnt'), true);
    assert.equal(evaluateVerbAnswer('learnt / learned', 'learned'), true);
    assert.equal(evaluateVerbAnswer('learnt / learned', 'learn'), false);
  });
});
