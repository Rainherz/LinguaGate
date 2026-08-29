/**
 * Grading and input rules for exercises.
 *
 * These decisions used to live inline in the interactive exercise flows, which
 * imported chalk, ora and the prompt helpers — so none of them could be tested
 * without driving a terminal.
 */

/**
 * Compares a learner's fill-in-the-blank answer against the expected one.
 * @param {string} input
 * @param {string} answer
 * @returns {boolean}
 */
export function gradeFillBlank(input, answer) {
  const given = String(input ?? '').trim().toLowerCase();
  const expected = String(answer ?? '').trim().toLowerCase();
  if (!given || !expected) return false;
  return given === expected;
}

/**
 * Strips markup from a phrase before it is handed to the TTS engine.
 * @param {string} phrase
 * @returns {string}
 */
export function sanitizeForSpeech(phrase) {
  return String(phrase ?? '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .trim();
}

/**
 * Interprets a keypress in the post-answer audio menu.
 * An unrecognized key returns 'unknown' rather than 'continue': advancing on a
 * typo would skip past feedback the learner meant to replay.
 * @param {string} raw
 * @returns {'continue' | 'normal' | 'slow' | 'unknown'}
 */
export function parseAudioAction(raw) {
  const action = String(raw ?? '').trim().toLowerCase();

  if (!action || action === 'next' || action === 'c' || action === '/quit') return 'continue';
  if (action === 'a' || action === 'audio') return 'normal';
  if (action === 's' || action === 'slow') return 'slow';
  return 'unknown';
}
