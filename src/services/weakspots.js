import { loadHistory, getCardKind } from './history.js';

const PRONUNCIATION_PREFIX = 'pronunciation:';

/**
 * Turns an internal card key into something a learner should read.
 * Pronunciation cards are namespaced to avoid colliding with grammar rules;
 * that namespace is an implementation detail.
 * @param {string} key
 * @returns {string}
 */
export function displayLabel(key) {
  const raw = String(key ?? '');
  return raw.startsWith(PRONUNCIATION_PREFIX) ? raw.slice(PRONUNCIATION_PREFIX.length) : raw;
}

/**
 * How much a past mistake should still count against you.
 *
 * Raw error counts are a museum: a rule you fumbled ten times last month and
 * have since cleared four reviews in a row would sit at the top forever. The
 * SM-2 repetition streak is the app's own measure of consolidation, so weight
 * decays with it — but never to zero, because a mastered rule can resurface.
 * @param {number} repetition
 * @returns {number}
 */
export function masteryWeight(repetition) {
  return 1 / (1 + Math.max(0, repetition || 0));
}

/**
 * Ranks what the learner is actually weakest at right now, joining the raw
 * error log with each rule's current SM-2 state.
 * @param {number} [limit=5]
 * @returns {Array<{ key: string, label: string, kind: 'grammar'|'pronunciation', count: number, repetition: number, interval: number, lastAttempt: string, priority: number }>}
 */
export function getWeakSpots(limit = 5) {
  const { errors = [], srsCards = {} } = loadHistory();

  /** @type {Record<string, number>} */
  const counts = {};
  for (const entry of errors) {
    if (!entry?.type) continue;
    counts[entry.type] = (counts[entry.type] ?? 0) + 1;
  }

  return Object.entries(counts)
    .map(([key, count]) => {
      const card = srsCards[key];
      const kind = getCardKind(card);
      const repetition = card?.repetition ?? 0;

      return {
        key,
        label: displayLabel(key),
        kind,
        count,
        repetition,
        interval: card?.interval ?? 1,
        lastAttempt: kind === 'pronunciation'
          ? (card?.lastSpoken ?? '')
          : (card?.lastMistake?.original ?? ''),
        priority: count * masteryWeight(repetition)
      };
    })
    .sort((a, b) => b.priority - a.priority || b.count - a.count)
    .slice(0, limit);
}
