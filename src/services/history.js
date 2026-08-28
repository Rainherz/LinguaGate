import { join } from 'node:path';
import { readJson, writeJsonAtomic, getDataDir } from './storage.js';
import { recordDailyActivity } from './activity.js';

function getHistoryFilePath() {
  return join(getDataDir(), 'history.json');
}

const DEFAULT = {
  errors: [],
  srsCards: {}, // { [key]: { rule, kind, repetition, interval, nextReviewDate, easeFactor, count } }
  sessions: [],
  streak: 0,
  bestStreak: 0,
  dailyActivity: {}
};

export function loadHistory() {
  const data = readJson(getHistoryFilePath(), DEFAULT);
  if (!data.srsCards) data.srsCards = {};
  if (!Array.isArray(data.errors)) data.errors = [];
  if (!Array.isArray(data.sessions)) data.sessions = [];
  if (!data.dailyActivity) data.dailyActivity = {};
  return data;
}

export function saveHistory(data) {
  writeJsonAtomic(getHistoryFilePath(), data);
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

/**
 * Namespaced key for a pronunciation card.
 *
 * Speaking failures used to be filed under the single literal 'Speaking
 * Accuracy', so every mispronounced phrase a learner ever produced collapsed
 * into one card. Keying by the target phrase gives each one its own SM-2
 * schedule. The prefix keeps it from colliding with a grammar rule that
 * happens to share the name.
 * @param {string} target
 * @returns {string}
 */
export function pronunciationCardKey(target) {
  const normalized = String(target ?? '')
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=_`~()?"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `pronunciation:${normalized}`;
}

/**
 * Cards written before pronunciation cards existed carry no `kind`.
 * @param {{ kind?: string } | null} card
 * @returns {'grammar' | 'pronunciation'}
 */
export function getCardKind(card) {
  return card?.kind === 'pronunciation' ? 'pronunciation' : 'grammar';
}

/**
 * Storage key for a card, regardless of kind. Grammar cards are keyed by their
 * rule name; pronunciation cards by their normalized target phrase.
 * @param {{ kind?: string, rule?: string, target?: string }} card
 * @returns {string|undefined}
 */
export function srsCardKey(card) {
  return getCardKind(card) === 'pronunciation'
    ? pronunciationCardKey(card.target)
    : card?.rule;
}

/**
 * Files one measured substitution span as its own SM-2 card.
 * @param {{ target: string, spoken: string, confidence?: number|null }} span
 */
export function recordPronunciationError(span) {
  const target = String(span?.target ?? '').trim();
  if (!target) return;

  const spoken = String(span?.spoken ?? '').trim();
  const confidence = typeof span?.confidence === 'number' ? span.confidence : null;
  const key = pronunciationCardKey(target);

  const data = loadHistory();
  data.errors.push({
    type: key,
    original: target,
    corrected: spoken,
    timestamp: new Date().toISOString()
  });

  const existing = data.srsCards[key];
  if (!existing) {
    data.srsCards[key] = {
      rule: `Pronunciation: "${target}"`,
      kind: 'pronunciation',
      target,
      lastSpoken: spoken,
      confidence,
      repetition: 0,
      interval: 1,
      easeFactor: 2.5,
      count: 1,
      nextReviewDate: new Date().toISOString()
    };
  } else {
    existing.count = (existing.count || 1) + 1;
    existing.repetition = 0;
    existing.interval = 1;
    existing.lastSpoken = spoken;
    existing.confidence = confidence;
    existing.nextReviewDate = new Date().toISOString();
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
  const earnedXp = (stats.correct || 0) * 10;
  recordDailyActivity(earnedXp, 0);
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
