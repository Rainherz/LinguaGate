import { exec } from 'node:child_process';
import { loadConfig } from './config.js';
import { synthesize } from './tts.js';
import { hasBinary, audioPlayersFor } from './platform.js';

/**
 * Playback only. Rendering a phrase to audio now lives in tts.js, so the
 * engine that speaks and the program that plays are chosen independently.
 */

function candidates() {
  return Object.fromEntries(audioPlayersFor().map((p) => [p.type, p]));
}

function detectPlayer() {
  const config = loadConfig();
  if (config.audioPlayer === 'muted') return null;

  const available = candidates();

  if (config.audioPlayer && config.audioPlayer !== 'auto' && available[config.audioPlayer]) {
    if (hasBinary(available[config.audioPlayer].cmd)) return available[config.audioPlayer];
    // Fall through to auto-detection rather than leaving the learner in silence.
  }

  for (const c of Object.values(available)) {
    if (hasBinary(c.cmd)) return c;
  }
  return null;
}

/**
 * Builds the shell command for a player.
 * Most players take the file as a trailing argument; the Windows fallback needs
 * a PowerShell one-liner instead, so the shape cannot be shared.
 * @param {{ type: string, cmd: string, args: string }} player
 * @param {string} args
 * @param {string} filePath
 * @returns {string}
 */
export function playbackCommand(player, args, filePath) {
  if (player.type === 'powershell') {
    const escaped = filePath.replace(/'/g, "''");
    return `${player.cmd} ${player.args} "(New-Object Media.SoundPlayer '${escaped}').PlaySync()"`;
  }
  return `${player.cmd} ${args} "${filePath}"`.replace(/\s+/g, ' ').trim();
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
    exec(playbackCommand(player, speedArgs, rendered.path), (err) => {
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
    exec(playbackCommand(player, player.args, filePath), (err) => {
      if (err) resolve({ played: false, reason: err.message });
      else resolve({ played: true });
    });
  });
}
