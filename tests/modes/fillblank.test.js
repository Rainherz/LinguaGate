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
import { runFillBlank } from '../../src/modes/fillblank.js';

const EXERCISE = {
  sentence: 'It depends ___ the weather.',
  answer: 'on',
  hint: 'preposition after "depend"',
  explanation: '"Depend" always takes "on".'
};

describe('Fill in the Blank mode', () => {
  let tempDir;
  let silenced;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'fillblank-mode-'));
    process.env.LINGUAGATE_DATA_DIR = tempDir;
    // Muting audio keeps promptAudioFollowup from reaching the network for TTS.
    writeFileSync(join(tempDir, 'config.json'), JSON.stringify({ audioPlayer: 'muted' }));

    silenced = [console.log, console.error, console.clear];
    console.log = () => {};
    console.error = () => {};
    console.clear = () => {};
  });

  afterEach(() => {
    [console.log, console.error, console.clear] = silenced;
    resetProvider();
    resetInputSource();
    delete process.env.LINGUAGATE_DATA_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('a correct answer scores the learner and files no mistake', async () => {
    setProvider(createFakeProvider({ json: EXERCISE }));
    setInputSource(createScriptedInput(['on', false]));

    const stats = new SessionStats('fillblank');
    await runFillBlank(stats, 'beginner');

    const summary = stats.getSummary();
    assert.strictEqual(summary.correct, 1);
    assert.strictEqual(summary.incorrect, 0);
    assert.deepStrictEqual(Object.keys(loadHistory().srsCards), []);
  });

  test('a wrong answer files an SRS card under the practice rule', async () => {
    setProvider(createFakeProvider({ json: EXERCISE }));
    setInputSource(createScriptedInput(['in', false]));

    const stats = new SessionStats('fillblank');
    await runFillBlank(stats, 'beginner');

    const summary = stats.getSummary();
    assert.strictEqual(summary.correct, 0);
    assert.strictEqual(summary.incorrect, 1);

    const cards = loadHistory().srsCards;
    assert.ok(cards['Fill-in-the-blank Practice'], `expected a card, got ${Object.keys(cards)}`);
    assert.strictEqual(cards['Fill-in-the-blank Practice'].interval, 1);
  });

  test('the answer check ignores case and padding', async () => {
    setProvider(createFakeProvider({ json: EXERCISE }));
    setInputSource(createScriptedInput(['  ON  ', false]));

    const stats = new SessionStats('fillblank');
    await runFillBlank(stats, 'beginner');

    assert.strictEqual(stats.getSummary().correct, 1);
  });

  test('/quit leaves immediately without asking to continue', async () => {
    setProvider(createFakeProvider({ json: EXERCISE }));
    const scripted = createScriptedInput(['/quit']);
    setInputSource(scripted);

    await runFillBlank(new SessionStats('fillblank'), 'beginner');

    // Only the answer prompt ran; no "Next exercise?" confirm followed.
    assert.deepStrictEqual(scripted.calls.map((c) => c.kind), ['input']);
  });

  test('loops for as many exercises as the learner accepts', async () => {
    setProvider(createFakeProvider({ json: EXERCISE }));
    setInputSource(createScriptedInput(['on', true, 'on', true, 'in', false]));

    const stats = new SessionStats('fillblank');
    await runFillBlank(stats, 'beginner');

    const summary = stats.getSummary();
    assert.strictEqual(summary.correct, 2);
    assert.strictEqual(summary.incorrect, 1);
  });

  test('a provider failure ends the mode instead of crashing the session', async () => {
    setProvider(createFakeProvider({ error: new Error('provider down') }));
    setInputSource(createScriptedInput([]));

    const stats = new SessionStats('fillblank');
    await assert.doesNotReject(() => runFillBlank(stats, 'beginner'));
    assert.strictEqual(stats.getSummary().correct + stats.getSummary().incorrect, 0);
  });

  test('sends the requested difficulty to the provider', async () => {
    const fake = createFakeProvider({ json: EXERCISE });
    setProvider(fake);
    setInputSource(createScriptedInput(['on', false]));

    await runFillBlank(new SessionStats('fillblank'), 'advanced');

    assert.match(fake.calls[0].prompt, /advanced/);
  });
});
