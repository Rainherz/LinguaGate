import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeAiProviders,
  describeSttEngines,
  describeTtsEngines
} from '../src/services/engine-status.js';
import { resetTranscriberCache } from '../src/services/transcriber.js';
import { resetTtsCache } from '../src/services/tts.js';

describe('Engine status', () => {
  beforeEach(() => {
    resetTranscriberCache();
    resetTtsCache();
  });

  const shapeOf = (report) => {
    assert.ok('selected' in report);
    assert.ok('resolved' in report);
    assert.ok(Array.isArray(report.options));
    for (const option of report.options) {
      assert.strictEqual(typeof option.value, 'string');
      assert.strictEqual(typeof option.label, 'string');
      assert.strictEqual(typeof option.available, 'boolean');
    }
  };

  describe('describeAiProviders', () => {
    test('reports the saved choice and what it resolves to', () => {
      const report = describeAiProviders({ aiProvider: 'auto' }, { ANTHROPIC_API_KEY: 'sk-test' });

      shapeOf(report);
      assert.strictEqual(report.selected, 'auto');
      assert.strictEqual(report.resolved, 'anthropic');
    });

    test('auto without a credential resolves to the CLI', () => {
      const report = describeAiProviders({ aiProvider: 'auto' }, {});
      assert.strictEqual(report.resolved, 'agy');
    });

    test('marks anthropic unavailable when no credential is configured', () => {
      const report = describeAiProviders({ aiProvider: 'auto' }, {});
      const anthropic = report.options.find((o) => o.value === 'anthropic');

      assert.strictEqual(anthropic.available, false);
      assert.match(anthropic.detail, /ANTHROPIC_API_KEY|credential/i);
    });

    test('an explicit choice is echoed back as selected', () => {
      const report = describeAiProviders({ aiProvider: 'anthropic' }, { ANTHROPIC_API_KEY: 'k' });
      assert.strictEqual(report.selected, 'anthropic');
      assert.strictEqual(report.resolved, 'anthropic');
    });

    test('always offers auto plus every concrete provider', () => {
      const values = describeAiProviders({}, {}).options.map((o) => o.value);
      assert.ok(values.includes('auto'));
      assert.ok(values.includes('agy'));
      assert.ok(values.includes('anthropic'));
    });
  });

  describe('describeSttEngines', () => {
    test('offers auto, both engines and off', () => {
      const values = describeSttEngines({ sttEngine: 'auto' }).options.map((o) => o.value);
      assert.deepStrictEqual(values, ['auto', 'whisper-cpp', 'openai-whisper', 'off']);
    });

    test('off resolves to nothing rather than an engine', () => {
      const report = describeSttEngines({ sttEngine: 'off' });
      shapeOf(report);
      assert.strictEqual(report.selected, 'off');
      assert.strictEqual(report.resolved, null);
    });

    test('an unavailable engine is listed with a reason, not hidden', () => {
      // Surfacing what is missing is how a learner discovers the feature exists.
      const report = describeSttEngines({ sttEngine: 'auto' });
      for (const option of report.options) {
        if (!option.available && option.value !== 'off' && option.value !== 'auto') {
          assert.ok(option.detail, `${option.value} must explain why it is unavailable`);
        }
      }
    });

    test('a detected engine reports the model it would use', () => {
      const report = describeSttEngines({ sttEngine: 'auto' });
      const whisper = report.options.find((o) => o.value === 'whisper-cpp');
      if (whisper.available) {
        assert.match(whisper.detail, /\.bin|model/i);
      }
    });
  });

  describe('describeTtsEngines', () => {
    test('lists engines in quality order with auto and off around them', () => {
      const values = describeTtsEngines({ ttsEngine: 'auto' }).options.map((o) => o.value);
      assert.deepStrictEqual(values, ['auto', 'piper', 'google', 'espeak-ng', 'off']);
    });

    test('google needs no local binary and is always available', () => {
      const report = describeTtsEngines({ ttsEngine: 'auto' });
      const google = report.options.find((o) => o.value === 'google');

      shapeOf(report);
      assert.strictEqual(google.available, true);
      assert.match(google.detail, /network|internet/i);
    });

    test('off resolves to nothing', () => {
      assert.strictEqual(describeTtsEngines({ ttsEngine: 'off' }).resolved, null);
    });
  });
});
