import { exec, execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadConfig } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '../../data/cache/audio');

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

async function fetchAndCacheAudio(text) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  const hash = createHash('md5').update(text).digest('hex');
  const filePath = join(CACHE_DIR, `${hash}.mp3`);

  if (existsSync(filePath)) {
    return filePath;
  }

  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(
    text.slice(0, 180)
  )}&ttsspeed=1`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)'
    }
  });

  if (!res.ok) {
    throw new Error(`TTS download failed (status ${res.status})`);
  }

  const arrayBuffer = await res.arrayBuffer();
  writeFileSync(filePath, Buffer.from(arrayBuffer));
  return filePath;
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

  try {
    const filePath = await fetchAndCacheAudio(text);

    let speedArgs = player.args;
    if (player.type === 'ffplay') {
      if (activeSpeed === 'slow') {
        speedArgs += ' -af "atempo=0.7"';
      } else if (activeSpeed === 'ultra' || activeSpeed === 'ultra-slow') {
        speedArgs += ' -af "atempo=0.5,atempo=0.8"';
      }
    } else if (player.type === 'mpg123') {
      if (activeSpeed === 'slow') {
        speedArgs += ' --pitch -0.3';
      } else if (activeSpeed === 'ultra' || activeSpeed === 'ultra-slow') {
        speedArgs += ' --pitch -0.5';
      }
    }

    return new Promise((resolve) => {
      exec(`${player.cmd} ${speedArgs} "${filePath}"`, (err) => {
        if (err) {
          resolve({ played: false, reason: err.message });
        } else {
          resolve({ played: true });
        }
      });
    });
  } catch (err) {
    return { played: false, reason: err.message };
  }
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
