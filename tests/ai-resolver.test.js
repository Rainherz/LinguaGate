import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProviderName, listProviders, resetProviderCache } from '../src/services/ai/index.js';

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
});
