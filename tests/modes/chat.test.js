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
import { runChat } from '../../src/modes/chat.js';

const RULE = 'Past Simple with Irregular Verbs';

/** The same underlying mistake, described differently each time. */
const fail = (explanation) => ({
  isCorrect: false,
  correctedText: 'I went to the store yesterday.',
  explanation,
  corrections: [{ wrong: 'go', correct: 'went', rule: RULE, explanation }]
});

describe('Chat mode', () => {
  let tempDir;
  let silenced;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'chat-mode-'));
    process.env.LINGUAGATE_DATA_DIR = tempDir;
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

  /**
   * Regression guard. Corrections used to be free-text strings passed straight
   * to recordError as the card key, so the same mistake phrased three ways
   * created three cards that never repeated — filling the review queue with
   * orphans and flattening the weak-spots panel to a list of ×1 entries.
   */
  test('the same rule described differently collapses into one card', async () => {
    setProvider(createFakeProvider({
      sequence: [
        JSON.stringify(fail("Replaced 'go' with 'went' for the past adverbial")),
        JSON.stringify(fail("Changed 'go' to 'went' because 'yesterday' is past")),
        JSON.stringify(fail("'go' should be 'went' — past simple with a time marker"))
      ]
    }));
    setInputSource(createScriptedInput([
      'I go to the store yesterday.',
      'I go to the store yesterday.',
      'I go to the store yesterday.',
      '/quit'
    ]));

    await runChat(new SessionStats('chat'));

    const cards = loadHistory().srsCards;
    assert.deepStrictEqual(Object.keys(cards), [RULE]);
    assert.strictEqual(cards[RULE].count, 3, 'repeat mistakes must reinforce one card');
  });

  test('a clean reply files no card and scores the learner', async () => {
    setProvider(createFakeProvider({
      sequence: [
        JSON.stringify({ isCorrect: true, corrections: [], correctedText: '', explanation: '' }),
        'Nice, tell me more.'
      ]
    }));
    setInputSource(createScriptedInput(['I went to the store yesterday.', '/quit']));

    const stats = new SessionStats('chat');
    await runChat(stats);

    assert.deepStrictEqual(Object.keys(loadHistory().srsCards), []);
    assert.strictEqual(stats.getSummary().correct, 1);
  });

  test('/quit exits without calling the provider', async () => {
    const fake = createFakeProvider({ json: {} });
    setProvider(fake);
    setInputSource(createScriptedInput(['/quit']));

    await runChat(new SessionStats('chat'));
    assert.strictEqual(fake.calls.length, 0);
  });
});
