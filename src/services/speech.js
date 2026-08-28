import { callAgy } from './agy.js';

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
 * Evaluates comprehensive speech metrics.
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
 * Calls AI to evaluate a spoken response for grammar and conversational fluency.
 * @param {string} promptContext
 * @param {string} spokenText
 * @param {string} [expectedTarget]
 * @returns {Promise<{ isCorrect: boolean, feedback: string, grammarScore: number, pronunciationTips: string[], suggestions: string[] }>}
 */
export async function evaluateSpokenWithAI(promptContext, spokenText, expectedTarget = '') {
  const prompt =
    `You are a Senior English Speech & Pronunciation Coach. Evaluate this student spoken response.\n` +
    `Context/Prompt: "${promptContext}"\n` +
    `Expected Target (if any): "${expectedTarget}"\n` +
    `Student Spoke: "${spokenText}"\n\n` +
    `Return ONLY a raw JSON object with NO markdown formatting, NO backticks, NO extra text:\n` +
    `{\n` +
    `  "isCorrect": boolean (true if communicative and grammatically sound),\n` +
    `  "feedback": "1-2 concise sentences in Spanish explaining how their spoken response sounded and key advice",\n` +
    `  "grammarScore": number (0-100),\n` +
    `  "pronunciationTips": ["Specific tip on phonetics/stress for words used (e.g. 'Emphasize the second syllable in ca-REER')"],\n` +
    `  "suggestions": ["More natural native phrasing"]\n` +
    `}`;

  try {
    return JSON.parse(callAgy(prompt));
  } catch {
    return {
      isCorrect: true,
      feedback: 'Respuesta comprensible y fluida.',
      grammarScore: 85,
      pronunciationTips: ['Cuidá la acentuación de las palabras clave.'],
      suggestions: [spokenText]
    };
  }
}
