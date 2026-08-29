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
import { loadHistory } from '../../src/services/history.js';
import { resetTranscriberCache } from '../../src/services/transcriber.js';
import { setRecorderDriver, resetRecorderCache } from '../../src/services/recorder.js';
import { PRACTICE_SENTENCES, runSpeakingLab } from '../../src/modes/speaking.js';

const AI_VERDICT = {
  isCorrect: false,
  ieltsBand: 'Band 6.0 (Competent)',
  wordStressScore: 60,
  connectedSpeechScore: 55,
  feedback: 'Cuidar las consonantes finales.',
  criticalFlaws: ['Ensordecimiento de /g/ final.'],
  phoneticTips: ['Vibrá las cuerdas al cerrar con /g/.'],
  suggestions: ['bug']
};

describe('Speaking Lab mode', () => {
  let tempDir;
  let silenced;
  let realRandom;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'speaking-mode-'));
    process.env.LINGUAGATE_DATA_DIR = tempDir;
    // No recorder and no STT: the lab runs its self-reported path, which is the
    // only branch that is deterministic on any machine.
    writeFileSync(
      join(tempDir, 'config.json'),
      JSON.stringify({ audioPlayer: 'muted', ttsEngine: 'off', sttEngine: 'off' })
    );
    resetTranscriberCache();
    // Force the no-microphone branch: otherwise the flow depends on whether the
    // machine running the suite happens to have ffmpeg installed.
    setRecorderDriver(null);

    // The practice pool is shuffled with `sort(() => Math.random() - 0.5)`;
    // pinning random to 0.5 makes the comparator return 0, so the pool keeps
    // its declared order and the test knows which sentence comes up.
    realRandom = Math.random;
    Math.random = () => 0.5;

    silenced = [console.log, console.error, console.clear];
    console.log = () => {};
    console.error = () => {};
    console.clear = () => {};
  });

  afterEach(() => {
    [console.log, console.error, console.clear] = silenced;
    Math.random = realRandom;
    resetProvider();
    resetInputSource();
    resetTranscriberCache();
    resetRecorderCache();
    delete process.env.LINGUAGATE_DATA_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('the practice set is well formed', () => {
    assert.ok(PRACTICE_SENTENCES.length >= 4);
    for (const item of PRACTICE_SENTENCES) {
      assert.ok(item.sentence && item.phonetics && item.stressTip);
      assert.ok(Array.isArray(item.traps) && item.traps.length > 0);
    }
  });

  test('saying the target sentence back scores the learner', async () => {
    const target = PRACTICE_SENTENCES[0].sentence;
    setProvider(createFakeProvider({ json: { ...AI_VERDICT, isCorrect: true, wordStressScore: 92 } }));
    // audio menu, spoken text, post-review menu, next challenge?
    setInputSource(createScriptedInput(['PRONOUNCE', '', target, false, 'BACK']));

    const stats = new SessionStats('speaking');
    await runSpeakingLab(stats);

    assert.strictEqual(stats.getSummary().correct, 1);
    assert.deepStrictEqual(Object.keys(loadHistory().srsCards), []);
  });

  /**
   * Regression guard for ff97b86: failures used to be filed under the single
   * constant 'Speaking Accuracy', so every phrase a learner ever fumbled shared
   * one review schedule.
   */
  test('each substitution span becomes its own pronunciation card', async () => {
    const target = PRACTICE_SENTENCES[0].sentence;
    const mangled = target.split(' ').map((w, i) => (i === 1 ? 'zzz' : w)).join(' ');

    setProvider(createFakeProvider({ json: AI_VERDICT }));
    setInputSource(createScriptedInput(['PRONOUNCE', '', mangled, false, 'BACK']));

    const stats = new SessionStats('speaking');
    await runSpeakingLab(stats);

    const cards = Object.values(loadHistory().srsCards);
    assert.ok(cards.length > 0, 'a failed attempt must file at least one card');
    assert.ok(cards.every((c) => c.kind === 'pronunciation'), 'cards must be pronunciation cards');
    assert.ok(!loadHistory().srsCards['Speaking Accuracy'], 'the constant bucket must be gone');
    assert.strictEqual(stats.getSummary().incorrect, 1);
  });

  test('an empty answer skips the round without scoring it', async () => {
    setProvider(createFakeProvider({ json: AI_VERDICT }));
    // A blank answer `continue`s to the next sentence rather than ending the
    // round, so every item in the pool asks its audio menu and answer prompt.
    const script = ['PRONOUNCE'];
    for (let i = 0; i < PRACTICE_SENTENCES.length; i += 1) script.push('', '');
    script.push('BACK');
    setInputSource(createScriptedInput(script));

    const stats = new SessionStats('speaking');
    await runSpeakingLab(stats);

    const summary = stats.getSummary();
    assert.strictEqual(summary.correct + summary.incorrect, 0);
    assert.deepStrictEqual(Object.keys(loadHistory().srsCards), []);
  });
});
