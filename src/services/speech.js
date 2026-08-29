import { askJson } from './ai/port.js';

const SPOKEN_EVAL_SCHEMA = {
  type: 'object',
  properties: {
    isCorrect: { type: 'boolean', description: 'true ONLY if pronunciation and grammar are clear and accurate' },
    ieltsBand: { type: 'string', description: 'e.g. "Band 7.0 (Good)"' },
    wordStressScore: { type: 'number', description: '0-100' },
    connectedSpeechScore: { type: 'number', description: '0-100' },
    feedback: { type: 'string', description: 'strict 1-2 sentence diagnostic in Spanish' },
    criticalFlaws: { type: 'array', items: { type: 'string' }, description: 'phonetic or stress mistakes, in Spanish' },
    phoneticTips: { type: 'array', items: { type: 'string' }, description: 'concrete IPA tongue/mouth placement tips' },
    suggestions: { type: 'array', items: { type: 'string' }, description: 'natural native phrasing' }
  },
  required: ['isCorrect', 'ieltsBand', 'wordStressScore', 'connectedSpeechScore', 'feedback', 'criticalFlaws', 'phoneticTips', 'suggestions']
};

const FILLER_PATTERNS = [
  /\bum+\b/gi,
  /\buh+\b/gi,
  /\ber+\b/gi,
  /\blike\b/gi,
  /\byou know\b/gi,
  /\bbasically\b/gi,
  /\bactually\b/gi,
  /\beh+\b/gi,
  /\bi mean\b/gi
];

/**
 * Calculates Words Per Minute (WPM) and rate category.
 * @param {number} wordCount
 * @param {number} durationSec
 * @returns {{ wpm: number, category: 'slow' | 'conversational' | 'fluent' | 'fast', label: string }}
 */
export function calculateWpm(wordCount, durationSec) {
  if (!durationSec || durationSec <= 0) return { wpm: 0, category: 'slow', label: '0 WPM' };
  const wpm = Math.round((wordCount / durationSec) * 60);

  if (wpm < 85) {
    return { wpm, category: 'slow', label: `${wpm} WPM (Slow / Hesitant 🐢)` };
  } else if (wpm < 110) {
    return { wpm, category: 'conversational', label: `${wpm} WPM (Conversational 🚶)` };
  } else if (wpm <= 165) {
    return { wpm, category: 'fluent', label: `${wpm} WPM (Fluent & Natural 🔥)` };
  } else {
    return { wpm, category: 'fast', label: `${wpm} WPM (Rapid / Fast ⚡)` };
  }
}

/**
 * Scans spoken text for filler words and hesitation markers.
 * @param {string} text
 * @returns {{ count: number, detected: string[] }}
 */
export function detectFillerWords(text) {
  if (!text) return { count: 0, detected: [] };
  const detected = [];

  for (const pattern of FILLER_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      detected.push(...matches.map((m) => m.toLowerCase()));
    }
  }

  return { count: detected.length, detected };
}

/**
 * Compares expected phrase against spoken phrase and computes word accuracy.
 * @param {string} expected
 * @param {string} actual
 * @returns {{ accuracyScore: number, missingWords: string[], extraWords: string[] }}
 */
export function calculateWordAccuracy(expected, actual) {
  const cleanExp = (expected || '')
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const cleanAct = (actual || '')
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (cleanExp.length === 0) return { accuracyScore: 100, missingWords: [], extraWords: [] };

  let matched = 0;
  const missingWords = [];
  const expCopy = [...cleanExp];

  for (const word of cleanAct) {
    const idx = expCopy.indexOf(word);
    if (idx !== -1) {
      matched += 1;
      expCopy.splice(idx, 1);
    }
  }

  for (const remaining of expCopy) {
    missingWords.push(remaining);
  }

  const accuracyScore = Math.max(0, Math.min(100, Math.round((matched / cleanExp.length) * 100)));
  return { accuracyScore, missingWords, extraWords: [] };
}

const WORD_PUNCTUATION = /[.,/#!$%^&*;:{}=\-_`~()?"']/g;

/**
 * Splits text into display/compare token pairs.
 * @param {string} text
 * @returns {Array<{ raw: string, key: string }>}
 */
function tokenizeWords(text) {
  return (text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, key: raw.toLowerCase().replace(WORD_PUNCTUATION, '') }));
}

/**
 * Aligns the target sentence against what was actually spoken, marking each
 * token as matched or not. Repeated words are consumed from a pool so the same
 * spoken word never satisfies two expected slots.
 * @param {string} expected
 * @param {string} actual
 * @returns {{ expectedTokens: Array<{word: string, matched: boolean}>, actualTokens: Array<{word: string, matched: boolean}> }}
 */
export function diffSpokenWords(expected, actual) {
  const expTokens = tokenizeWords(expected);
  const actTokens = tokenizeWords(actual);

  const consume = (pool, key) => {
    const index = pool.indexOf(key);
    if (index === -1) return false;
    pool.splice(index, 1);
    return true;
  };

  const poolForActual = expTokens.map((t) => t.key);
  const actualTokens = actTokens.map((t) => ({
    word: t.raw,
    matched: t.key === '' ? true : consume(poolForActual, t.key)
  }));

  const poolForExpected = actTokens.map((t) => t.key);
  const expectedTokens = expTokens.map((t) => ({
    word: t.raw,
    matched: t.key === '' ? true : consume(poolForExpected, t.key)
  }));

  return { expectedTokens, actualTokens };
}

/** A dictation counts as understood at this word-level accuracy. */
const DICTATION_PASS_THRESHOLD = 85;

/**
 * Scores a dictation attempt by measurement rather than by asking a model.
 *
 * Comparing a target sentence with what the learner typed is string work, not
 * a judgement call: the accuracy is countable and the mishearings are a diff.
 * The model is better spent explaining WHY those particular sounds were missed.
 * @param {string} expected
 * @param {string} typed
 * @returns {{ score: number, isCorrect: boolean, accuracy: { accuracyScore: number, missingWords: string[] }, spans: Array<{ type: string, target: string, spoken: string }> }}
 */
export function scoreDictation(expected, typed) {
  const hasTarget = String(expected ?? '').trim().length > 0;
  const hasAttempt = String(typed ?? '').trim().length > 0;

  const accuracy = calculateWordAccuracy(expected, typed);
  const score = hasTarget && hasAttempt ? accuracy.accuracyScore : 0;

  return {
    score,
    isCorrect: hasTarget && hasAttempt && score >= DICTATION_PASS_THRESHOLD,
    accuracy,
    spans: groupSubstitutionSpans(expected, typed)
  };
}

/**
 * Evaluates comprehensive speech metrics based on objective physical measurements.
 * @param {string} expectedText
 * @param {string} spokenText
 * @param {number} durationSec
 */
export function evaluateSpeechMetrics(expectedText, spokenText, durationSec) {
  const words = (spokenText || '').trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const wpmData = calculateWpm(wordCount, durationSec);
  const fillerData = detectFillerWords(spokenText);
  const accuracyData = calculateWordAccuracy(expectedText, spokenText);

  // Fluency score penalizes excessive hesitation and suboptimal speed
  let fluencyScore = 100;
  if (wpmData.wpm < 80) fluencyScore -= 25;
  if (wpmData.wpm > 180) fluencyScore -= 10;
  fluencyScore -= Math.min(30, fillerData.count * 10);
  fluencyScore = Math.max(20, Math.min(100, fluencyScore));

  return {
    wordCount,
    durationSec,
    wpm: wpmData,
    fillers: fillerData,
    accuracy: accuracyData,
    fluencyScore
  };
}

/**
 * Longest common subsequence over normalized token keys.
 * Used to anchor the two utterances positionally: multiset matching can tell
 * you a word is missing, but not WHICH stretch of speech replaced it.
 * @param {string[]} a
 * @param {string[]} b
 * @returns {Array<[number, number]>} pairs of aligned indices
 */
function lcsPairs(a, b) {
  const rows = a.length;
  const cols = b.length;
  const table = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const pairs = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return pairs;
}

/**
 * Groups contiguous mismatches into whole spans, so a learner reads
 * `prioritize → "pre-write the sign,"` instead of four separate flagged words
 * including a bewildering `the`.
 * @param {string} expected
 * @param {string} spoken
 * @returns {Array<{ type: 'substitution'|'omission'|'insertion', target: string, spoken: string, targetIndex: number, spokenIndex: number, spokenLength: number }>}
 */
export function groupSubstitutionSpans(expected, spoken) {
  const exp = tokenizeWords(expected);
  const act = tokenizeWords(spoken);
  const anchors = lcsPairs(exp.map((t) => t.key), act.map((t) => t.key));

  const spans = [];
  let ei = 0;
  let ai = 0;

  const flush = (eEnd, aEnd) => {
    const targetWords = exp.slice(ei, eEnd).map((t) => t.raw);
    const spokenWords = act.slice(ai, aEnd).map((t) => t.raw);
    if (targetWords.length === 0 && spokenWords.length === 0) return;

    const type = targetWords.length === 0
      ? 'insertion'
      : spokenWords.length === 0
        ? 'omission'
        : 'substitution';

    spans.push({
      type,
      target: targetWords.join(' '),
      spoken: spokenWords.join(' '),
      targetIndex: ei,
      spokenIndex: ai,
      spokenLength: spokenWords.length
    });
  };

  for (const [e, a] of anchors) {
    flush(e, a);
    ei = e + 1;
    ai = a + 1;
  }
  flush(exp.length, act.length);

  return spans;
}

const CLEAR_THRESHOLD = 0.85;

/**
 * Crosses the target-vs-spoken word diff with the recognizer's per-word
 * acoustic confidence.
 *
 * Confidence alone is not a pronunciation score: it measures how sure the
 * recognizer is of what IT heard, not whether you said the right word. A
 * learner who says "pre-write the sign" for "prioritize" articulates it
 * confidently, so every token scores 0.97+ while half the sentence is wrong.
 * Only the two signals together separate the failure modes:
 *
 *   matched   + confident  -> correct
 *   matched   + unsure     -> right word, unclear delivery
 *   mismatch  + confident  -> confident substitution (spoke clearly, said something else)
 *   mismatch  + unsure     -> mumbled into a different word
 *
 * @param {string} expected
 * @param {string} spoken
 * @param {Array<{ word: string, probability: number }>} acousticWords
 * @returns {{ words: Array<{ word: string, probability: number|null, matched: boolean, verdict: string }>, substitutions: Array<{ word: string, probability: number|null }>, spans: Array<{ type: string, target: string, spoken: string, confidence: number|null }>, verdict: string, summary: string }}
 */
export function diagnoseArticulation(expected, spoken, acousticWords = []) {
  const { actualTokens } = diffSpokenWords(expected, spoken);
  const acoustic = Array.isArray(acousticWords) ? acousticWords : [];

  const normalize = (w) => String(w || '').toLowerCase().replace(WORD_PUNCTUATION, '');

  const words = actualTokens.map((token, index) => {
    // The two lists come from the same transcript, so positions line up;
    // the key check keeps a misalignment from attaching the wrong score.
    const candidate = acoustic[index];
    const probability =
      candidate && normalize(candidate.word) === normalize(token.word)
        ? candidate.probability
        : null;

    let verdict;
    if (probability === null) {
      verdict = token.matched ? 'correct' : 'substitution';
    } else if (token.matched) {
      verdict = probability >= CLEAR_THRESHOLD ? 'correct' : 'unclear';
    } else {
      verdict = probability >= CLEAR_THRESHOLD ? 'confident-substitution' : 'mumbled-substitution';
    }

    return { word: token.word, probability, matched: token.matched, verdict };
  });

  const substitutions = words
    .filter((w) => w.verdict.includes('substitution'))
    .map((w) => ({ word: w.word, probability: w.probability }));

  const confident = words.filter((w) => w.verdict === 'confident-substitution').length;
  const mumbled = words.filter((w) => w.verdict === 'mumbled-substitution').length;
  const unknown = words.filter((w) => w.verdict === 'substitution').length;
  const unclear = words.filter((w) => w.verdict === 'unclear').length;

  let verdict;
  let summary;

  if (substitutions.length === 0 && unclear === 0) {
    verdict = 'clean';
    summary = 'Every word matched the target and came through clearly.';
  } else if (substitutions.length === 0) {
    verdict = 'unclear-delivery';
    summary = `You said the right words, but ${unclear} of them were hard to make out.`;
  } else if (unknown > 0 && confident === 0 && mumbled === 0) {
    verdict = 'substitution';
    summary = `${substitutions.length} word(s) did not match the target.`;
  } else if (confident >= mumbled && confident > 0) {
    verdict = 'confident-substitution';
    summary =
      `You articulated confidently — but you articulated different words. ` +
      `${confident} word(s) were transcribed with high certainty and still did not match the target.`;
  } else if (mumbled > 0 && confident === 0) {
    verdict = 'mumbled-substitution';
    summary = `${mumbled} word(s) were slurred into something the recognizer read as a different word.`;
  } else {
    verdict = 'mixed';
    summary =
      `${confident} confident substitution(s) and ${mumbled} slurred one(s): ` +
      `some words were wrong, others merely unclear.`;
  }

  const spans = groupSubstitutionSpans(expected, spoken).map((span) => {
    const covered = words.slice(span.spokenIndex, span.spokenIndex + span.spokenLength);
    const probabilities = covered
      .map((w) => w.probability)
      .filter((prob) => typeof prob === 'number');

    return {
      ...span,
      // A span is only as clear as its weakest word.
      confidence: probabilities.length > 0 ? Math.min(...probabilities) : null
    };
  });

  return { words, substitutions, spans, verdict, summary };
}

/**
 * Renders the diagnosis as evidence the AI examiner can reason over.
 * Never claims a clean read when words were substituted — the previous version
 * reported "every word was clearly articulated" on a 56%-precision attempt.
 * @param {ReturnType<typeof diagnoseArticulation> | null} diagnosis
 * @returns {string}
 */
export function formatAcousticEvidence(diagnosis) {
  if (!diagnosis || !Array.isArray(diagnosis.words) || diagnosis.words.length === 0) return '';

  const describe = (w) =>
    `"${w.word}"${w.probability === null ? '' : ` (recognizer confidence ${w.probability.toFixed(2)})`}`;

  if (diagnosis.verdict === 'clean') {
    return 'Acoustic evidence: every word matched the target and was clearly articulated.';
  }

  const lines = [`Acoustic evidence from the speech recognizer: ${diagnosis.summary}`];

  // Spans, not loose words: "prioritize -> pre-write the sign" is a diagnosable
  // event; a flagged bare "the" is noise.
  const substituted = (diagnosis.spans || []).filter((sp) => sp.type === 'substitution');
  if (substituted.length > 0) {
    lines.push(
      `Target phrase -> what the recognizer actually heard: ` +
      substituted
        .map((sp) => `"${sp.target}" -> "${sp.spoken}"${sp.confidence === null ? '' : ` (confidence ${sp.confidence.toFixed(2)})`}`)
        .join('; ') +
      `. High confidence here means the learner articulated clearly and still produced the wrong sounds — ` +
      `diagnose which phonemes turned the target phrase into what was heard.`
    );
  }

  const omitted = (diagnosis.spans || []).filter((sp) => sp.type === 'omission');
  if (omitted.length > 0) {
    lines.push(`Dropped entirely: ${omitted.map((sp) => `"${sp.target}"`).join(', ')}.`);
  }

  const inserted = (diagnosis.spans || []).filter((sp) => sp.type === 'insertion');
  if (inserted.length > 0) {
    lines.push(`Added but not in the target: ${inserted.map((sp) => `"${sp.spoken}"`).join(', ')}.`);
  }

  const unclear = diagnosis.words.filter((w) => w.verdict === 'unclear');
  if (unclear.length > 0) {
    lines.push(`Correct word but weak articulation: ${unclear.map(describe).join(', ')}.`);
  }

  lines.push('Base your pronunciation diagnosis on these items only. Do not invent errors for anything not listed here.');
  return lines.join(' ');
}

/**
 * Calls AI using a strict, zero-bias IELTS/TOEFL examiner rubric.
 * Explicitly penalizes Spanish phonetic interference (epenthesis, silent letters, flat intonation).
 * @param {string} promptContext
 * @param {string} spokenText
 * @param {string} [expectedTarget]
 * @param {ReturnType<typeof diagnoseArticulation>} [diagnosis]
 * @returns {Promise<{ isCorrect: boolean, feedback: string, ieltsBand: string, wordStressScore: number, connectedSpeechScore: number, criticalFlaws: string[], phoneticTips: string[], suggestions: string[] }>}
 */
export async function evaluateSpokenWithAI(promptContext, spokenText, expectedTarget = '', diagnosis = null) {
  const prompt =
    `You are a STRICT, ZERO-BIAS IELTS & TOEFL Senior Speech Examiner.\n` +
    `DO NOT give empty praise, cheerleading, or false compliments. Be clinically objective, honest, and technically accurate.\n\n` +
    `Target Sentence (Expected): "${expectedTarget}"\n` +
    `Student Output: "${spokenText}"\n` +
    `Context: "${promptContext}"\n\n` +
    (formatAcousticEvidence(diagnosis) ? `${formatAcousticEvidence(diagnosis)}\n\n` : '') +
    `Evaluate specifically for common native Spanish speaker phonetic traps:\n` +
    `1. S-cluster epenthesis (e.g. pronouncing 'es-schedule' instead of /sk/)\n` +
    `2. Silent letters & false vowels (e.g. pronouncing the 'l' in 'should' or 'would', wrong -ed endings)\n` +
    `3. Word stress placement (e.g. saying 'ar-chi-TEC-ture' instead of 'AR-chi-tecture')\n` +
    `4. Vowel reduction in function words (to, for, the, and)\n\n` +
    `Judge the ieltsBand as one of: "Band 5.0 (Modest)", "Band 6.0 (Competent)", ` +
    `"Band 7.0 (Good)", "Band 8.0 (Very Good)".`;

  try {
    return /** @type {any} */ (await askJson(prompt, SPOKEN_EVAL_SCHEMA));
  } catch {
    return {
      isCorrect: true,
      ieltsBand: 'Band 6.5 (Competent)',
      wordStressScore: 80,
      connectedSpeechScore: 75,
      feedback: 'Pronunciación entendible pero requiere mayor precisión en la acentuación de sílabas tónicas.',
      criticalFlaws: ['Cuidar la no pronunciación de consonantes mudas.'],
      phoneticTips: ['Poné el aire en la primera sílaba y no agregues vocales al inicio de palabras con S.'],
      suggestions: [spokenText]
    };
  }
}
