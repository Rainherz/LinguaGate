import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { recordError, recordPronunciationError } from '../src/services/history.js';
import { exportToAnkiCsv, exportToMarkdownNotebook } from '../src/services/exporter.js';

describe('Exporter card rendering', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'exporter-'));
    process.env.LINGUAGATE_DATA_DIR = tempDir;
  });

  afterEach(() => {
    delete process.env.LINGUAGATE_DATA_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('a grammar card exports with both sides filled', () => {
    recordError('Past Simple with Irregular Verbs', 'I go yesterday', 'I went yesterday');
    const csv = readFileSync(exportToAnkiCsv().filePath, 'utf-8');

    assert.match(csv, /Past Simple with Irregular Verbs/);
    assert.match(csv, /I went yesterday/);
  });

  /**
   * Pronunciation cards store `target` / `lastSpoken`, not `lastMistake`, so the
   * exporter rendered their back as an empty string — a deck of dead cards.
   */
  test('a pronunciation card exports with the target on the back', () => {
    recordPronunciationError({ target: 'prioritize', spoken: 'pre-write the sign', confidence: 0.97 });
    const csv = readFileSync(exportToAnkiCsv().filePath, 'utf-8');

    assert.match(csv, /prioritize/);
    assert.match(csv, /pre-write the sign/, 'the mispronunciation must appear');

    // The deck declares #separator:Comma, so fields are quoted and comma-joined.
    const row = csv.split('\n').find((l) => l.includes('prioritize'));
    const fields = row.split('","');
    const back = (fields[1] ?? '').replace(/<[^>]*>/g, '').trim();

    assert.ok(back.length > 0, `back side was empty: ${row}`);
    assert.match(back, /prioritize/);
  });

  test('the markdown notebook renders pronunciation rows too', () => {
    recordPronunciationError({ target: 'schedule', spoken: 'es-schedule', confidence: 0.71 });
    const md = readFileSync(exportToMarkdownNotebook().filePath, 'utf-8');

    assert.match(md, /schedule/);
    assert.match(md, /es-schedule/);
  });

  test('both card kinds are counted in the export total', () => {
    recordError('Rule A', 'a', 'b');
    recordPronunciationError({ target: 'prioritize', spoken: 'pre-write', confidence: 0.9 });

    assert.ok(exportToAnkiCsv().count >= 2);
  });
});
