import { join } from 'node:path';
import { readJson, writeJsonAtomic, getDataDir } from './storage.js';

function getConfigFilePath() {
  return join(getDataDir(), 'config.json');
}

/**
 * @typedef {Object} UserConfig
 * @property {string} userName
 * @property {'normal' | 'slow' | 'ultra-slow'} audioSpeed
 * @property {'auto' | 'ffplay' | 'mpg123' | 'aplay' | 'muted'} audioPlayer
 * @property {'auto' | 'whisper-cpp' | 'openai-whisper' | 'off'} sttEngine
 * @property {string} sttModel
 * @property {'auto' | 'agy' | 'anthropic'} aiProvider
 * @property {string} aiModel
 * @property {'beginner' | 'intermediate' | 'advanced'} defaultDifficulty
 * @property {boolean} soundEffects
 * @property {number} dailyGoalXp
 * @property {boolean} onboarded
 */

/** @type {UserConfig} */
export const DEFAULT_CONFIG = {
  userName: 'Learner',
  audioSpeed: 'normal',
  audioPlayer: 'auto',
  sttEngine: 'auto',
  sttModel: '',
  aiProvider: 'auto',
  aiModel: '',
  defaultDifficulty: 'beginner',
  soundEffects: true,
  dailyGoalXp: 50,
  onboarded: false
};

/**
 * Loads user configuration with fallback to defaults.
 * @returns {UserConfig}
 */
export function loadConfig() {
  const config = readJson(getConfigFilePath(), DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG, ...config };
}

/**
 * Saves complete configuration atomically.
 * @param {UserConfig} config
 */
export function saveConfig(config) {
  writeJsonAtomic(getConfigFilePath(), config);
}

/**
 * Updates partial configuration fields and persists.
 * @param {Partial<UserConfig>} updates
 * @returns {UserConfig}
 */
export function updateConfig(updates) {
  const current = loadConfig();
  const updated = { ...current, ...updates };
  saveConfig(updated);
  return updated;
}

/**
 * Resets configuration back to defaults.
 * @returns {UserConfig}
 */
export function resetConfig() {
  saveConfig(DEFAULT_CONFIG);
  return structuredClone(DEFAULT_CONFIG);
}

/**
 * Returns a warm time-of-day greeting personalized with user's name.
 * @param {string} [name='Learner']
 * @param {Date} [d=new Date()]
 * @returns {string}
 */
export function getGreeting(name = 'Learner', d = new Date()) {
  const hour = d.getHours();
  const cleanName = name && name.trim() ? name.trim() : 'Learner';

  if (hour >= 5 && hour < 12) {
    return `Good morning, ${cleanName}! ☕`;
  } else if (hour >= 12 && hour < 19) {
    return `Good afternoon, ${cleanName}! ☀️`;
  } else {
    return `Good evening, ${cleanName}! 🌙`;
  }
}
