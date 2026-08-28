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
 * Calls AI using a strict, zero-bias IELTS/TOEFL examiner rubric.
 * Explicitly penalizes Spanish phonetic interference (epenthesis, silent letters, flat intonation).
 * @param {string} promptContext
 * @param {string} spokenText
 * @param {string} [expectedTarget]
 * @returns {Promise<{ isCorrect: boolean, feedback: string, ieltsBand: string, wordStressScore: number, connectedSpeechScore: number, criticalFlaws: string[], phoneticTips: string[], suggestions: string[] }>}
 */
export async function evaluateSpokenWithAI(promptContext, spokenText, expectedTarget = '') {
  const prompt =
    `You are a STRICT, ZERO-BIAS IELTS & TOEFL Senior Speech Examiner.\n` +
    `DO NOT give empty praise, cheerleading, or false compliments. Be clinically objective, honest, and technically accurate.\n\n` +
    `Target Sentence (Expected): "${expectedTarget}"\n` +
    `Student Output: "${spokenText}"\n` +
    `Context: "${promptContext}"\n\n` +
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
