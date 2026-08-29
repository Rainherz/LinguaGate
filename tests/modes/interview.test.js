import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { setProvider, resetProvider } from '../../src/services/ai/port.js';
import { createFakeProvider } from '../../src/services/ai/adapters/fake.js';
import { setInputSource, resetInputSource } from '../../src/ui/prompt.js';
import { createScriptedInput } from '../../src/ui/scripted-input.js';
import { setRecorderDriver, resetRecorderCache } from '../../src/services/recorder.js';
import { resetTranscriberCache } from '../../src/services/transcriber.js';
import { SessionStats } from '../../src/services/stats.js';
import { ROLE_PRESETS, SENIORITY_LEVELS, COMPANY_PROFILES } from '../../src/services/interview.js';
import { runTechInterview } from '../../src/modes/interview.js';

const QUESTIONS = {
  questions: [1, 2, 3, 4].map((n) => ({
    round: n,
    title: `Round ${n}`,
    question: `Question number ${n}?`,
    rubric: 'Depth and clarity.',
    samplePoints: ['idempotency', 'backpressure']
  }))
};

const REPORT = {
  technicalDepthScore: 80,
  spokenEnglishScore: 75,
  starStructureScore: 78,
  overallAverage: 78,
  executiveSummary: 'Solid.',
  keyStrengths: ['Terminology'],
  redFlagsOrWeaknesses: ['STAR structure'],
  recommendedDrill: 'Time your incident answers.'
};

/** Profile wizard: role, stack, seniority, company, then the start confirm. */
const profileAnswers = () => [
  ROLE_PRESETS[0],
  '',                        // accept the default stack
  SENIORITY_LEVELS[0].title,
  COMPANY_PROFILES[0].title,
  true                       // "Start the interview now?"
];

describe('Tech Interview mode', () => {
  let tempDir;
  let silenced;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'interview-mode-'));
    process.env.LINGUAGATE_DATA_DIR = tempDir;
    writeFileSync(
      join(tempDir, 'config.json'),
      JSON.stringify({ audioPlayer: 'muted', ttsEngine: 'off', sttEngine: 'off' })
    );
    // No microphone: drives the typed path, which is deterministic anywhere.
    setRecorderDriver(null);
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
    resetRecorderCache();
    resetTranscriberCache();
    delete process.env.LINGUAGATE_DATA_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('backing out of the role menu runs no interview', async () => {
    const fake = createFakeProvider({ json: QUESTIONS });
    setProvider(fake);
    setInputSource(createScriptedInput(['BACK']));

    await runTechInterview(new SessionStats('interview'));
    assert.strictEqual(fake.calls.length, 0);
  });

  test('runs four rounds and asks the committee once', async () => {
    const fake = createFakeProvider({
      sequence: [JSON.stringify(QUESTIONS), JSON.stringify(REPORT)]
    });
    setProvider(fake);
    setInputSource(createScriptedInput([
      ...profileAnswers(),
      'I designed an idempotent ingestion pipeline.', true,
      'I would shard by tenant and cache reads.', true,
      'I would check the dashboards and roll back.', true,
      'I disagreed, gathered data, and we realigned.',
      true
    ]));

    await runTechInterview(new SessionStats('interview'));

    // One call for the questions, one for the hiring report.
    assert.strictEqual(fake.calls.length, 2);
    assert.match(fake.calls[1].prompt, /Round 1/);
    assert.match(fake.calls[1].prompt, /Round 4/);
  });

  /**
   * Regression guard for 6a8a6e7: with no transcript, the committee must be
   * told the answers were typed so it stops reporting a spoken-English band
   * for text the candidate never said out loud.
   */
  test('a typed answer is marked as not-speech in the committee prompt', async () => {
    const fake = createFakeProvider({
      sequence: [JSON.stringify(QUESTIONS), JSON.stringify(REPORT)]
    });
    setProvider(fake);
    setInputSource(createScriptedInput([
      ...profileAnswers(),
      'answer one', true,
      'answer two', true,
      'answer three', true,
      'answer four',
      true
    ]));

    await runTechInterview(new SessionStats('interview'));

    const committeePrompt = fake.calls[1].prompt;
    assert.match(committeePrompt, /TYPED BY THE CANDIDATE/);
    assert.match(committeePrompt, /do not score pronunciation, fluency or pace/i);
    assert.match(committeePrompt, /not a speaking rate/i);
  });

  test('the profile the candidate chose reaches the question generator', async () => {
    const fake = createFakeProvider({
      sequence: [JSON.stringify(QUESTIONS), JSON.stringify(REPORT)]
    });
    setProvider(fake);
    setInputSource(createScriptedInput([
      ...profileAnswers(),
      'a', true, 'b', true, 'c', true, 'd',
      true
    ]));

    await runTechInterview(new SessionStats('interview'));

    const generatorPrompt = fake.calls[0].prompt;
    assert.match(generatorPrompt, /Node\.js/, 'the default stack should be forwarded');
    assert.match(generatorPrompt, new RegExp(SENIORITY_LEVELS[0].title.replace(/[^\w\s]/g, '.')));
  });

  test('declining round two ends the interview early', async () => {
    const fake = createFakeProvider({
      sequence: [JSON.stringify(QUESTIONS), JSON.stringify(REPORT)]
    });
    setProvider(fake);
    setInputSource(createScriptedInput([...profileAnswers(), 'only answer', false, true]));

    await runTechInterview(new SessionStats('interview'));

    const committeePrompt = fake.calls[1].prompt;
    assert.match(committeePrompt, /Round 1/);
    assert.doesNotMatch(committeePrompt, /Round 2/);
  });
});
