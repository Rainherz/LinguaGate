import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import {
  loadVocabulary,
  saveWordOfDay,
  generateVocabQuestion,
  recordWordQuizResult,
  SEED_VOCABULARY
} from '../src/services/vocabulary.js';

describe('Vocabulary Vault & Quiz Service', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'vocab-test-'));
    process.env.LINGUAGATE_DATA_DIR = tempDir;
  });

  afterEach(() => {
    delete process.env.LINGUAGATE_DATA_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('loadVocabulary initializes with seed vocabulary', () => {
    const vocab = loadVocabulary();
    assert.ok(Array.isArray(vocab.words));
    assert.strictEqual(vocab.words.length, SEED_VOCABULARY.length);
    assert.ok(vocab.words[0].word);
    assert.ok(vocab.words[0].definition);
  });

  test('saveWordOfDay prepends new word without adding duplicates', () => {
    const newWord = {
      word: 'ephemeral',
      partOfSpeech: 'adjective',
      definition: 'Lasting for a very short time.',
      example: 'Ephemeral storage disappears upon container termination.'
    };

    const saved = saveWordOfDay(newWord);
    assert.strictEqual(saved.word, 'ephemeral');

    const loaded = loadVocabulary();
    assert.strictEqual(loaded.words[0].word, 'ephemeral');

    // Attempt adding duplicate
    const duplicate = saveWordOfDay(newWord);
    assert.strictEqual(duplicate.word, 'ephemeral');
    assert.strictEqual(loadVocabulary().words.length, loaded.words.length);
  });

  test('generateVocabQuestion produces question with 4 choices including correct one', () => {
    const vocab = loadVocabulary();
    const target = vocab.words[0];
    const quiz = generateVocabQuestion(target, vocab.words);

    assert.ok(quiz.question.includes(target.word));
    assert.strictEqual(quiz.choices.length, 4);

    const correctChoice = quiz.choices.find((c) => c.isCorrect);
    assert.ok(correctChoice);
    assert.strictEqual(correctChoice.name, target.definition);
  });

  test('recordWordQuizResult increments timesReviewed and marks mastered after 3 reviews', () => {
    const vocab = loadVocabulary();
    const word = vocab.words[0].word;

    recordWordQuizResult(word, true);
    recordWordQuizResult(word, true);
    recordWordQuizResult(word, true);

    const updated = loadVocabulary();
    const item = updated.words.find((w) => w.word === word);
    assert.strictEqual(item.timesReviewed, 3);
    assert.strictEqual(item.mastered, true);
  });
});
