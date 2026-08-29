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
import { runTranslate } from '../../src/modes/translate.js';

const PHRASE = {
  spanish: 'Ella va a la escuela todos los días.',
  english: 'She goes to school every day.',
  hint: 'Watch the third-person -s'
};

const PASS = { isCorrect: true, score: 95, feedback: 'Natural phrasing.', errors: [] };

const FAIL = {
  isCorrect: false,
  score: 50,
  feedback: 'Two grammar issues.',
  errors: [
    {
      wrong: 'go',
      correct: 'goes',
      rule: 'Third-Person Singular Agreement',
      theory: 'Present-tense verbs take -s with he/she/it.',
      example: 'He works from home.'
    },
    {
      wrong: 'every days',
      correct: 'every day',
      rule: "Determiner 'Every' with Singular Nouns",
      theory: "'Every' is followed by a singular countable noun.",
      example: 'Every student passed.'
    }
  ]
};

describe('Translate mode', () => {
  let tempDir;
  let silenced;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'translate-mode-'));
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

  test('an accepted translation scores the learner and files nothing', async () => {
    setProvider(createFakeProvider({ sequence: [JSON.stringify(PHRASE), JSON.stringify(PASS)] }));
    setInputSource(createScriptedInput(['She goes to school every day.', false]));

    const stats = new SessionStats('translate');
    await runTranslate(stats, 'beginner');

    assert.strictEqual(stats.getSummary().correct, 1);
    assert.deepStrictEqual(Object.keys(loadHistory().srsCards), []);
  });

  /**
   * Guards the consumer half of the regression that flattened
   * TRANSLATION_SCHEMA's `errors` to string[]: with structured errors in,
   * `recordError(err.rule, ...)` must produce one card per error.
   *
   * Verified by reintroducing the flattened schema — only
   * tests/tutor-schemas.test.js fails, because the fake provider ignores the
   * schema and returns whatever the test scripts. The declaration is pinned
   * there; the wiring is pinned here. Neither alone covers the bug.
   */
  test('every reported grammar error becomes its own SRS card', async () => {
    setProvider(createFakeProvider({ sequence: [JSON.stringify(PHRASE), JSON.stringify(FAIL)] }));
    setInputSource(createScriptedInput(['She go to school every days.', false]));

    const stats = new SessionStats('translate');
    await runTranslate(stats, 'beginner');

    const cards = loadHistory().srsCards;
    assert.ok(cards['Third-Person Singular Agreement'], `missing card, got ${Object.keys(cards)}`);
    assert.ok(cards["Determiner 'Every' with Singular Nouns"]);
    assert.strictEqual(Object.keys(cards).length, 2);
    assert.strictEqual(stats.getSummary().incorrect, 1);
  });

  test('an evaluation with no errors array still records the miss', async () => {
    const noErrors = { isCorrect: false, score: 40, feedback: 'Off target.', errors: [] };
    setProvider(createFakeProvider({ sequence: [JSON.stringify(PHRASE), JSON.stringify(noErrors)] }));
    setInputSource(createScriptedInput(['Something else entirely.', false]));

    const stats = new SessionStats('translate');
    await runTranslate(stats, 'beginner');

    assert.strictEqual(stats.getSummary().incorrect, 1);
    assert.deepStrictEqual(Object.keys(loadHistory().srsCards), []);
  });

  test('an empty answer skips scoring but keeps the session going', async () => {
    // Only /quit breaks the loop; a blank line just abandons that one exercise.
    setProvider(createFakeProvider({ sequence: [JSON.stringify(PHRASE)] }));
    const scripted = createScriptedInput(['', false]);
    setInputSource(scripted);

    const stats = new SessionStats('translate');
    await runTranslate(stats, 'beginner');

    const summary = stats.getSummary();
    assert.strictEqual(summary.correct + summary.incorrect, 0);
    assert.deepStrictEqual(scripted.calls.map((c) => c.kind), ['input', 'confirm']);
  });

  test('/quit breaks the loop where a blank answer does not', async () => {
    setProvider(createFakeProvider({ sequence: [JSON.stringify(PHRASE)] }));
    const scripted = createScriptedInput(['/quit']);
    setInputSource(scripted);

    await runTranslate(new SessionStats('translate'), 'beginner');
    assert.deepStrictEqual(scripted.calls.map((c) => c.kind), ['input']);
  });

  test('a failed evaluation call does not crash the mode', async () => {
    setProvider(createFakeProvider({ sequence: [JSON.stringify(PHRASE), 'not json at all', 'still not json'] }));
    setInputSource(createScriptedInput(['She goes to school every day.', false]));

    const stats = new SessionStats('translate');
    await assert.doesNotReject(() => runTranslate(stats, 'beginner'));
    assert.strictEqual(stats.getSummary().correct + stats.getSummary().incorrect, 0);
  });

  test('sends the requested difficulty to the provider', async () => {
    const fake = createFakeProvider({ sequence: [JSON.stringify(PHRASE), JSON.stringify(PASS)] });
    setProvider(fake);
    setInputSource(createScriptedInput(['She goes to school every day.', false]));

    await runTranslate(new SessionStats('translate'), 'advanced');
    assert.match(fake.calls[0].prompt, /advanced/);
  });
});
