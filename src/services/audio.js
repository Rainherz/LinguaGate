import { exec, execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '../../data/cache/audio');

// Detect available player once
let detectedPlayer = null;
function detectPlayer() {
  if (detectedPlayer) return detectedPlayer;
  const candidates = [
    { cmd: 'mpg123', args: '-q' },
    { cmd: 'ffplay', args: '-nodisp -autoexit -loglevel quiet' },
    { cmd: 'paplay', args: '' },
    { cmd: 'aplay', args: '-q' }
  ];

  for (const c of candidates) {
    try {
      execSync(`which ${c.cmd}`, { stdio: 'ignore' });
      detectedPlayer = c;
      return detectedPlayer;
    } catch {
      // not found, continue
    }
  }
  return null;
}

export function isAudioSupported() {
  return detectPlayer() !== null;
}

/**
 * Downloads TTS MP3 from Google Translate TTS CDN and caches to disk.
 */
async function fetchAndCacheAudio(text, isSlow = false) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  const hash = createHash('md5')
    .update(`${text}_${isSlow ? 'slow' : 'normal'}`)
    .digest('hex');
  const filePath = join(CACHE_DIR, `${hash}.mp3`);

  if (existsSync(filePath)) {
    return filePath;
  }

  // Google TTS URL
  const speed = isSlow ? '0.24' : '1';
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(
    text.slice(0, 180)
  )}&ttsspeed=${speed}`;

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
 * Plays the spoken audio of the given text in the background.
 */
export async function playAudio(text, { isSlow = false } = {}) {
  const player = detectPlayer();
  if (!player) {
    return { played: false, reason: 'No compatible audio player (mpg123/ffplay) detected.' };
  }

  try {
    const filePath = await fetchAndCacheAudio(text, isSlow);
    return new Promise((resolve) => {
      exec(`${player.cmd} ${player.args} "${filePath}"`, (err) => {
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
