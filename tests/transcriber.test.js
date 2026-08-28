import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseTimestamp,
  parseWhisperCppOutput,
  normalizeTranscript,
  buildWhisperCppArgs,
  buildOpenAiWhisperArgs,
  detectTranscriberEngine,
  isTranscriptionAvailable,
  transcribeAudio,
  computeSpeechDuration,
  isSilenceArtifact,
  groupTokensIntoWords,
  computeClarityScore,
  classifyClarity,
  parseWhisperJson,
  SILENCE_ARTIFACTS,
  resetTranscriberCache,
  NON_SPEECH_PATTERN
} from '../src/services/transcriber.js';

describe('Speech-to-Text Transcriber Port', () => {
  describe('parseTimestamp', () => {
    test('converts hh:mm:ss.mmm into float seconds', () => {
      assert.strictEqual(parseTimestamp('00:00:00.000'), 0);
      assert.strictEqual(parseTimestamp('00:00:01.500'), 1.5);
      assert.strictEqual(parseTimestamp('00:01:30.250'), 90.25);
      assert.strictEqual(parseTimestamp('01:00:00.000'), 3600);
    });

    test('returns 0 for malformed input instead of NaN', () => {
      assert.strictEqual(parseTimestamp(''), 0);
      assert.strictEqual(parseTimestamp('garbage'), 0);
      assert.strictEqual(parseTimestamp(undefined), 0);
    });
  });

  describe('parseWhisperCppOutput', () => {
    test('extracts joined text and timed segments from timestamped stdout', () => {
      const raw = [
        '[00:00:00.000 --> 00:00:02.400]   I want to schedule a technical meeting.',
        '[00:00:02.400 --> 00:00:05.000]   We deployed the new version.'
      ].join('\n');

      const result = parseWhisperCppOutput(raw);

      assert.strictEqual(
        result.text,
        'I want to schedule a technical meeting. We deployed the new version.'
      );
      assert.strictEqual(result.segments.length, 2);
      assert.strictEqual(result.segments[0].start, 0);
      assert.strictEqual(result.segments[0].end, 2.4);
      assert.strictEqual(result.segments[0].text, 'I want to schedule a technical meeting.');
      assert.strictEqual(result.segments[1].start, 2.4);
      assert.strictEqual(result.segments[1].end, 5);
    });

    test('drops non-speech markers so they never inflate the word count', () => {
      const raw = [
        '[00:00:00.000 --> 00:00:01.000]   [BLANK_AUDIO]',
        '[00:00:01.000 --> 00:00:03.000]   Hello there.',
        '[00:00:03.000 --> 00:00:04.000]   (wind blowing)',
        '[00:00:04.000 --> 00:00:05.000]   [Music]'
      ].join('\n');

      const result = parseWhisperCppOutput(raw);

      assert.strictEqual(result.text, 'Hello there.');
      assert.strictEqual(result.segments.length, 1);
    });

    test('ignores whisper.cpp log noise that has no timestamp header', () => {
      const raw = [
        'whisper_init_from_file_with_params_no_state: loading model',
        'main: processing recording.wav (48000 samples)',
        '[00:00:00.000 --> 00:00:02.000]   Actual speech here.',
        'whisper_print_timings: total time = 1234.00 ms'
      ].join('\n');

      const result = parseWhisperCppOutput(raw);

      assert.strictEqual(result.text, 'Actual speech here.');
      assert.strictEqual(result.segments.length, 1);
    });

    test('returns an empty result for empty or silent output', () => {
      for (const input of ['', '   ', undefined, null]) {
        const result = parseWhisperCppOutput(input);
        assert.strictEqual(result.text, '');
        assert.deepStrictEqual(result.segments, []);
      }
    });

    test('NON_SPEECH_PATTERN matches bracketed and parenthesized markers only', () => {
      assert.ok(NON_SPEECH_PATTERN.test('[BLANK_AUDIO]'));
      assert.ok(NON_SPEECH_PATTERN.test('(coughs)'));
      assert.ok(!NON_SPEECH_PATTERN.test('I want to deploy'));
    });
  });

  describe('normalizeTranscript', () => {
    test('collapses whitespace and trims edges', () => {
      assert.strictEqual(normalizeTranscript('  I   want\n to  deploy \n'), 'I want to deploy');
    });

    test('returns empty string for nullish input', () => {
      assert.strictEqual(normalizeTranscript(undefined), '');
      assert.strictEqual(normalizeTranscript(null), '');
    });
  });

  describe('argument builders', () => {
    test('buildWhisperCppArgs wires model, wav path, language and full JSON output', () => {
      const args = buildWhisperCppArgs('/models/ggml-base.en.bin', '/tmp/rec.wav', '/tmp/out/probe');

      assert.ok(args.includes('-m'));
      assert.strictEqual(args[args.indexOf('-m') + 1], '/models/ggml-base.en.bin');
      assert.ok(args.includes('-f'));
      assert.strictEqual(args[args.indexOf('-f') + 1], '/tmp/rec.wav');
      assert.ok(args.includes('-l'));
      assert.strictEqual(args[args.indexOf('-l') + 1], 'en');
      // Full JSON carries per-token probabilities, which plain text does not.
      assert.ok(args.includes('--output-json-full'));
      assert.ok(args.includes('-of'));
      assert.strictEqual(args[args.indexOf('-of') + 1], '/tmp/out/probe');
      assert.ok(!args.includes('-otxt'));
    });

    test('buildOpenAiWhisperArgs targets a txt file in the given output dir', () => {
      const args = buildOpenAiWhisperArgs('/tmp/rec.wav', '/tmp/out', 'base.en');

      assert.strictEqual(args[0], '/tmp/rec.wav');
      assert.ok(args.includes('--model'));
      assert.strictEqual(args[args.indexOf('--model') + 1], 'base.en');
      assert.ok(args.includes('--output_format'));
      assert.strictEqual(args[args.indexOf('--output_format') + 1], 'txt');
      assert.ok(args.includes('--output_dir'));
      assert.strictEqual(args[args.indexOf('--output_dir') + 1], '/tmp/out');
      assert.ok(args.includes('--language'));
      assert.strictEqual(args[args.indexOf('--language') + 1], 'en');
    });
  });

  describe('engine detection', () => {
    test('detectTranscriberEngine returns a known engine descriptor or null', () => {
      resetTranscriberCache();
      const engine = detectTranscriberEngine();

      if (engine !== null) {
        assert.ok(['whisper-cpp', 'openai-whisper'].includes(engine.type));
        assert.ok(typeof engine.cmd === 'string' && engine.cmd.length > 0);
      }
    });

    test('honours an explicit "off" preference from config', () => {
      resetTranscriberCache();
      assert.strictEqual(detectTranscriberEngine({ sttEngine: 'off' }), null);
    });

    test('isTranscriptionAvailable reports a boolean consistent with detection', () => {
      resetTranscriberCache();
      const available = isTranscriptionAvailable();
      assert.strictEqual(typeof available, 'boolean');
      resetTranscriberCache();
      assert.strictEqual(available, detectTranscriberEngine() !== null);
    });
  });

  describe('computeSpeechDuration', () => {
    test('measures the span from first to last segment, ignoring lead-in silence', () => {
      const segments = [
        { start: 2.0, end: 4.5, text: 'hello' },
        { start: 4.5, end: 7.0, text: 'world' }
      ];
      // 5.0s of real speech even if the wall-clock recording was longer.
      assert.strictEqual(computeSpeechDuration(segments), 5);
    });

    test('returns 0 for empty, missing or degenerate segment lists', () => {
      assert.strictEqual(computeSpeechDuration([]), 0);
      assert.strictEqual(computeSpeechDuration(undefined), 0);
      assert.strictEqual(computeSpeechDuration(null), 0);
      assert.strictEqual(computeSpeechDuration([{ start: 1, end: 1, text: 'x' }]), 0);
    });
  });

  describe('isSilenceArtifact', () => {
    test('flags the phrases Whisper hallucinates over silence', () => {
      // Reproduced from a real 2s silent 16kHz WAV: whisper.cpp emitted "You".
      for (const phrase of ['You', 'you', 'Thank you.', 'Thanks for watching!', 'Bye.', '.']) {
        assert.strictEqual(isSilenceArtifact(phrase), true, `expected "${phrase}" to be flagged`);
      }
    });

    test('leaves real speech untouched', () => {
      for (const phrase of [
        'I want to schedule a technical meeting.',
        'Thank you for taking the time to review my pull request.',
        'You should deploy this on Friday.'
      ]) {
        assert.strictEqual(isSilenceArtifact(phrase), false, `expected "${phrase}" to pass`);
      }
    });

    test('is punctuation and case insensitive', () => {
      assert.strictEqual(isSilenceArtifact('  THANK YOU!!  '), true);
    });

    test('treats empty input as an artifact', () => {
      assert.strictEqual(isSilenceArtifact(''), true);
      assert.strictEqual(isSilenceArtifact(undefined), true);
    });

    test('SILENCE_ARTIFACTS is a non-empty normalized denylist', () => {
      assert.ok(Array.isArray(SILENCE_ARTIFACTS) && SILENCE_ARTIFACTS.length > 0);
      for (const entry of SILENCE_ARTIFACTS) {
        assert.strictEqual(entry, entry.toLowerCase());
      }
    });
  });

  describe('acoustic confidence', () => {
    // Verbatim from `whisper-cli --output-json-full` on a clean 16kHz sample.
    // Everything articulated clearly scored 0.98+; only "back-end" was weak.
    const REAL_TOKENS = [
      { text: '[_BEG_]', p: 0.991 },
      { text: ' I', p: 0.983 },
      { text: ' want', p: 0.998 },
      { text: ' to', p: 0.997 },
      { text: ' schedule', p: 0.999 },
      { text: ' a', p: 0.999 },
      { text: ' technical', p: 0.983 },
      { text: ' meeting', p: 0.998 },
      { text: ' with', p: 0.995 },
      { text: ' the', p: 0.996 },
      { text: ' back', p: 0.515 },
      { text: '-', p: 0.722 },
      { text: 'end', p: 0.677 },
      { text: ' team', p: 0.997 },
      { text: '.', p: 0.830 },
      { text: '[_TT_184]', p: 0.027 }
    ];

    describe('groupTokensIntoWords', () => {
      test('joins subword pieces into whole words', () => {
        const words = groupTokensIntoWords(REAL_TOKENS);
        const texts = words.map((w) => w.word);

        assert.deepStrictEqual(texts, [
          'I', 'want', 'to', 'schedule', 'a', 'technical',
          'meeting', 'with', 'the', 'back-end', 'team.'
        ]);
      });

      test('scores a word by its weakest token, not its average', () => {
        const words = groupTokensIntoWords(REAL_TOKENS);
        const backEnd = words.find((w) => w.word === 'back-end');

        // back=0.515, -=0.722, end=0.677 -> the weakest link is what the
        // listener actually struggled with.
        assert.strictEqual(backEnd.probability, 0.515);
      });

      test('drops whisper special tokens so they never skew the score', () => {
        const words = groupTokensIntoWords(REAL_TOKENS);
        assert.ok(!words.some((w) => w.word.includes('[_BEG_]')));
        assert.ok(!words.some((w) => w.word.includes('_TT_')));
      });

      test('returns an empty list for empty or missing input', () => {
        assert.deepStrictEqual(groupTokensIntoWords([]), []);
        assert.deepStrictEqual(groupTokensIntoWords(undefined), []);
      });

      test('treats a leading token without a space as one word', () => {
        const words = groupTokensIntoWords([{ text: 'hello', p: 0.9 }, { text: ' world', p: 0.8 }]);
        assert.deepStrictEqual(words.map((w) => w.word), ['hello', 'world']);
      });
    });

    describe('classifyClarity', () => {
      test('splits confidence into clear / borderline / unclear bands', () => {
        assert.strictEqual(classifyClarity(0.99), 'clear');
        assert.strictEqual(classifyClarity(0.85), 'clear');
        assert.strictEqual(classifyClarity(0.72), 'borderline');
        assert.strictEqual(classifyClarity(0.60), 'borderline');
        assert.strictEqual(classifyClarity(0.515), 'unclear');
        assert.strictEqual(classifyClarity(0), 'unclear');
      });
    });

    describe('computeClarityScore', () => {
      test('reflects the real sample: mostly clean with one weak word', () => {
        const score = computeClarityScore(groupTokensIntoWords(REAL_TOKENS));
        assert.ok(score > 88 && score < 96, `expected high-90s-ish, got ${score}`);
      });

      test('perfect confidence yields 100', () => {
        assert.strictEqual(computeClarityScore([{ word: 'a', probability: 1 }]), 100);
      });

      test('an all-weak utterance scores low', () => {
        const score = computeClarityScore([
          { word: 'a', probability: 0.3 },
          { word: 'b', probability: 0.4 }
        ]);
        assert.ok(score < 40, `expected a low score, got ${score}`);
      });

      test('returns 0 when there is nothing to score', () => {
        assert.strictEqual(computeClarityScore([]), 0);
        assert.strictEqual(computeClarityScore(undefined), 0);
      });
    });

    describe('parseWhisperJson', () => {
      test('extracts text, segments and per-word confidence', () => {
        const payload = {
          transcription: [
            {
              offsets: { from: 0, to: 3680 },
              text: ' I want the back-end team.',
              tokens: REAL_TOKENS
            }
          ]
        };

        const result = parseWhisperJson(payload);
        assert.strictEqual(result.text, 'I want the back-end team.');
        assert.strictEqual(result.segments.length, 1);
        assert.strictEqual(result.segments[0].start, 0);
        assert.strictEqual(result.segments[0].end, 3.68);
        assert.ok(result.words.length > 0);
        assert.strictEqual(result.words.find((w) => w.word === 'back-end').probability, 0.515);
      });

      test('survives a payload with no transcription array', () => {
        const result = parseWhisperJson({});
        assert.strictEqual(result.text, '');
        assert.deepStrictEqual(result.segments, []);
        assert.deepStrictEqual(result.words, []);
      });

      test('drops segments that are pure non-speech markers', () => {
        const payload = {
          transcription: [
            { offsets: { from: 0, to: 1000 }, text: ' [BLANK_AUDIO]', tokens: [] },
            { offsets: { from: 1000, to: 2000 }, text: ' Real speech.', tokens: [{ text: ' Real', p: 0.9 }, { text: ' speech.', p: 0.9 }] }
          ]
        };

        const result = parseWhisperJson(payload);
        assert.strictEqual(result.text, 'Real speech.');
        assert.strictEqual(result.segments.length, 1);
      });
    });
  });

  describe('transcribeAudio contract', () => {
    test('fails gracefully (never throws) when the wav file does not exist', async () => {
      const missing = join(tmpdir(), `linguagate_missing_${Date.now()}.wav`);
      const result = await transcribeAudio(missing);

      assert.strictEqual(result.success, false);
      assert.ok(typeof result.error === 'string' && result.error.length > 0);
      assert.strictEqual(result.text, '');
    });

    test('fails gracefully when transcription is disabled by config', async () => {
      const result = await transcribeAudio('/tmp/whatever.wav', { config: { sttEngine: 'off' } });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.text, '');
      assert.ok(result.error);
    });

    test('always resolves an object carrying text, segments and engine keys', async () => {
      const result = await transcribeAudio('/tmp/whatever.wav', { config: { sttEngine: 'off' } });

      assert.ok('text' in result);
      assert.ok('segments' in result);
      assert.ok('engine' in result);
      assert.ok(Array.isArray(result.segments));
    });

    test('exposes clarity fields even on the failure path', async () => {
      const result = await transcribeAudio('/tmp/whatever.wav', { config: { sttEngine: 'off' } });
      assert.ok('words' in result);
      assert.ok('clarityScore' in result);
      assert.deepStrictEqual(result.words, []);
      assert.strictEqual(result.clarityScore, 0);
    });
  });
});
