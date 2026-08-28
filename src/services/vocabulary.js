import { join } from 'node:path';
import { readJson, writeJsonAtomic, getDataDir } from './storage.js';

function getVocabFilePath() {
  return join(getDataDir(), 'vocabulary.json');
}

/**
 * @typedef {Object} VocabItem
 * @property {string} word
 * @property {string} partOfSpeech
 * @property {string} definition
 * @property {string} example
 * @property {string} dateAdded
 * @property {number} timesReviewed
 * @property {boolean} mastered
 */

export const SEED_VOCABULARY = [
  {
    word: 'resilient',
    partOfSpeech: 'adjective',
    definition: 'Able to withstand or recover quickly from difficult conditions.',
    example: 'Distributed microservices must be resilient against network failures.'
  },
  {
    word: 'ubiquitous',
    partOfSpeech: 'adjective',
    definition: 'Present, appearing, or found everywhere.',
    example: 'Smartphones and cloud APIs have become ubiquitous in modern society.'
  },
  {
    word: 'pragmatic',
    partOfSpeech: 'adjective',
    definition: 'Dealing with things sensibly and realistically based on practical considerations.',
    example: 'A senior architect takes a pragmatic approach to technical debt.'
  },
  {
    word: 'meticulous',
    partOfSpeech: 'adjective',
    definition: 'Showing great attention to detail; very careful and precise.',
    example: 'She conducted a meticulous code review before approving the merge.'
  },
  {
    word: 'mitigate',
    partOfSpeech: 'verb',
    definition: 'Make less severe, serious, or painful.',
    example: 'Writing automated unit tests helps mitigate regression bugs.'
  },
  {
    word: 'succinct',
    partOfSpeech: 'adjective',
    definition: 'Briefly and clearly expressed.',
    example: 'Write succinct commit messages that explain the rationale clearly.'
  },
  {
    word: 'scrutinize',
    partOfSpeech: 'verb',
    definition: 'Examine or inspect closely and thoroughly.',
    example: 'Security teams scrutinize third-party dependencies for vulnerabilities.'
  },
  {
    word: 'feasible',
    partOfSpeech: 'adjective',
    definition: 'Possible to do easily or conveniently.',
    example: 'Migrating the monolithic database in one weekend is simply not feasible.'
  },
  {
    word: 'discrepancy',
    partOfSpeech: 'noun',
    definition: 'A lack of compatibility or similarity between two or more facts.',
    example: 'There was a noticeable discrepancy between the staging and production logs.'
  },
  {
    word: 'concur',
    partOfSpeech: 'verb',
    definition: 'Be of the same opinion; agree.',
    example: 'All staff engineers concur that we should adopt TypeScript.'
  },
  {
    word: 'seamless',
    partOfSpeech: 'adjective',
    definition: 'Smooth and continuous, with no apparent gaps or interruptions.',
    example: 'The cloud migration provided a seamless user experience.'
  },
  {
    word: 'tangible',
    partOfSpeech: 'adjective',
    definition: 'Perceptible by touch; clear and definite; real.',
    example: 'The performance optimizations yielded tangible reductions in latency.'
  }
];

/**
 * Loads vocabulary bank from storage with default seed bank.
 * @returns {{ words: Array<VocabItem> }}
 */
export function loadVocabulary() {
  const defaultData = {
    words: SEED_VOCABULARY.map((v) => ({
      ...v,
      dateAdded: new Date().toISOString(),
      timesReviewed: 0,
      mastered: false
    }))
  };

  const data = readJson(getVocabFilePath(), defaultData);
  if (!Array.isArray(data.words)) data.words = defaultData.words;
  return data;
}

/**
 * Saves vocabulary bank atomically.
 * @param {{ words: Array<VocabItem> }} data
 */
export function saveVocabulary(data) {
  writeJsonAtomic(getVocabFilePath(), data);
}

/**
 * Saves a Word of the Day to the vocabulary bank if not already present.
 * @param {{ word: string, partOfSpeech?: string, definition: string, example: string }} wod
 * @returns {VocabItem}
 */
export function saveWordOfDay(wod) {
  if (!wod || !wod.word) return null;
  const vocab = loadVocabulary();
  const cleanWord = wod.word.trim().toLowerCase();

  const existingIndex = vocab.words.findIndex((w) => w.word.toLowerCase() === cleanWord);
  if (existingIndex >= 0) {
    return vocab.words[existingIndex];
  }

  const newItem = {
    word: wod.word.trim(),
    partOfSpeech: (wod.partOfSpeech || 'noun').trim(),
    definition: (wod.definition || '').trim(),
    example: (wod.example || '').trim(),
    dateAdded: new Date().toISOString(),
    timesReviewed: 0,
    mastered: false
  };

  vocab.words.unshift(newItem);
  saveVocabulary(vocab);
  return newItem;
}

/**
 * Generates a quiz question for vocabulary.
 * @param {VocabItem} targetWord
 * @param {Array<VocabItem>} allWords
 * @returns {{ target: VocabItem, question: string, choices: Array<{ name: string, isCorrect: boolean }> }}
 */
export function generateVocabQuestion(targetWord, allWords) {
  const distractors = allWords
    .filter((w) => w.word.toLowerCase() !== targetWord.word.toLowerCase())
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const choices = [
    { name: targetWord.definition, isCorrect: true },
    ...distractors.map((d) => ({ name: d.definition, isCorrect: false }))
  ].sort(() => Math.random() - 0.5);

  return {
    target: targetWord,
    question: `What is the definition of "${targetWord.word}" (${targetWord.partOfSpeech})?`,
    choices
  };
}

/**
 * Updates review statistics for a word.
 * @param {string} word
 * @param {boolean} wasCorrect
 */
export function recordWordQuizResult(word, wasCorrect) {
  const vocab = loadVocabulary();
  const item = vocab.words.find((w) => w.word.toLowerCase() === word.toLowerCase());
  if (!item) return;

  item.timesReviewed = (item.timesReviewed || 0) + 1;
  if (wasCorrect && item.timesReviewed >= 3) {
    item.mastered = true;
  }
  saveVocabulary(vocab);
}
