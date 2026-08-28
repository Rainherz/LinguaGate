import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJsonAtomic } from './storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

const DEFAULT = {
  errors: [],
  srsCards: {}, // { [ruleName]: { rule, repetition, interval, nextReviewDate, easeFactor, count } }
  sessions: [],
  streak: 0,
  bestStreak: 0
};

export function loadHistory() {
  const data = readJson(HISTORY_FILE, DEFAULT);
  if (!data.srsCards) data.srsCards = {};
  if (!Array.isArray(data.errors)) data.errors = [];
  if (!Array.isArray(data.sessions)) data.sessions = [];
  return data;
}

export function saveHistory(data) {
  writeJsonAtomic(HISTORY_FILE, data);
}

export function recordError(errorType, original, corrected) {
  if (!errorType) return;
  const data = loadHistory();
  data.errors.push({ type: errorType, original, corrected, timestamp: new Date().toISOString() });

  // Update or insert into SRS cards
  if (!data.srsCards[errorType]) {
    data.srsCards[errorType] = {
      rule: errorType,
      repetition: 0,
      interval: 1, // 1 day
      easeFactor: 2.5,
      count: 1,
      lastMistake: { original, corrected },
      nextReviewDate: new Date().toISOString() // due immediately
    };
  } else {
    const card = data.srsCards[errorType];
    card.count = (card.count || 1) + 1;
    card.repetition = 0;
    card.interval = 1;
    card.lastMistake = { original, corrected };
    card.nextReviewDate = new Date().toISOString(); // reset interval due to error
  }

  saveHistory(data);
}

export function getDueSrsCards() {
  const data = loadHistory();
  const now = new Date().toISOString();
  const cards = Object.values(data.srsCards || {});

  // Cards that are strictly due
  const due = cards.filter((c) => c.nextReviewDate <= now);
  if (due.length > 0) return due;

  // If none strictly due, return most frequent errors
  return cards.sort((a, b) => b.count - a.count).slice(0, 5);
}

export function reviewSrsCard(ruleName, isCorrect) {
  const data = loadHistory();
  const card = data.srsCards?.[ruleName];
  if (!card) return;

  if (isCorrect) {
    card.repetition = (card.repetition || 0) + 1;
    if (card.repetition === 1) {
      card.interval = 1;
    } else if (card.repetition === 2) {
      card.interval = 3;
    } else {
      card.interval = Math.round(card.interval * (card.easeFactor || 2.5));
    }
  } else {
    card.repetition = 0;
    card.interval = 1;
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + card.interval);
  card.nextReviewDate = nextDate.toISOString();

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
