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
import { runListening } from '../../src/modes/listening.js';

const PHRASE = {
  phrase: 'I would have avoided the bug.',
  translation: 'Habría evitado el error.',
  phoneticIpa: '/aɪ wʊdəv əˈvɔɪdɪd ðə bʌɡ/',
  listeningTip: 'Watch the weak form of "would have".'
};

const INSIGHT = {
  rule: 'Connected Speech: Weak Forms',
  phoneticInsight: '"would have" se reduce a /wʊdəv/ en habla natural.',
  feedback: 'Buen intento.'
};

describe('Listening mode', () => {
  let tempDir;
  let silenced;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'listening-mode-'));
    process.env.LINGUAGATE_DATA_DIR = tempDir;
    // ttsEngine off keeps playAudio from reaching an engine or the network,
    // while audioPlayer stays detectable so the mode does not bail early.
    writeFileSync(join(tempDir, 'config.json'), JSON.stringify({ ttsEngine: 'off' }));

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

  test('a perfect transcription scores without consulting the model', async () => {
    const fake = createFakeProvider({ sequence: [JSON.stringify(PHRASE)] });
    setProvider(fake);
    setInputSource(createScriptedInput(['beginner', 'I would have avoided the bug.', false]));

    const stats = new SessionStats('listening');
    await runListening(stats);

    assert.strictEqual(stats.getSummary().correct, 1);
    // One call for the phrase; none to grade it — accuracy is measured.
    assert.strictEqual(fake.calls.length, 1);
    assert.deepStrictEqual(Object.keys(loadHistory().srsCards), []);
  });

  /**
   * Regression guard: every mishearing used to be filed under the constant
   * 'Listening / Connected Speech', collapsing them into a single card.
   */
  test('a mishearing files a card keyed by the phonetic phenomenon', async () => {
    setProvider(createFakeProvider({
      sequence: [JSON.stringify(PHRASE), JSON.stringify(INSIGHT)]
    }));
    setInputSource(createScriptedInput(['beginner', 'I will have a boy avoided the bug.', false]));

    const stats = new SessionStats('listening');
    await runListening(stats);

    const cards = Object.keys(loadHistory().srsCards);
    assert.deepStrictEqual(cards, [INSIGHT.rule]);
    assert.ok(!cards.includes('Listening / Connected Speech'));
    assert.strictEqual(stats.getSummary().incorrect, 1);
  });

  test('a near-perfect transcription passes on the measured threshold', async () => {
    const fake = createFakeProvider({ sequence: [JSON.stringify(PHRASE)] });
    setProvider(fake);
    // 6 of 6 content words, punctuation aside — well over the 85% threshold.
    setInputSource(createScriptedInput(['beginner', 'i would have avoided the bug', false]));

    const stats = new SessionStats('listening');
    await runListening(stats);

    assert.strictEqual(stats.getSummary().correct, 1);
  });

  test('backing out of the level menu leaves without generating anything', async () => {
    const fake = createFakeProvider({ json: PHRASE });
    setProvider(fake);
    setInputSource(createScriptedInput(['BACK']));

    await runListening(new SessionStats('listening'));
    assert.strictEqual(fake.calls.length, 0);
  });

  test('a provider failure on the phrase ends the mode cleanly', async () => {
    setProvider(createFakeProvider({ error: new Error('provider down') }));
    setInputSource(createScriptedInput(['beginner']));

    const stats = new SessionStats('listening');
    await assert.doesNotReject(() => runListening(stats));
    assert.strictEqual(stats.getSummary().correct + stats.getSummary().incorrect, 0);
  });
});
