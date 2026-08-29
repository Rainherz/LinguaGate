import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { setProvider, resetProvider } from '../../src/services/ai/port.js';
import { createFakeProvider } from '../../src/services/ai/adapters/fake.js';
import { setInputSource, resetInputSource } from '../../src/ui/prompt.js';
import { createScriptedInput } from '../../src/ui/scripted-input.js';
import { SessionStats } from '../../src/services/stats.js';
import {
  recordError,
  recordPronunciationError,
  loadHistory,
  pronunciationCardKey
} from '../../src/services/history.js';
import { resetTranscriberCache } from '../../src/services/transcriber.js';
import { runReview } from '../../src/modes/review.js';

const EXERCISE = {
  ruleRecap: 'Third-person singular takes -s.',
  tip: 'he/she/it → verb + s',
  exercise: 'Fix: "She go home."',
  hint: 'Look at the verb.',
  answer: 'She goes home.',
  explanation: 'Present simple, third person.'
};

describe('SRS Review mode', () => {
  let tempDir;
  let silenced;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'review-mode-'));
    process.env.LINGUAGATE_DATA_DIR = tempDir;
    // sttEngine 'off' keeps the pronunciation flow on its deterministic
    // self-report path. Left on 'auto' the result would depend on whether the
    // machine running the suite happens to have ffmpeg and whisper installed.
    writeFileSync(
      join(tempDir, 'config.json'),
      JSON.stringify({ audioPlayer: 'muted', sttEngine: 'off' })
    );
    resetTranscriberCache();

    silenced = [console.log, console.error, console.clear];
    console.log = () => {};
    console.error = () => {};
    console.clear = () => {};
  });

  afterEach(() => {
    [console.log, console.error, console.clear] = silenced;
    resetProvider();
    resetInputSource();
    resetTranscriberCache();
    delete process.env.LINGUAGATE_DATA_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('an empty queue exits without prompting for anything', async () => {
    const scripted = createScriptedInput([]);
    setInputSource(scripted);

    await runReview(new SessionStats('review'));
    assert.strictEqual(scripted.calls.length, 0);
  });

  test('a correct grammar answer advances the SM-2 interval', async () => {
    recordError('third_person_s', 'she go', 'she goes');
    setProvider(createFakeProvider({ json: EXERCISE }));
    setInputSource(createScriptedInput(['', 'She goes home.', '']));

    const stats = new SessionStats('review');
    await runReview(stats);

    const card = loadHistory().srsCards['third_person_s'];
    assert.strictEqual(card.repetition, 1);
    assert.strictEqual(stats.getSummary().correct, 1);
  });

  test('a wrong grammar answer resets the interval to one day', async () => {
    recordError('third_person_s', 'she go', 'she goes');
    setProvider(createFakeProvider({ json: EXERCISE }));
    setInputSource(createScriptedInput(['', 'She go home.', '']));

    const stats = new SessionStats('review');
    await runReview(stats);

    const card = loadHistory().srsCards['third_person_s'];
    assert.strictEqual(card.repetition, 0);
    assert.strictEqual(card.interval, 1);
    assert.strictEqual(stats.getSummary().incorrect, 1);
  });

  /**
   * A pronunciation card must be routed to the speaking flow rather than the
   * AI-generated grammar exercise. With STT disabled above, that flow falls
   * back to a typed self-report, which is what these tests drive.
   */
  test('a pronunciation card is routed to the speaking flow, not the grammar one', async () => {
    recordPronunciationError({ target: 'prioritize', spoken: 'pre-write the sign', confidence: 0.97 });
    const fake = createFakeProvider({ json: EXERCISE });
    setProvider(fake);
    // start review, skip playback, self-reported answer, post-review audio menu
    setInputSource(createScriptedInput(['', '', 'prioritize', '']));

    const stats = new SessionStats('review');
    await runReview(stats);

    // The grammar path would have called the AI for an exercise; the speaking
    // path never does.
    assert.strictEqual(fake.calls.length, 0, 'pronunciation cards must not generate an AI exercise');
    assert.strictEqual(stats.getSummary().correct, 1);
  });

  test('saying the phrase correctly advances the pronunciation card', async () => {
    recordPronunciationError({ target: 'prioritize', spoken: 'pre-write the sign', confidence: 0.97 });
    setInputSource(createScriptedInput(['', '', 'prioritize', '']));

    await runReview(new SessionStats('review'));

    const card = loadHistory().srsCards[pronunciationCardKey('prioritize')];
    assert.strictEqual(card.repetition, 1, 'the card must advance on a clean match');
  });

  test('missing the phrase again resets the pronunciation card', async () => {
    recordPronunciationError({ target: 'prioritize', spoken: 'pre-write the sign', confidence: 0.97 });
    setInputSource(createScriptedInput(['', '', 'priority ties', '']));

    const stats = new SessionStats('review');
    await runReview(stats);

    const card = loadHistory().srsCards[pronunciationCardKey('prioritize')];
    assert.strictEqual(card.repetition, 0);
    assert.strictEqual(card.interval, 1);
    assert.strictEqual(stats.getSummary().incorrect, 1);
  });

  test('a provider failure on one card does not abort the whole review', async () => {
    recordError('third_person_s', 'she go', 'she goes');
    setProvider(createFakeProvider({ error: new Error('provider down') }));
    setInputSource(createScriptedInput(['']));

    await assert.doesNotReject(() => runReview(new SessionStats('review')));
  });
});
