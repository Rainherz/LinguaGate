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
 * @property {'beginner' | 'intermediate' | 'advanced'} defaultDifficulty
 * @property {boolean} soundEffects
 * @property {number} dailyGoalXp
 */

/** @type {UserConfig} */
export const DEFAULT_CONFIG = {
  userName: 'Learner',
  audioSpeed: 'normal',
  audioPlayer: 'auto',
  defaultDifficulty: 'beginner',
  soundEffects: true,
  dailyGoalXp: 50
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
