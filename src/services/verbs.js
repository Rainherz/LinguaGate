import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERBS_FILE = join(__dirname, '../data/irregular_verbs.json');

let cachedVerbs = null;

export function loadVerbs() {
  if (cachedVerbs) return cachedVerbs;
  try {
    cachedVerbs = JSON.parse(readFileSync(VERBS_FILE, 'utf-8'));
  } catch {
    cachedVerbs = [];
  }
  return cachedVerbs;
}

export function getVerbsByLevel(level = 'all') {
  const verbs = loadVerbs();
  if (level === 'all') return verbs;
  return verbs.filter((v) => v.level.toLowerCase() === level.toLowerCase());
}

export function getRandomVerb(level = 'all') {
  const list = getVerbsByLevel(level);
  return list[Math.floor(Math.random() * list.length)];
}

export function evaluateVerbAnswer(expected, actual) {
  const cleanActual = (actual || '').trim().toLowerCase();
  const validExpected = (expected || '')
    .split('/')
    .map((e) => e.trim().toLowerCase());
  return validExpected.includes(cleanActual);
}
