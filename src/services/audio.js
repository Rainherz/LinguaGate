import { exec, execSync } from 'node:child_process';
import { loadConfig } from './config.js';
import { synthesize } from './tts.js';

/**
 * Playback only. Rendering a phrase to audio now lives in tts.js, so the
 * engine that speaks and the program that plays are chosen independently.
 */

const ALL_CANDIDATES = {
  ffplay: { type: 'ffplay', cmd: 'ffplay', args: '-nodisp -autoexit -loglevel quiet' },
  mpg123: { type: 'mpg123', cmd: 'mpg123', args: '-q' },
  aplay: { type: 'aplay', cmd: 'aplay', args: '-q' }
};

function detectPlayer() {
  const config = loadConfig();
  if (config.audioPlayer === 'muted') return null;

  if (config.audioPlayer && config.audioPlayer !== 'auto' && ALL_CANDIDATES[config.audioPlayer]) {
    try {
      execSync(`which ${ALL_CANDIDATES[config.audioPlayer].cmd}`, { stdio: 'ignore' });
      return ALL_CANDIDATES[config.audioPlayer];
    } catch {
      // Fallback to auto
    }
  }

  for (const c of Object.values(ALL_CANDIDATES)) {
    try {
      execSync(`which ${c.cmd}`, { stdio: 'ignore' });
      return c;
    } catch {
      // continue
    }
  }
  return null;
}

export function isAudioSupported() {
  return detectPlayer() !== null;
}

/**
 * Plays audio at normal (1.0x), slow (0.7x), or ultra slow (0.4x).
 * Uses digital audio time-stretching filter (atempo) without pitch distortion.
 * @param {string} text
 * @param {{ speed?: string }} [options]
 */
export async function playAudio(text, options = {}) {
  const config = loadConfig();
  const activeSpeed = options.speed || config.audioSpeed || 'normal';
  const player = detectPlayer();
  if (!player) {
    return { played: false, reason: 'No audio player detected or audio muted in settings.' };
  }

  const rendered = await synthesize(text, { speed: activeSpeed, config });
  if (!rendered.success) {
    return { played: false, reason: rendered.error };
  }

  // Local engines render at the requested pace, which keeps pitch intact.
  // Only a pre-rendered clip needs time-stretching at playback.
  let speedArgs = player.args;
  if (rendered.engine === 'google' && activeSpeed !== 'normal') {
    if (player.type === 'ffplay') {
      speedArgs += activeSpeed === 'slow' ? ' -af "atempo=0.7"' : ' -af "atempo=0.5,atempo=0.8"';
    } else if (player.type === 'mpg123') {
      speedArgs += activeSpeed === 'slow' ? ' --pitch -0.3' : ' --pitch -0.5';
    }
  }

  return new Promise((resolve) => {
    exec(`${player.cmd} ${speedArgs} "${rendered.path}"`, (err) => {
      resolve(err ? { played: false, reason: err.message } : { played: true, engine: rendered.engine });
    });
  });
}

/**
 * Plays audio at slow (0.7x) cadence.
 * @param {string} text
 */
export async function playAudioSlow(text) {
  return playAudio(text, { speed: 'slow' });
}

/**
 * Plays audio at ultra-slow (0.4x) cadence.
 * @param {string} text
 */
export async function playAudioUltraSlow(text) {
  return playAudio(text, { speed: 'ultra-slow' });
}

/**
 * Plays a local audio file directly (e.g. user's own recorded WAV).
 * @param {string} filePath
 * @returns {Promise<{ played: boolean, reason?: string }>}
 */
export async function playAudioFile(filePath) {
  const player = detectPlayer();
  if (!player) {
    return { played: false, reason: 'No audio player detected.' };
  }

  return new Promise((resolve) => {
    exec(`${player.cmd} ${player.args} "${filePath}"`, (err) => {
      if (err) resolve({ played: false, reason: err.message });
      else resolve({ played: true });
    });
  });
}
