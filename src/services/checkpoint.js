import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from './storage.js';
import { loadProgress, saveProgress } from './progress.js';
import { recordDailyActivity } from './activity.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHECKPOINTS_DATA = join(__dirname, '../data/checkpoints.json');

/**
 * @typedef {Object} CheckpointQuestion
 * @property {number} id
 * @property {'listening' | 'translate' | 'fillblank' | 'choice'} type
 * @property {string} [audioText]
 * @property {string} [expected]
 * @property {string} [spanish]
 * @property {string} [sentence]
 * @property {string} [answer]
 * @property {string} [explanation]
 * @property {string} [prompt]
 * @property {Array<{ name: string, value: boolean }>} [options]
 * @property {string} [hint]
 * @property {string} topic
 */

/**
 * @typedef {Object} CheckpointExam
 * @property {string} title
 * @property {number} passingScore
 * @property {number} totalQuestions
 * @property {number} xpReward
 * @property {string} certificate
 * @property {CheckpointQuestion[]} questions
 */

/**
 * Loads checkpoint exam configuration for a given CEFR level.
 * @param {string} level
 * @returns {CheckpointExam | null}
 */
export function loadCheckpoint(level) {
  const data = readJson(CHECKPOINTS_DATA, {});
  return data[level.toUpperCase()] || null;
}

/**
 * Checks if a checkpoint exam is unlocked based on lesson completion.
 * @param {string} level
 * @param {Object} progress
 * @param {Array<{ id: string, unitLevel: string }>} allLessons
 * @returns {boolean}
 */
export function isCheckpointUnlocked(level, progress, allLessons) {
  const unitLessons = allLessons.filter((l) => l.unitLevel.toUpperCase() === level.toUpperCase());
  if (unitLessons.length === 0) return false;
  return unitLessons.every((l) => progress.completedLessons?.includes(l.id));
}

/**
 * Checks if a level certification has already been achieved.
 * @param {string} level
 * @param {Object} progress
 * @returns {boolean}
 */
export function isLevelCertified(level, progress) {
  return Array.isArray(progress.certifications) && progress.certifications.includes(level.toUpperCase());
}

/**
 * Records a successful checkpoint pass, awards certification badge and XP.
 * @param {string} level
 * @param {number} score
 * @param {number} total
 * @returns {{ progress: Object, xpEarned: number, certificate: string }}
 */
export function completeCheckpoint(level, score, total) {
  const progress = loadProgress();
  if (!Array.isArray(progress.certifications)) progress.certifications = [];

  const exam = loadCheckpoint(level);
  const xpReward = exam?.xpReward || 200;
  const certName = exam?.certificate || `🎖️ CEFR ${level.toUpperCase()} Certified`;

  const upperLevel = level.toUpperCase();
  if (!progress.certifications.includes(upperLevel)) {
    progress.certifications.push(upperLevel);
    progress.xp += xpReward;
    recordDailyActivity(xpReward, 1);
  }

  if (!Array.isArray(progress.checkpointHistory)) progress.checkpointHistory = [];
  progress.checkpointHistory.push({
    level: upperLevel,
    score,
    total,
    passed: score >= (exam?.passingScore || 16),
    timestamp: new Date().toISOString()
  });

  saveProgress(progress);
  return { progress, xpEarned: xpReward, certificate: certName };
}
