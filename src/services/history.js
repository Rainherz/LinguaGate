import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

const DEFAULT = { errors: [], sessions: [], streak: 0, bestStreak: 0 };

export function loadHistory() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(HISTORY_FILE)) {
    writeFileSync(HISTORY_FILE, JSON.stringify(DEFAULT, null, 2));
    return structuredClone(DEFAULT);
  }
  return JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
}

export function saveHistory(data) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
}

export function recordError(errorType, original, corrected) {
  const data = loadHistory();
  data.errors.push({ type: errorType, original, corrected, timestamp: new Date().toISOString() });
  saveHistory(data);
}

export function recordSession(stats) {
  const data = loadHistory();
  data.sessions.push({ ...stats, date: new Date().toISOString() });
  saveHistory(data);
}

export function getTopErrors(n = 3) {
  const { errors } = loadHistory();
  const counts = {};
  for (const e of errors) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([type, count]) => ({ type, count }));
}

export function updateStreak(correct) {
  const data = loadHistory();
  if (correct) {
    data.streak += 1;
    if (data.streak > data.bestStreak) data.bestStreak = data.streak;
  } else {
    data.streak = 0;
  }
  saveHistory(data);
  return data.streak;
}
