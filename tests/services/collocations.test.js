import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadCollocations,
  getCollocationsByCategory,
  getRandomCollocation,
  evaluateCollocationAnswer
} from '../../src/services/collocations.js';

describe('Collocations & Prepositions Gym Service', () => {
  test('loadCollocations returns items with required schema fields', () => {
    const collocations = loadCollocations();
    assert.ok(Array.isArray(collocations));
    assert.ok(collocations.length >= 10);

    const first = collocations[0];
    assert.ok(first.id);
    assert.ok(first.prompt);
    assert.ok(first.answer);
    assert.ok(first.fullPhrase);
    assert.ok(first.spanish);
    assert.ok(first.trap);
    assert.ok(first.level);
  });

  test('getCollocationsByCategory filters correctly by category', () => {
    const verbPreps = getCollocationsByCategory('verb-preposition');
    assert.ok(verbPreps.length > 0);
    assert.ok(verbPreps.every((c) => c.type === 'verb-preposition'));

    const makeVsDo = getCollocationsByCategory('make-vs-do');
    assert.ok(makeVsDo.length > 0);
    assert.ok(makeVsDo.every((c) => c.type === 'make-vs-do'));

    const all = getCollocationsByCategory('all');
    assert.strictEqual(all.length, loadCollocations().length);
  });

  test('getRandomCollocation returns a valid collocation object', () => {
    const random = getRandomCollocation();
    assert.ok(random);
    assert.ok(random.prompt.includes('___'));
  });

  test('evaluateCollocationAnswer correctly compares case-insensitive matches', () => {
    assert.strictEqual(evaluateCollocationAnswer('on', 'on'), true);
    assert.strictEqual(evaluateCollocationAnswer('on', ' ON '), true);
    assert.strictEqual(evaluateCollocationAnswer('on', 'in'), false);
    assert.strictEqual(evaluateCollocationAnswer('make/do', 'make'), true);
    assert.strictEqual(evaluateCollocationAnswer('make/do', 'DO'), true);
    assert.strictEqual(evaluateCollocationAnswer('make/do', 'take'), false);
  });
});
