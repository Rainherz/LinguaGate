import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLLOCATIONS_FILE = join(__dirname, '../data/collocations.json');

let cachedCollocations = null;

/**
 * Loads collocations database with fallback.
 * @returns {Array<any>}
 */
export function loadCollocations() {
  if (cachedCollocations) return cachedCollocations;
  try {
    cachedCollocations = JSON.parse(readFileSync(COLLOCATIONS_FILE, 'utf-8'));
  } catch {
    cachedCollocations = [];
  }
  return cachedCollocations;
}

/**
 * Returns collocations filtered by category.
 * @param {'all' | 'verb-preposition' | 'adjective-preposition' | 'make-vs-do' | 'verb-collocation'} category
 * @returns {Array<any>}
 */
export function getCollocationsByCategory(category = 'all') {
  const all = loadCollocations();
  if (category === 'all') return all;
  return all.filter((c) => c.type === category);
}

/**
 * Returns a random collocation.
 * @param {'all' | 'verb-preposition' | 'adjective-preposition' | 'make-vs-do' | 'verb-collocation'} [category='all']
 * @returns {any}
 */
export function getRandomCollocation(category = 'all') {
  const list = getCollocationsByCategory(category);
  if (list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Evaluates answer case-insensitively with trim.
 * @param {string} expected
 * @param {string} actual
 * @returns {boolean}
 */
export function evaluateCollocationAnswer(expected, actual) {
  const cleanActual = (actual || '').trim().toLowerCase();
  const validExpected = (expected || '')
    .split('/')
    .map((e) => e.trim().toLowerCase());
  return validExpected.includes(cleanActual);
}
