import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { exportToAnkiCsv, exportToMarkdownNotebook } from '../src/services/exporter.js';

describe('Exporter Service (Anki CSV & Markdown Notebook)', () => {
  test('exportToAnkiCsv generates valid CSV file with Anki metadata headers', () => {
    const result = exportToAnkiCsv();
    assert.ok(result.filePath);
    assert.ok(existsSync(result.filePath));

    const content = readFileSync(result.filePath, 'utf-8');
    assert.ok(content.includes('#separator:Comma'));
    assert.ok(content.includes('#html:true'));
    assert.ok(content.includes('"Front","Back","Tags"'));
  });

  test('exportToMarkdownNotebook generates valid markdown reference guide', () => {
    const result = exportToMarkdownNotebook();
    assert.ok(result.filePath);
    assert.ok(existsSync(result.filePath));

    const content = readFileSync(result.filePath, 'utf-8');
    assert.ok(content.includes('# 📖 LinguaGate Personal Study Notebook'));
    assert.ok(content.includes('## ⚡ Irregular Verbs Quick Reference Guide'));
  });
});
