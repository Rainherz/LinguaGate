import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveProviderName,
  listProviders,
  resetProviderCache,
  isProviderAvailable,
  describeProviderGap
} from '../src/services/ai/index.js';

describe('AI provider resolver', () => {
  beforeEach(() => resetProviderCache());

  test('an explicit provider choice always wins', () => {
    assert.strictEqual(
      resolveProviderName({ aiProvider: 'agy' }, { ANTHROPIC_API_KEY: 'sk-test' }),
      'agy'
    );
    assert.strictEqual(
      resolveProviderName({ aiProvider: 'anthropic' }, {}),
      'anthropic'
    );
  });

  test('auto prefers direct Claude when an API key is present', () => {
    assert.strictEqual(
      resolveProviderName({ aiProvider: 'auto' }, { ANTHROPIC_API_KEY: 'sk-test' }),
      'anthropic'
    );
  });

  test('auto falls back to the agy CLI when no key is configured', () => {
    assert.strictEqual(resolveProviderName({ aiProvider: 'auto' }, {}), 'agy');
  });

  test('auto also accepts ANTHROPIC_AUTH_TOKEN as a credential', () => {
    assert.strictEqual(
      resolveProviderName({ aiProvider: 'auto' }, { ANTHROPIC_AUTH_TOKEN: 'tok' }),
      'anthropic'
    );
  });

  test('an empty key string does not count as configured', () => {
    assert.strictEqual(resolveProviderName({ aiProvider: 'auto' }, { ANTHROPIC_API_KEY: '  ' }), 'agy');
  });

  test('a missing or unknown preference degrades to auto behaviour', () => {
    assert.strictEqual(resolveProviderName({}, {}), 'agy');
    assert.strictEqual(resolveProviderName({ aiProvider: 'nonsense' }, {}), 'agy');
    assert.strictEqual(
      resolveProviderName({ aiProvider: 'nonsense' }, { ANTHROPIC_API_KEY: 'k' }),
      'anthropic'
    );
  });

  test('listProviders exposes exactly the selectable names', () => {
    assert.deepStrictEqual(listProviders(), ['auto', 'agy', 'anthropic']);
  });

  describe('availability', () => {
    test('anthropic is available exactly when a credential exists', () => {
      assert.strictEqual(isProviderAvailable('anthropic', { ANTHROPIC_API_KEY: 'k' }, () => false), true);
      assert.strictEqual(isProviderAvailable('anthropic', {}, () => true), false);
    });

    test('agy is available exactly when its binary is installed', () => {
      assert.strictEqual(isProviderAvailable('agy', {}, () => true), true);
      assert.strictEqual(isProviderAvailable('agy', {}, () => false), false);
    });

    test('an unknown provider is never reported as available', () => {
      assert.strictEqual(isProviderAvailable('mystery', {}, () => true), false);
    });
  });

  describe('describeProviderGap', () => {
    test('says nothing when the resolved provider is usable', () => {
      assert.strictEqual(describeProviderGap({ aiProvider: 'auto' }, { ANTHROPIC_API_KEY: 'k' }, () => false), null);
      assert.strictEqual(describeProviderGap({ aiProvider: 'auto' }, {}, () => true), null);
    });

    /**
     * Without a provider no mode can generate an exercise. Failing per-exercise
     * with `spawn agy ENOENT` tells a learner nothing actionable.
     */
    test('explains the gap when nothing is installed or configured', () => {
      const gap = describeProviderGap({ aiProvider: 'auto' }, {}, () => false);

      assert.ok(gap);
      assert.match(gap, /ANTHROPIC_API_KEY/);
      assert.match(gap, /agy/);
    });

    test('names the specific problem when a provider was chosen explicitly', () => {
      const noKey = describeProviderGap({ aiProvider: 'anthropic' }, {}, () => true);
      assert.match(noKey, /ANTHROPIC_API_KEY/);

      const noBinary = describeProviderGap({ aiProvider: 'agy' }, { ANTHROPIC_API_KEY: 'k' }, () => false);
      assert.match(noBinary, /agy/);
    });
  });
});
