import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  speedToWpm,
  buildEspeakArgs,
  buildPiperArgs,
  buildSayArgs,
  buildSapiScript,
  cacheKeyFor,
  detectTtsEngine,
  listTtsEngines,
  resetTtsCache,
  synthesize
} from '../src/services/tts.js';

describe('Text-to-Speech port', () => {
  beforeEach(() => resetTtsCache());

  describe('speedToWpm', () => {
    test('maps the app speed names to words per minute', () => {
      assert.strictEqual(speedToWpm('normal'), 160);
      assert.strictEqual(speedToWpm('slow'), 110);
      assert.strictEqual(speedToWpm('ultra-slow'), 80);
      assert.strictEqual(speedToWpm('ultra'), 80);
    });

    test('falls back to normal pace for anything unrecognized', () => {
      assert.strictEqual(speedToWpm(undefined), 160);
      assert.strictEqual(speedToWpm('turbo'), 160);
    });

    test('slower settings are strictly slower', () => {
      assert.ok(speedToWpm('ultra-slow') < speedToWpm('slow'));
      assert.ok(speedToWpm('slow') < speedToWpm('normal'));
    });
  });

  describe('buildEspeakArgs', () => {
    test('wires voice, pace and output path', () => {
      const args = buildEspeakArgs('hello there', '/tmp/out.wav', { voice: 'en-us', wpm: 110 });

      assert.strictEqual(args[args.indexOf('-v') + 1], 'en-us');
      assert.strictEqual(args[args.indexOf('-s') + 1], '110');
      assert.strictEqual(args[args.indexOf('-w') + 1], '/tmp/out.wav');
      // The phrase is passed as a single argv entry, never through a shell.
      assert.strictEqual(args[args.length - 1], 'hello there');
    });

    test('keeps a phrase with quotes intact as one argument', () => {
      const nasty = `it's "fine"; rm -rf /`;
      const args = buildEspeakArgs(nasty, '/tmp/out.wav', { voice: 'en-us', wpm: 160 });
      assert.strictEqual(args[args.length - 1], nasty);
    });
  });

  describe('buildPiperArgs', () => {
    test('wires the model and output path', () => {
      const args = buildPiperArgs('/models/en_US-amy.onnx', '/tmp/out.wav');

      assert.ok(args.includes('--model'));
      assert.strictEqual(args[args.indexOf('--model') + 1], '/models/en_US-amy.onnx');
      assert.ok(args.includes('--output_file'));
      assert.strictEqual(args[args.indexOf('--output_file') + 1], '/tmp/out.wav');
    });
  });

  describe('cacheKeyFor', () => {
    test('the same request maps to the same key', () => {
      assert.strictEqual(
        cacheKeyFor('hello', 'espeak-ng', 'normal', 'en-us'),
        cacheKeyFor('hello', 'espeak-ng', 'normal', 'en-us')
      );
    });

    test('a different engine never reuses another engine audio', () => {
      // The old cache keyed on md5(text) alone, so two engines would collide
      // and a learner could hear a robotic voice cached under a natural one.
      assert.notStrictEqual(
        cacheKeyFor('hello', 'espeak-ng', 'normal', 'en-us'),
        cacheKeyFor('hello', 'google', 'normal', 'en-us')
      );
    });

    test('speed and voice are part of the identity', () => {
      assert.notStrictEqual(
        cacheKeyFor('hello', 'espeak-ng', 'normal', 'en-us'),
        cacheKeyFor('hello', 'espeak-ng', 'slow', 'en-us')
      );
      assert.notStrictEqual(
        cacheKeyFor('hello', 'espeak-ng', 'normal', 'en-us'),
        cacheKeyFor('hello', 'espeak-ng', 'normal', 'en-gb')
      );
    });
  });

  describe('engine selection', () => {
    test('an explicit choice wins over auto-detection', () => {
      const engine = detectTtsEngine({ ttsEngine: 'google' });
      assert.strictEqual(engine?.type, 'google');
    });

    test('"off" disables synthesis entirely', () => {
      assert.strictEqual(detectTtsEngine({ ttsEngine: 'off' }), null);
    });

    test('auto returns a usable engine descriptor or null', () => {
      const engine = detectTtsEngine({ ttsEngine: 'auto' });
      if (engine !== null) {
        assert.ok(listTtsEngines().includes(engine.type));
        assert.ok(typeof engine.type === 'string');
      }
    });

    test('the selectable list is ordered by output quality, not availability', () => {
      // A learner shadowing formant synthesis learns the wrong prosody, so the
      // robotic engine must never outrank a natural-sounding one.
      const engines = listTtsEngines();
      assert.ok(engines.indexOf('piper') < engines.indexOf('google'));
      assert.ok(engines.indexOf('google') < engines.indexOf('espeak-ng'));
    });
  });

  describe('synthesize contract', () => {
    test('reports failure rather than throwing when synthesis is off', async () => {
      const result = await synthesize('hello', { config: { ttsEngine: 'off' } });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.path, null);
      assert.ok(result.error);
    });

    test('always resolves an object carrying path and engine', async () => {
      const result = await synthesize('hello', { config: { ttsEngine: 'off' } });
      assert.ok('path' in result);
      assert.ok('engine' in result);
    });

    test('empty text is refused without touching an engine', async () => {
      const result = await synthesize('   ', { config: { ttsEngine: 'espeak-ng' } });
      assert.strictEqual(result.success, false);
    });
  });

  describe('platform-native engines', () => {
    describe('buildSayArgs', () => {
      test('wires voice, rate and output file for macOS say', () => {
        const args = buildSayArgs('hello there', '/tmp/out.aiff', { voice: 'Samantha', wpm: 110 });

        assert.strictEqual(args[args.indexOf('-v') + 1], 'Samantha');
        assert.strictEqual(args[args.indexOf('-r') + 1], '110');
        assert.strictEqual(args[args.indexOf('-o') + 1], '/tmp/out.aiff');
        // The phrase is one argv entry — never interpolated into a shell.
        assert.strictEqual(args[args.length - 1], 'hello there');
      });

      test('keeps a phrase containing quotes intact', () => {
        const nasty = `it's "fine"; rm -rf /`;
        assert.strictEqual(buildSayArgs(nasty, '/tmp/o.aiff', {}).at(-1), nasty);
      });
    });

    describe('buildSapiScript', () => {
      test('produces a PowerShell script that writes to the given file', () => {
        const script = buildSapiScript('hello there', 'C:\\tmp\\out.wav', { wpm: 160 });

        assert.match(script, /SpeechSynthesizer/);
        assert.match(script, /SetOutputToWaveFile/);
        assert.match(script, /hello there/);
        assert.match(script, /C:\\tmp\\out\.wav/);
      });

      test('escapes single quotes so a phrase cannot break out of the string', () => {
        const script = buildSapiScript("it's fine", 'C:\\o.wav', {});
        assert.match(script, /it''s fine/);
      });

      test('maps the pace onto the SAPI rate range', () => {
        const slow = buildSapiScript('x', 'C:\\o.wav', { wpm: 80 });
        const fast = buildSapiScript('x', 'C:\\o.wav', { wpm: 200 });

        const rateOf = (s) => Number(/Rate = (-?\d+)/.exec(s)[1]);
        assert.ok(rateOf(slow) < rateOf(fast));
        // SAPI only accepts -10..10.
        for (const s of [slow, fast]) {
          assert.ok(rateOf(s) >= -10 && rateOf(s) <= 10);
        }
      });
    });
  });
});
