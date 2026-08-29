import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWpm,
  detectFillerWords,
  calculateWordAccuracy,
  evaluateSpeechMetrics,
  diffSpokenWords,
  formatAcousticEvidence,
  diagnoseArticulation,
  groupSubstitutionSpans,
  scoreDictation
} from '../src/services/speech.js';
import { isRecorderAvailable, detectRecorderDriver } from '../src/services/recorder.js';
import { PRACTICE_SENTENCES } from '../src/modes/speaking.js';

describe('Speech & Pronunciation Evaluation Engine', () => {
  test('isRecorderAvailable returns a boolean indicating recording support', () => {
    const available = isRecorderAvailable();
    assert.strictEqual(typeof available, 'boolean');
    const driver = detectRecorderDriver();
    if (available) {
      assert.ok(driver);
    }
  });

  test('PRACTICE_SENTENCES contains target sentences with traps and self-checks', () => {
    assert.ok(PRACTICE_SENTENCES.length >= 4);
    for (const item of PRACTICE_SENTENCES) {
      assert.ok(item.sentence);
      assert.ok(item.phonetics);
      assert.ok(item.stressTip);
      assert.ok(Array.isArray(item.traps) && item.traps.length > 0);
      assert.ok(Array.isArray(item.checks) && item.checks.length > 0);
    }
  });

  test('calculateWpm correctly calculates WPM and speed classifications', () => {
    // 20 words in 10 seconds = 120 WPM (fluent)
    const fluent = calculateWpm(20, 10);
    assert.strictEqual(fluent.wpm, 120);
    assert.strictEqual(fluent.category, 'fluent');

    // 5 words in 10 seconds = 30 WPM (slow)
    const slow = calculateWpm(5, 10);
    assert.strictEqual(slow.wpm, 30);
    assert.strictEqual(slow.category, 'slow');

    // 40 words in 10 seconds = 240 WPM (fast)
    const fast = calculateWpm(40, 10);
    assert.strictEqual(fast.wpm, 240);
    assert.strictEqual(fast.category, 'fast');
  });

  test('detectFillerWords identifies common hesitation patterns', () => {
    const text = 'Um, I think that, like, basically we should refactor, you know?';
    const result = detectFillerWords(text);

    assert.ok(result.count >= 4);
    assert.ok(result.detected.includes('um'));
    assert.ok(result.detected.includes('like'));
    assert.ok(result.detected.includes('basically'));
    assert.ok(result.detected.includes('you know'));
  });

  test('calculateWordAccuracy calculates percentage match and missing tokens', () => {
    const expected = 'I want to schedule a technical meeting';
    const actual = 'I want to schedule meeting';

    const result = calculateWordAccuracy(expected, actual);
    assert.strictEqual(result.missingWords.includes('a'), true);
    assert.strictEqual(result.missingWords.includes('technical'), true);
    assert.ok(result.accuracyScore > 50 && result.accuracyScore < 100);

    const perfect = calculateWordAccuracy(expected, expected);
    assert.strictEqual(perfect.accuracyScore, 100);
    assert.strictEqual(perfect.missingWords.length, 0);
  });

  test('evaluateSpeechMetrics compiles comprehensive scorecard', () => {
    const expected = 'We deployed the new version with zero downtime.';
    const spoken = 'Um, we deployed the new version with zero downtime.';
    const duration = 4.0; // ~135 WPM

    const metrics = evaluateSpeechMetrics(expected, spoken, duration);
    assert.strictEqual(metrics.wordCount, 9);
    assert.ok(metrics.wpm.wpm > 100);
    assert.strictEqual(metrics.fillers.count, 1);
    assert.ok(metrics.accuracy.accuracyScore >= 90);
    assert.ok(metrics.fluencyScore > 70);
  });

  describe('diffSpokenWords', () => {
    test('marks every token matched when the sentence is spoken exactly', () => {
      const { expectedTokens, actualTokens } = diffSpokenWords('We deployed the bug fix', 'We deployed the bug fix');

      assert.ok(expectedTokens.every((t) => t.matched));
      assert.ok(actualTokens.every((t) => t.matched));
      assert.strictEqual(expectedTokens.length, 5);
    });

    test('flags a substituted word on BOTH sides so the swap is visible', () => {
      // Real case from the scorecard: learner said "book" instead of "bug".
      const { expectedTokens, actualTokens } = diffSpokenWords('I fixed the bug', 'I fixed the book');

      const expectedBug = expectedTokens.find((t) => t.word === 'bug');
      const actualBook = actualTokens.find((t) => t.word === 'book');

      assert.strictEqual(expectedBug.matched, false);
      assert.strictEqual(actualBook.matched, false);
      assert.strictEqual(expectedTokens.filter((t) => t.matched).length, 3);
    });

    test('flags omitted words as unmatched on the expected side only', () => {
      const { expectedTokens, actualTokens } = diffSpokenWords('I want a technical meeting', 'I want a meeting');

      assert.strictEqual(expectedTokens.find((t) => t.word === 'technical').matched, false);
      assert.ok(actualTokens.every((t) => t.matched));
    });

    test('ignores case and punctuation when comparing', () => {
      const { expectedTokens, actualTokens } = diffSpokenWords('We deployed it.', 'we DEPLOYED it!');

      assert.ok(expectedTokens.every((t) => t.matched));
      assert.ok(actualTokens.every((t) => t.matched));
    });

    test('preserves the original spelling for display', () => {
      const { actualTokens } = diffSpokenWords('the back-end team', 'the BACK-END team');
      assert.strictEqual(actualTokens[1].word, 'BACK-END');
      assert.strictEqual(actualTokens[1].matched, true);
    });

    test('handles an empty spoken side without throwing', () => {
      const { expectedTokens, actualTokens } = diffSpokenWords('hello world', '');

      assert.deepStrictEqual(actualTokens, []);
      assert.ok(expectedTokens.every((t) => t.matched === false));
    });

    test('counts repeated words correctly instead of matching them twice', () => {
      const { expectedTokens } = diffSpokenWords('the cat and the dog', 'the cat and dog');
      // Only one "the" was spoken, so exactly one of the two must stay unmatched.
      assert.strictEqual(expectedTokens.filter((t) => t.word === 'the' && t.matched).length, 1);
      assert.strictEqual(expectedTokens.filter((t) => t.word === 'the' && !t.matched).length, 1);
    });
  });

  describe('diagnoseArticulation', () => {
    // The real failure this was built for: the learner spoke CONFIDENTLY but
    // said different words. Whisper was 97-99% sure — clarity alone called it
    // perfect while half the sentence was wrong.
    const TARGET = 'We should prioritize resolving this critical production outage immediately.';
    const SPOKEN = 'We should pre-write the sign, resolving this critical revolution of the HMI.';
    const CONFIDENT_WORDS = [
      { word: 'We', probability: 0.99 },
      { word: 'should', probability: 0.99 },
      { word: 'pre-write', probability: 0.97 },
      { word: 'the', probability: 0.99 },
      { word: 'sign,', probability: 0.98 },
      { word: 'resolving', probability: 0.99 },
      { word: 'this', probability: 0.99 },
      { word: 'critical', probability: 0.99 },
      { word: 'revolution', probability: 0.96 },
      { word: 'of', probability: 0.99 },
      { word: 'the', probability: 0.99 },
      { word: 'HMI.', probability: 0.95 }
    ];

    test('flags high-confidence mismatches as confident substitutions', () => {
      const d = diagnoseArticulation(TARGET, SPOKEN, CONFIDENT_WORDS);

      assert.strictEqual(d.verdict, 'confident-substitution');
      const subs = d.words.filter((w) => w.verdict === 'confident-substitution').map((w) => w.word);
      assert.ok(subs.includes('pre-write'), `expected pre-write among ${subs}`);
      assert.ok(subs.includes('revolution'));
      assert.ok(d.substitutions.length >= 3);
    });

    test('does NOT call a butchered sentence clean just because confidence was high', () => {
      const d = diagnoseArticulation(TARGET, SPOKEN, CONFIDENT_WORDS);
      assert.notStrictEqual(d.verdict, 'clean');
      assert.match(d.summary, /different words|substitut/i);
    });

    test('a perfect read is clean', () => {
      const words = [
        { word: 'We', probability: 0.99 },
        { word: 'should', probability: 0.98 },
        { word: 'deploy', probability: 0.97 }
      ];
      const d = diagnoseArticulation('We should deploy', 'We should deploy', words);

      assert.strictEqual(d.verdict, 'clean');
      assert.strictEqual(d.substitutions.length, 0);
      assert.ok(d.words.every((w) => w.verdict === 'correct'));
    });

    test('right words spoken unclearly is unclear-delivery, not substitution', () => {
      const words = [
        { word: 'We', probability: 0.99 },
        { word: 'should', probability: 0.55 },
        { word: 'deploy', probability: 0.50 }
      ];
      const d = diagnoseArticulation('We should deploy', 'We should deploy', words);

      assert.strictEqual(d.verdict, 'unclear-delivery');
      assert.strictEqual(d.substitutions.length, 0);
      assert.strictEqual(d.words.filter((w) => w.verdict === 'unclear').length, 2);
    });

    test('low-confidence mismatches are mumbled substitutions, a different problem', () => {
      const words = [
        { word: 'We', probability: 0.99 },
        { word: 'shudder', probability: 0.41 }
      ];
      const d = diagnoseArticulation('We should', 'We shudder', words);

      const w = d.words.find((x) => x.word === 'shudder');
      assert.strictEqual(w.verdict, 'mumbled-substitution');
      assert.strictEqual(d.verdict, 'mumbled-substitution');
    });

    test('degrades gracefully with no acoustic data at all', () => {
      const d = diagnoseArticulation('We should deploy', 'We should destroy', []);

      assert.ok(Array.isArray(d.words));
      assert.strictEqual(d.words.find((w) => w.word === 'destroy').probability, null);
      assert.strictEqual(d.words.find((w) => w.word === 'destroy').verdict, 'substitution');
      assert.strictEqual(d.verdict, 'substitution');
    });

    test('handles empty input without throwing', () => {
      const d = diagnoseArticulation('', '', []);
      assert.deepStrictEqual(d.words, []);
      assert.strictEqual(d.verdict, 'clean');
    });
  });

  describe('formatAcousticEvidence with a diagnosis', () => {
    test('reports confident substitutions instead of claiming everything was clear', () => {
      const diagnosis = diagnoseArticulation(
        'We should prioritize this',
        'We should pre-write the sign',
        [
          { word: 'We', probability: 0.99 },
          { word: 'should', probability: 0.99 },
          { word: 'pre-write', probability: 0.97 },
          { word: 'the', probability: 0.99 },
          { word: 'sign', probability: 0.98 }
        ]
      );
      const evidence = formatAcousticEvidence(diagnosis);

      assert.match(evidence, /pre-write/);
      assert.doesNotMatch(evidence, /every word was clearly articulated/i);
      assert.match(evidence, /confident|clearly.*different|substitut/i);
    });

    test('only claims a clean read when nothing was substituted or unclear', () => {
      const diagnosis = diagnoseArticulation('We deploy', 'We deploy', [
        { word: 'We', probability: 0.99 },
        { word: 'deploy', probability: 0.98 }
      ]);
      assert.match(formatAcousticEvidence(diagnosis), /clearly articulated|matched the target/i);
    });

    test('returns an empty string when there is nothing to report', () => {
      assert.strictEqual(formatAcousticEvidence(null), '');
      assert.strictEqual(formatAcousticEvidence(/** @type {any} */ ({ words: [] })), '');
    });
  });

  describe('groupSubstitutionSpans', () => {
    test('collapses a contiguous run into one target-to-spoken span', () => {
      const spans = groupSubstitutionSpans(
        'We should prioritize resolving this critical production outage immediately.',
        'We should pre-write the sign, resolving this critical revolution of the HMI.'
      );

      assert.strictEqual(spans.length, 2);

      assert.strictEqual(spans[0].type, 'substitution');
      assert.strictEqual(spans[0].target, 'prioritize');
      assert.strictEqual(spans[0].spoken, 'pre-write the sign,');

      assert.strictEqual(spans[1].type, 'substitution');
      assert.strictEqual(spans[1].target, 'production outage immediately.');
      assert.strictEqual(spans[1].spoken, 'revolution of the HMI.');
    });

    test('reports a dropped word as an omission, not a substitution', () => {
      const spans = groupSubstitutionSpans('I want a technical meeting', 'I want a meeting');

      assert.strictEqual(spans.length, 1);
      assert.strictEqual(spans[0].type, 'omission');
      assert.strictEqual(spans[0].target, 'technical');
      assert.strictEqual(spans[0].spoken, '');
    });

    test('reports an extra word as an insertion', () => {
      const spans = groupSubstitutionSpans('I want meeting', 'I want a meeting');

      assert.strictEqual(spans.length, 1);
      assert.strictEqual(spans[0].type, 'insertion');
      assert.strictEqual(spans[0].target, '');
      assert.strictEqual(spans[0].spoken, 'a');
    });

    test('a perfect read produces no spans', () => {
      assert.deepStrictEqual(groupSubstitutionSpans('We should deploy', 'We should deploy'), []);
    });

    test('ignores case and punctuation when anchoring', () => {
      assert.deepStrictEqual(groupSubstitutionSpans('We deployed it.', 'we DEPLOYED it!'), []);
    });

    test('an entirely different sentence is a single span', () => {
      const spans = groupSubstitutionSpans('good morning', 'bad evening');
      assert.strictEqual(spans.length, 1);
      assert.strictEqual(spans[0].target, 'good morning');
      assert.strictEqual(spans[0].spoken, 'bad evening');
    });

    test('handles empty sides without throwing', () => {
      assert.deepStrictEqual(groupSubstitutionSpans('', ''), []);
      assert.strictEqual(groupSubstitutionSpans('hello world', '')[0].type, 'omission');
      assert.strictEqual(groupSubstitutionSpans('', 'hello world')[0].type, 'insertion');
    });
  });

  describe('diagnoseArticulation spans', () => {
    test('attaches the weakest spoken confidence to each span', () => {
      const d = diagnoseArticulation(
        'We should prioritize this',
        'We should pre-write the sign',
        [
          { word: 'We', probability: 0.99 },
          { word: 'should', probability: 0.99 },
          { word: 'pre-write', probability: 0.97 },
          { word: 'the', probability: 0.99 },
          { word: 'sign', probability: 0.93 }
        ]
      );

      assert.ok(Array.isArray(d.spans));
      const sub = d.spans.find((s) => s.type === 'substitution');
      assert.ok(sub, 'expected a substitution span');
      assert.strictEqual(sub.confidence, 0.93, 'span confidence is its weakest word');
    });

    test('span confidence is null when there is no acoustic data', () => {
      const d = diagnoseArticulation('We deploy this', 'We destroy this', []);
      assert.strictEqual(d.spans[0].confidence, null);
    });

    test('a clean read has no spans', () => {
      const d = diagnoseArticulation('We deploy', 'We deploy', [
        { word: 'We', probability: 0.99 },
        { word: 'deploy', probability: 0.98 }
      ]);
      assert.deepStrictEqual(d.spans, []);
    });
  });

  describe('scoreDictation', () => {
    test('a perfect transcription scores 100 and is correct', () => {
      const r = scoreDictation('I would have avoided it.', 'I would have avoided it.');

      assert.strictEqual(r.score, 100);
      assert.strictEqual(r.isCorrect, true);
      assert.deepStrictEqual(r.spans, []);
    });

    test('ignores case and punctuation the way a dictation check should', () => {
      const r = scoreDictation('I would have avoided it.', 'i would have avoided it');
      assert.strictEqual(r.score, 100);
    });

    test('scores partial hearing from the measured word overlap', () => {
      const r = scoreDictation('I would have avoided the bug', 'I will have a boy avoided the bug');

      assert.ok(r.score > 0 && r.score < 100, `unexpected score ${r.score}`);
      assert.strictEqual(r.isCorrect, false);
      assert.ok(r.spans.length > 0, 'the mishearing must surface as a span');
    });

    test('reports what was heard in place of what was said', () => {
      const r = scoreDictation('I would have avoided it', 'I will have a boy avoided it');

      // "have" is present on both sides, so the alignment anchors there and
      // splits the error into a substitution plus an insertion — a more precise
      // account than lumping the whole stretch together.
      const substitution = r.spans.find((sp) => sp.type === 'substitution');
      assert.strictEqual(substitution.target, 'would');
      assert.strictEqual(substitution.spoken, 'will');

      const insertion = r.spans.find((sp) => sp.type === 'insertion');
      assert.strictEqual(insertion.spoken, 'a boy');
    });

    test('accepts a near-perfect transcription at the 85% threshold', () => {
      // Ten words, one missed: 90% is a pass for dictation.
      const r = scoreDictation('one two three four five six seven eight nine ten',
        'one two three four five six seven eight nine');
      assert.strictEqual(r.score, 90);
      assert.strictEqual(r.isCorrect, true);
    });

    test('rejects a transcription below the threshold', () => {
      const r = scoreDictation('one two three four five', 'one two nine ten eleven');
      assert.strictEqual(r.isCorrect, false);
    });

    test('an empty transcription scores zero without throwing', () => {
      const r = scoreDictation('I would have avoided it', '');
      assert.strictEqual(r.score, 0);
      assert.strictEqual(r.isCorrect, false);
    });

    test('an empty target does not claim a perfect score', () => {
      const r = scoreDictation('', 'anything');
      assert.strictEqual(r.isCorrect, false);
    });
  });
});
