import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlacementLevel, PLACEMENT_QUESTIONS } from '../src/modes/placement.js';

describe('Placement & Diagnostic Calibration Logic', () => {
  test('PLACEMENT_QUESTIONS contains 6 diagnostic questions across CEFR levels', () => {
    assert.strictEqual(PLACEMENT_QUESTIONS.length, 6);
    assert.ok(PLACEMENT_QUESTIONS.some((q) => q.level === 'A1'));
    assert.ok(PLACEMENT_QUESTIONS.some((q) => q.level === 'A2'));
    assert.ok(PLACEMENT_QUESTIONS.some((q) => q.level === 'B1'));
    assert.ok(PLACEMENT_QUESTIONS.some((q) => q.level === 'B2'));
    assert.ok(PLACEMENT_QUESTIONS.some((q) => q.level === 'C1'));
  });

  test('calculatePlacementLevel returns A1 when failing A1/A2', () => {
    const level = calculatePlacementLevel({ A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 });
    assert.strictEqual(level, 'A1');
  });

  test('calculatePlacementLevel returns A2 when passing A1 and A2', () => {
    const level = calculatePlacementLevel({ A1: 1, A2: 1, B1: 0, B2: 0, C1: 0 });
    assert.strictEqual(level, 'A2');
  });

  test('calculatePlacementLevel returns B1 when passing A1, A2, and B1', () => {
    const level = calculatePlacementLevel({ A1: 1, A2: 1, B1: 1, B2: 0, C1: 0 });
    assert.strictEqual(level, 'B1');
  });

  test('calculatePlacementLevel returns B2 when passing A1, A2, 2x B1, and B2', () => {
    const level = calculatePlacementLevel({ A1: 1, A2: 1, B1: 2, B2: 1, C1: 0 });
    assert.strictEqual(level, 'B2');
  });

  test('calculatePlacementLevel returns C1 when passing all levels', () => {
    const level = calculatePlacementLevel({ A1: 1, A2: 1, B1: 2, B2: 1, C1: 1 });
    assert.strictEqual(level, 'C1');
  });
});
