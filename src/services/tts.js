import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { getDataDir } from './storage.js';
import { loadConfig } from './config.js';

const SYNTH_TIMEOUT_MS = 60_000;
const DEFAULT_VOICE = 'en-us';

/**
 * Engines ordered by output quality, deliberately not by availability.
 *
 * This app is used for shadowing: a learner imitates the reference voice. Since
 * espeak-ng is formant synthesis and audibly robotic, ranking it above a
 * natural-sounding engine would teach the wrong prosody. It is a fallback for
 * when nothing better exists, not a preference.
 */
const ENGINE_ORDER = ['piper', 'google', 'espeak-ng'];

const PIPER_MODEL_DIRS = [
  join(homedir(), '.local/share/piper'),
  join(homedir(), '.local/share/piper-voices'),
  '/usr/share/piper-voices'
];

let cachedEngine;

/** Selectable engine names, best output first. */
export function listTtsEngines() {
  return [...ENGINE_ORDER];
}

/** Clears the memoised engine probe. */
export function resetTtsCache() {
  cachedEngine = undefined;
}

function hasBinary(cmd) {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  try {
    execSync(`${probe} ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Maps the app's speed names to a speaking rate.
 * Local engines change the rate at synthesis time, which preserves pitch —
 * unlike time-stretching an already-rendered clip during playback.
 * @param {string} speed
 * @returns {number} words per minute
 */
export function speedToWpm(speed) {
  if (speed === 'slow') return 110;
  if (speed === 'ultra' || speed === 'ultra-slow') return 80;
  return 160;
}

/**
 * @param {string} text
 * @param {string} outPath
 * @param {{ voice?: string, wpm?: number }} options
 * @returns {string[]}
 */
export function buildEspeakArgs(text, outPath, options = {}) {
  return [
    '-v', options.voice || DEFAULT_VOICE,
    '-s', String(options.wpm ?? 160),
    '-w', outPath,
    // Last, and as a single argv entry: the phrase never reaches a shell.
    text
  ];
}

/**
 * @param {string} modelPath
 * @param {string} outPath
 * @returns {string[]}
 */
export function buildPiperArgs(modelPath, outPath) {
  return ['--model', modelPath, '--output_file', outPath];
}

/**
 * Identity of a rendered clip.
 * Engine, speed and voice are part of the key: the previous cache hashed the
 * text alone, so two engines would collide and a learner could be served a
 * robotic clip cached under a natural voice.
 * @returns {string}
 */
export function cacheKeyFor(text, engine, speed, voice) {
  return createHash('md5')
    .update(`${engine}|${speed}|${voice}|${text}`)
    .digest('hex');
}

function findPiperModel(configured) {
  if (configured && existsSync(configured)) return configured;
  if (process.env.PIPER_MODEL && existsSync(process.env.PIPER_MODEL)) return process.env.PIPER_MODEL;

  for (const dir of PIPER_MODEL_DIRS) {
    if (!existsSync(dir)) continue;
    try {
      const found = readdirSync(dir).filter((f) => f.endsWith('.onnx')).sort();
      if (found.length > 0) return join(dir, found[0]);
    } catch {
      // unreadable dir — keep looking
    }
  }
  return null;
}

function buildEngine(type, cfg) {
  if (type === 'piper') {
    if (!hasBinary('piper')) return null;
    const model = findPiperModel(cfg.ttsModel);
    return model ? { type: 'piper', cmd: 'piper', model, voice: cfg.ttsVoice || DEFAULT_VOICE } : null;
  }

  if (type === 'espeak-ng') {
    const cmd = hasBinary('espeak-ng') ? 'espeak-ng' : hasBinary('espeak') ? 'espeak' : null;
    return cmd ? { type: 'espeak-ng', cmd, voice: cfg.ttsVoice || DEFAULT_VOICE } : null;
  }

  if (type === 'google') {
    return { type: 'google', cmd: null, voice: cfg.ttsVoice || DEFAULT_VOICE };
  }

  return null;
}

/**
 * Picks the synthesis engine. Explicit config wins; otherwise the first
 * available engine in quality order.
 * @param {{ ttsEngine?: string, ttsVoice?: string, ttsModel?: string }} [config]
 */
export function detectTtsEngine(config) {
  const cfg = config ?? loadConfig();
  if (cfg.ttsEngine === 'off') return null;

  if (config === undefined && cachedEngine !== undefined) return cachedEngine;

  let resolved = null;
  if (cfg.ttsEngine && cfg.ttsEngine !== 'auto') {
    resolved = buildEngine(cfg.ttsEngine, cfg);
  } else {
    for (const type of ENGINE_ORDER) {
      resolved = buildEngine(type, cfg);
      if (resolved) break;
    }
  }

  if (config === undefined) cachedEngine = resolved;
  return resolved;
}

function getCacheDir() {
  const dir = join(getDataDir(), 'cache/audio');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function run(cmd, args, stdin) {
  return new Promise((resolve) => {
    let stderr = '';
    let child;
    try {
      child = spawn(cmd, args, { stdio: [stdin === undefined ? 'ignore' : 'pipe', 'ignore', 'pipe'] });
    } catch (err) {
      resolve({ ok: false, stderr: err.message });
      return;
    }

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ ok: false, stderr: 'Speech synthesis timed out.' });
    }, SYNTH_TIMEOUT_MS);

    child.stderr.on('data', (c) => { stderr += c.toString(); });
    child.on('error', (err) => { clearTimeout(timer); resolve({ ok: false, stderr: err.message }); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stderr });
    });

    if (stdin !== undefined) {
      child.stdin.end(stdin);
    }
  });
}

async function fetchGoogle(text, outPath) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(
    text.slice(0, 180)
  )}&ttsspeed=1`;

  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' } });
  if (!res.ok) throw new Error(`TTS download failed (status ${res.status})`);

  writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
}

function failure(error, engine = null) {
  return { success: false, path: null, engine, error };
}

/**
 * Renders a phrase to a cached audio file.
 * Never throws: engine and transport failures come back as `success: false`.
 * @param {string} text
 * @param {{ speed?: string, config?: object }} [options]
 * @returns {Promise<{ success: boolean, path: string|null, engine: string|null, cached?: boolean, error?: string }>}
 */
export async function synthesize(text, options = {}) {
  const phrase = String(text ?? '').trim();
  if (!phrase) return failure('Nothing to speak.');

  const engine = detectTtsEngine(options.config);
  if (!engine) return failure('No speech synthesis engine available.');

  const speed = options.speed || 'normal';
  const key = cacheKeyFor(phrase, engine.type, speed, engine.voice);
  const extension = engine.type === 'google' ? 'mp3' : 'wav';
  const outPath = join(getCacheDir(), `${key}.${extension}`);

  if (existsSync(outPath)) {
    return { success: true, path: outPath, engine: engine.type, cached: true };
  }

  try {
    if (engine.type === 'google') {
      await fetchGoogle(phrase, outPath);
    } else if (engine.type === 'espeak-ng') {
      const { ok, stderr } = await run(
        engine.cmd,
        buildEspeakArgs(phrase, outPath, { voice: engine.voice, wpm: speedToWpm(speed) })
      );
      if (!ok) return failure(stderr.trim() || 'espeak-ng failed.', engine.type);
    } else if (engine.type === 'piper') {
      const { ok, stderr } = await run(engine.cmd, buildPiperArgs(engine.model, outPath), phrase);
      if (!ok) return failure(stderr.trim() || 'piper failed.', engine.type);
    }
  } catch (err) {
    return failure(err.message, engine.type);
  }

  if (!existsSync(outPath)) return failure('Engine produced no audio file.', engine.type);
  return { success: true, path: outPath, engine: engine.type, cached: false };
}
