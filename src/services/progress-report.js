import { loadHistory } from './history.js';

/** Below this swing a change is noise, not a trend. */
const TREND_MARGIN = 8;

/**
 * Reads the session log that recordSession has been writing since the project
 * started and that nothing ever consumed.
 */

function accuracyOf(correct, incorrect) {
  const total = correct + incorrect;
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

/**
 * Compares an earlier accuracy against a later one.
 * @param {number} earlier
 * @param {number} later
 * @returns {'improving' | 'declining' | 'steady'}
 */
export function trendOf(earlier, later) {
  const delta = later - earlier;
  if (delta >= TREND_MARGIN) return 'improving';
  if (delta <= -TREND_MARGIN) return 'declining';
  return 'steady';
}

/**
 * Per-mode accuracy and direction of travel, weakest mode first.
 *
 * Ordering matters more than completeness here: a learner should open this and
 * immediately see the thing worth practising, not scan a table for it.
 * @returns {{ modes: Array<{ mode: string, sessions: number, correct: number, incorrect: number, accuracy: number, trend: string }>, totals: { sessions: number, correct: number, incorrect: number, accuracy: number } }}
 */
export function summarizeProgress() {
  const sessions = loadHistory().sessions || [];

  /** @type {Record<string, Array<{ correct: number, incorrect: number, date: string }>>} */
  const byMode = {};
  for (const s of sessions) {
    const mode = s?.mode || 'unknown';
    (byMode[mode] ??= []).push({
      correct: s.correct || 0,
      incorrect: s.incorrect || 0,
      date: s.date || ''
    });
  }

  const modes = Object.entries(byMode).map(([mode, entries]) => {
    const ordered = [...entries].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const correct = ordered.reduce((n, e) => n + e.correct, 0);
    const incorrect = ordered.reduce((n, e) => n + e.incorrect, 0);

    let trend = 'unknown';
    if (ordered.length >= 2) {
      const half = Math.floor(ordered.length / 2);
      const sum = (slice) => slice.reduce(
        (acc, e) => ({ c: acc.c + e.correct, i: acc.i + e.incorrect }),
        { c: 0, i: 0 }
      );
      const earlier = sum(ordered.slice(0, half));
      const later = sum(ordered.slice(half));
      trend = trendOf(accuracyOf(earlier.c, earlier.i), accuracyOf(later.c, later.i));
    }

    return {
      mode,
      sessions: ordered.length,
      correct,
      incorrect,
      accuracy: accuracyOf(correct, incorrect),
      trend
    };
  });

  modes.sort((a, b) => a.accuracy - b.accuracy || b.sessions - a.sessions);

  const correct = modes.reduce((n, m) => n + m.correct, 0);
  const incorrect = modes.reduce((n, m) => n + m.incorrect, 0);

  return {
    modes,
    totals: {
      sessions: sessions.length,
      correct,
      incorrect,
      accuracy: accuracyOf(correct, incorrect)
    }
  };
}
