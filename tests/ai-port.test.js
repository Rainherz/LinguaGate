import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractJson,
  validateAgainstSchema,
  SchemaValidationError,
  askText,
  askJson,
  setProvider,
  resetProvider
} from '../src/services/ai/port.js';
import { createFakeProvider } from '../src/services/ai/adapters/fake.js';

const GRAMMAR_SCHEMA = {
  type: 'object',
  properties: {
    isCorrect: { type: 'boolean' },
    corrections: { type: 'array', items: { type: 'string' } },
    correctedText: { type: 'string' }
  },
  required: ['isCorrect', 'corrections', 'correctedText']
};

describe('AI Port', () => {
  describe('extractJson', () => {
    test('parses a bare JSON object', () => {
      assert.deepStrictEqual(extractJson('{"a":1}'), { a: 1 });
    });

    test('strips ```json fences the model adds despite instructions', () => {
      assert.deepStrictEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
      assert.deepStrictEqual(extractJson('```\n{"a":1}\n```'), { a: 1 });
    });

    test('recovers an object embedded in surrounding prose', () => {
      const raw = 'Sure! Here is the result:\n{"isCorrect": true}\nHope that helps.';
      assert.deepStrictEqual(extractJson(raw), { isCorrect: true });
    });

    test('handles nested braces without truncating the object', () => {
      const raw = 'prose {"a": {"b": [1,2]}, "c": "}"} trailing';
      assert.deepStrictEqual(extractJson(raw), { a: { b: [1, 2] }, c: '}' });
    });

    test('throws a typed error on unparseable content instead of returning junk', () => {
      assert.throws(() => extractJson('not json at all'), SchemaValidationError);
      assert.throws(() => extractJson(''), SchemaValidationError);
    });
  });

  describe('validateAgainstSchema', () => {
    test('accepts a conforming object', () => {
      const value = { isCorrect: true, corrections: [], correctedText: 'ok' };
      assert.deepStrictEqual(validateAgainstSchema(value, GRAMMAR_SCHEMA), value);
    });

    test('rejects a missing required key', () => {
      assert.throws(
        () => validateAgainstSchema({ isCorrect: true, corrections: [] }, GRAMMAR_SCHEMA),
        /correctedText/
      );
    });

    test('rejects a wrong primitive type', () => {
      assert.throws(
        () => validateAgainstSchema(
          { isCorrect: 'yes', corrections: [], correctedText: 'ok' },
          GRAMMAR_SCHEMA
        ),
        /isCorrect/
      );
    });

    test('rejects an object where an array was required', () => {
      assert.throws(
        () => validateAgainstSchema(
          { isCorrect: true, corrections: {}, correctedText: 'ok' },
          GRAMMAR_SCHEMA
        ),
        /corrections/
      );
    });

    test('rejects a null payload', () => {
      assert.throws(() => validateAgainstSchema(null, GRAMMAR_SCHEMA), SchemaValidationError);
    });
  });

  describe('provider routing', () => {
    beforeEach(() => resetProvider());

    test('askText returns whatever the provider produced', async () => {
      setProvider(createFakeProvider({ text: 'hello there' }));
      assert.strictEqual(await askText('anything'), 'hello there');
    });

    test('askJson returns the validated object', async () => {
      const payload = { isCorrect: false, corrections: ['tense'], correctedText: 'He went.' };
      setProvider(createFakeProvider({ json: payload }));
      assert.deepStrictEqual(await askJson('check this', GRAMMAR_SCHEMA), payload);
    });

    test('askJson records the schema it handed the provider', async () => {
      const fake = createFakeProvider({ json: { isCorrect: true, corrections: [], correctedText: 'x' } });
      setProvider(fake);
      await askJson('prompt text', GRAMMAR_SCHEMA);

      assert.strictEqual(fake.calls.length, 1);
      assert.strictEqual(fake.calls[0].prompt, 'prompt text');
      assert.deepStrictEqual(fake.calls[0].schema, GRAMMAR_SCHEMA);
    });

    test('askJson retries once when the first response is malformed', async () => {
      const fake = createFakeProvider({
        sequence: ['I refuse to emit JSON', JSON.stringify({ isCorrect: true, corrections: [], correctedText: 'ok' })]
      });
      setProvider(fake);

      const result = await askJson('p', GRAMMAR_SCHEMA);
      assert.strictEqual(result.isCorrect, true);
      assert.strictEqual(fake.calls.length, 2, 'expected exactly one retry');
    });

    test('askJson gives up after the retry and throws a typed error', async () => {
      const fake = createFakeProvider({ sequence: ['garbage', 'still garbage'] });
      setProvider(fake);

      await assert.rejects(() => askJson('p', GRAMMAR_SCHEMA), SchemaValidationError);
      assert.strictEqual(fake.calls.length, 2, 'must not retry more than once');
    });

    test('askJson does not retry when the provider itself fails', async () => {
      const fake = createFakeProvider({ error: new Error('provider exploded') });
      setProvider(fake);

      await assert.rejects(() => askJson('p', GRAMMAR_SCHEMA), /provider exploded/);
      assert.strictEqual(fake.calls.length, 1);
    });

    test('a provider returning structured data skips text parsing entirely', async () => {
      const payload = { isCorrect: true, corrections: [], correctedText: 'ok' };
      const fake = createFakeProvider({ structured: payload });
      setProvider(fake);

      assert.deepStrictEqual(await askJson('p', GRAMMAR_SCHEMA), payload);
    });
  });
});
