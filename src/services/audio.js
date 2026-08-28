import { exec, execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '../../data/cache/audio');

let detectedPlayer = null;
function detectPlayer() {
  if (detectedPlayer) return detectedPlayer;
  const candidates = [
    { type: 'ffplay', cmd: 'ffplay', args: '-nodisp -autoexit -loglevel quiet' },
    { type: 'mpg123', cmd: 'mpg123', args: '-q' },
    { type: 'aplay', cmd: 'aplay', args: '-q' }
  ];

  for (const c of candidates) {
    try {
      execSync(`which ${c.cmd}`, { stdio: 'ignore' });
      detectedPlayer = c;
      return detectedPlayer;
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
 */
export async function playAudio(text, { speed = 'normal' } = {}) {
  const player = detectPlayer();
  if (!player) {
    return { played: false, reason: 'No audio player detected.' };
  }

  try {
    const filePath = await fetchAndCacheAudio(text);

    let speedArgs = player.args;
    if (player.type === 'ffplay') {
      if (speed === 'slow') {
        speedArgs += ' -af "atempo=0.7"';
      } else if (speed === 'ultra') {
        speedArgs += ' -af "atempo=0.5,atempo=0.8"';
      }
    } else if (player.type === 'mpg123') {
      if (speed === 'slow') {
        speedArgs += ' --pitch -0.3';
      } else if (speed === 'ultra') {
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
