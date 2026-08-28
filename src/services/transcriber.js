import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { tmpdir, homedir, cpus } from 'node:os';
import { loadConfig } from './config.js';

const TRANSCRIBE_TIMEOUT_MS = 120_000;

/**
 * Matches a non-speech annotation emitted by Whisper on silence or background
 * noise, e.g. "[BLANK_AUDIO]", "[Music]", "(wind blowing)".
 * Kept non-global so `.test()` stays stateless; a global clone is used to strip.
 */
export const NON_SPEECH_PATTERN = /[[(][^\])]*[\])]/;

/**
 * Phrases Whisper models hallucinate when fed silence or background noise.
 * Verified locally: a 2s silent 16kHz WAV made whisper.cpp v1.9.1 emit "You".
 * Without this guard a learner who records nothing still gets scored.
 */
export const SILENCE_ARTIFACTS = [
  '',
  'you',
  'thank you',
  'thank you very much',
  'thanks for watching',
  'thank you for watching',
  'please subscribe',
  'bye',
  'okay',
  'oh',
  'so',
  'the',
  'yeah'
];

/**
 * Reports whether a transcript is entirely a known silence hallucination.
 * Only whole-transcript matches count, so real sentences containing these
 * words (e.g. "Thank you for reviewing my PR") are never discarded.
 * @param {string} text
 * @returns {boolean}
 */
export function isSilenceArtifact(text) {
  const normalized = normalizeTranscript(text)
    .toLowerCase()
    .replace(/[.,!?;:¡¿"'♪-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return SILENCE_ARTIFACTS.includes(normalized);
}

const WHISPER_CPP_BINARIES = ['whisper-cli', 'whisper-cpp'];
const OPENAI_WHISPER_BINARY = 'whisper';

const MODEL_SEARCH_DIRS = [
  join(homedir(), '.local/share/whisper'),
  join(homedir(), '.cache/whisper'),
  join(homedir(), 'whisper.cpp/models'),
  '/usr/share/whisper.cpp/models',
  '/usr/share/whisper',
  '/opt/whisper.cpp/models'
];

let cachedEngine;

/** Clears the memoised engine probe. Intended for tests and settings changes. */
export function resetTranscriberCache() {
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
 * Converts a Whisper "hh:mm:ss.mmm" stamp into float seconds.
 * @param {string} stamp
 * @returns {number}
 */
export function parseTimestamp(stamp) {
  const match = /^(\d+):(\d{2}):(\d{2})\.(\d{1,3})$/.exec(String(stamp ?? '').trim());
  if (!match) return 0;

  const [, hours, minutes, seconds, millis] = match;
  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(millis.padEnd(3, '0')) / 1000
  );
}

/**
 * Collapses internal whitespace and trims the edges of a transcript.
 * @param {string} text
 * @returns {string}
 */
export function normalizeTranscript(text) {
  if (!text) return '';
  return String(text).replace(/\s+/g, ' ').trim();
}

function stripNonSpeech(text) {
  return normalizeTranscript(
    String(text ?? '').replace(new RegExp(NON_SPEECH_PATTERN.source, 'g'), ' ')
  );
}

/**
 * Parses whisper.cpp stdout into a transcript plus timed segments,
 * discarding log noise and non-speech annotations.
 * @param {string} raw
 * @returns {{ text: string, segments: Array<{ start: number, end: number, text: string }> }}
 */
export function parseWhisperCppOutput(raw) {
  if (!raw) return { text: '', segments: [] };

  const lineRe = /^\[\s*([\d:.]+)\s*-->\s*([\d:.]+)\s*\]\s*(.*)$/;
  const segments = [];

  for (const line of String(raw).split(/\r?\n/)) {
    const match = lineRe.exec(line.trim());
    if (!match) continue;

    const [, start, end, body] = match;
    const text = stripNonSpeech(body);
    if (!text) continue;

    segments.push({ start: parseTimestamp(start), end: parseTimestamp(end), text });
  }

  return { text: segments.map((s) => s.text).join(' '), segments };
}

/**
 * Measures the span actually containing speech, so WPM is not diluted by the
 * silence between pressing record and starting to talk.
 * @param {Array<{ start: number, end: number, text?: string }>} segments
 * @returns {number} seconds, or 0 when unknown
 */
export function computeSpeechDuration(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return 0;

  const start = Math.min(...segments.map((s) => s.start));
  const end = Math.max(...segments.map((s) => s.end));
  const span = end - start;

  return span > 0 ? Number(span.toFixed(2)) : 0;
}

/** Whisper emits control tokens like [_BEG_] and [_TT_184]; they are not speech. */
const SPECIAL_TOKEN = /^\[_[A-Z]+_?\d*\]$/;

/**
 * Groups whisper's subword tokens into whole words.
 *
 * A token beginning with a space starts a new word; the rest continue the
 * current one ("\u0020back" + "-" + "end" -> "back-end"). A word is scored by its
 * WEAKEST token: if any piece of it was acoustically ambiguous, that is the
 * part the listener struggled with, and averaging would hide it.
 *
 * @param {Array<{ text: string, p?: number }>} tokens
 * @returns {Array<{ word: string, probability: number }>}
 */
export function groupTokensIntoWords(tokens) {
  if (!Array.isArray(tokens)) return [];

  /** @type {Array<{ word: string, probability: number }>} */
  const words = [];

  for (const token of tokens) {
    const raw = String(token?.text ?? '');
    if (!raw || SPECIAL_TOKEN.test(raw.trim())) continue;

    const probability = typeof token.p === 'number' ? token.p : 1;
    const startsWord = raw.startsWith(' ') || words.length === 0;
    const piece = raw.trim();
    if (!piece) continue;

    if (startsWord) {
      words.push({ word: piece, probability });
    } else {
      const current = words[words.length - 1];
      current.word += piece;
      current.probability = Math.min(current.probability, probability);
    }
  }

  return words;
}

/**
 * Bands a token probability into a label the scorecard can act on.
 * Clean articulation lands above 0.9 in practice; below 0.6 the recognizer
 * was genuinely unsure of what it heard.
 * @param {number} probability
 * @returns {'clear' | 'borderline' | 'unclear'}
 */
export function classifyClarity(probability) {
  if (probability >= 0.85) return 'clear';
  if (probability >= 0.6) return 'borderline';
  return 'unclear';
}

/**
 * Mean per-word acoustic confidence, as a 0-100 score.
 * Unlike the AI examiner's stress scores, this is derived from the audio.
 * @param {Array<{ word?: string, probability: number }>} words
 * @returns {number}
 */
export function computeClarityScore(words) {
  if (!Array.isArray(words) || words.length === 0) return 0;

  const total = words.reduce((sum, w) => sum + (typeof w.probability === 'number' ? w.probability : 0), 0);
  return Math.round((total / words.length) * 100);
}

/**
 * Parses the payload written by `whisper-cli --output-json-full`.
 * @param {{ transcription?: Array<{ offsets?: { from?: number, to?: number }, text?: string, tokens?: Array<{ text: string, p?: number }> }> }} payload
 * @returns {{ text: string, segments: Array<{ start: number, end: number, text: string }>, words: Array<{ word: string, probability: number }> }}
 */
export function parseWhisperJson(payload) {
  const entries = Array.isArray(payload?.transcription) ? payload.transcription : [];

  const segments = [];
  const words = [];

  for (const entry of entries) {
    const text = stripNonSpeech(entry?.text);
    if (!text) continue;

    segments.push({
      start: Number(((entry?.offsets?.from ?? 0) / 1000).toFixed(3)),
      end: Number(((entry?.offsets?.to ?? 0) / 1000).toFixed(3)),
      text
    });
    words.push(...groupTokensIntoWords(entry?.tokens));
  }

  return { text: segments.map((s) => s.text).join(' '), segments, words };
}

/**
 * Builds whisper.cpp CLI arguments.
 * Uses --output-json-full because only that format carries per-token
 * probabilities, which is what makes the clarity score a measurement.
 * @param {string} modelPath
 * @param {string} wavPath
 * @param {string} outPrefix path prefix for the JSON side-car (no extension)
 * @returns {string[]}
 */
export function buildWhisperCppArgs(modelPath, wavPath, outPrefix) {
  return [
    '-m', modelPath,
    '-f', wavPath,
    '-l', 'en',
    '--output-json-full',
    '-of', outPrefix,
    '--no-prints',
    '--threads', String(Math.max(2, Math.min(8, cpus().length || 4)))
  ];
}

/**
 * Builds openai-whisper CLI arguments writing a .txt next to the given output dir.
 * @param {string} wavPath
 * @param {string} outputDir
 * @param {string} model
 * @returns {string[]}
 */
export function buildOpenAiWhisperArgs(wavPath, outputDir, model) {
  return [
    wavPath,
    '--model', model,
    '--language', 'en',
    '--output_format', 'txt',
    '--output_dir', outputDir,
    '--fp16', 'False',
    '--verbose', 'False'
  ];
}

function findWhisperCppModel(configured) {
  if (configured && existsSync(configured)) return configured;
  if (process.env.WHISPER_MODEL && existsSync(process.env.WHISPER_MODEL)) {
    return process.env.WHISPER_MODEL;
  }

  for (const dir of MODEL_SEARCH_DIRS) {
    if (!existsSync(dir)) continue;
    try {
      const candidates = readdirSync(dir)
        .filter((f) => f.startsWith('ggml-') && f.endsWith('.bin'))
        .sort();
      if (candidates.length > 0) return join(dir, candidates[0]);
    } catch {
      // unreadable dir — keep searching
    }
  }

  return null;
}

/**
 * Probes the machine for a usable speech-to-text engine.
 * @param {{ sttEngine?: string, sttModel?: string }} [config]
 * @returns {{ type: 'whisper-cpp' | 'openai-whisper', cmd: string, model: string } | null}
 */
export function detectTranscriberEngine(config) {
  const cfg = config ?? loadConfig();
  if (cfg.sttEngine === 'off') return null;

  if (config === undefined && cachedEngine !== undefined) return cachedEngine;

  const preference = cfg.sttEngine && cfg.sttEngine !== 'auto' ? cfg.sttEngine : null;
  let resolved = null;

  if (!preference || preference === 'whisper-cpp') {
    for (const cmd of WHISPER_CPP_BINARIES) {
      if (!hasBinary(cmd)) continue;
      const model = findWhisperCppModel(cfg.sttModel);
      if (model) {
        resolved = { type: 'whisper-cpp', cmd, model };
        break;
      }
    }
  }

  if (!resolved && (!preference || preference === 'openai-whisper')) {
    if (hasBinary(OPENAI_WHISPER_BINARY)) {
      resolved = {
        type: 'openai-whisper',
        cmd: OPENAI_WHISPER_BINARY,
        model: cfg.sttModel || 'base.en'
      };
    }
  }

  if (config === undefined) cachedEngine = resolved;
  return resolved;
}

/**
 * @param {{ sttEngine?: string, sttModel?: string }} [config]
 * @returns {boolean}
 */
export function isTranscriptionAvailable(config) {
  return detectTranscriberEngine(config) !== null;
}

function runProcess(cmd, args) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let child;

    try {
      child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      resolve({ ok: false, stdout: '', stderr: err.message });
      return;
    }

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ ok: false, stdout, stderr: 'Transcription timed out.' });
    }, TRANSCRIBE_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: err.message });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr });
    });
  });
}

function emptyResult(error, engine = null) {
  return { success: false, text: '', segments: [], words: [], clarityScore: 0, speechDurationSec: 0, engine, error };
}

/**
 * Transcribes a 16kHz mono WAV recording into text using a local engine.
 * Never throws: transport and engine failures come back as `success: false`.
 * @param {string} wavPath
 * @param {{ config?: object }} [options]
 * @returns {Promise<{ success: boolean, text: string, segments: Array<{start:number,end:number,text:string}>, words: Array<{word:string,probability:number}>, clarityScore: number, speechDurationSec: number, engine: string|null, error?: string }>}
 */
export async function transcribeAudio(wavPath, options = {}) {
  const engine = detectTranscriberEngine(options.config);
  if (!engine) {
    return emptyResult(
      'No local speech-to-text engine available (install whisper.cpp with a ggml model, or openai-whisper).'
    );
  }

  if (!wavPath || !existsSync(wavPath)) {
    return emptyResult(`Recording not found at ${wavPath}`, engine.type);
  }

  if (engine.type === 'whisper-cpp') {
    const jsonDir = mkdtempSync(join(tmpdir(), 'linguagate-whisper-'));
    const prefix = join(jsonDir, 'result');

    try {
      const { ok, stdout, stderr } = await runProcess(
        engine.cmd,
        buildWhisperCppArgs(engine.model, wavPath, prefix)
      );
      if (!ok) return emptyResult(normalizeTranscript(stderr) || 'whisper.cpp failed.', engine.type);

      // Full JSON is the primary path; stdout parsing covers builds that
      // do not support --output-json-full.
      let parsed;
      const jsonPath = `${prefix}.json`;
      if (existsSync(jsonPath)) {
        try {
          parsed = parseWhisperJson(JSON.parse(readFileSync(jsonPath, 'utf-8')));
        } catch {
          parsed = undefined;
        }
      }
      if (!parsed) {
        parsed = { ...parseWhisperCppOutput(stdout), words: [] };
      }

      if (isSilenceArtifact(parsed.text)) {
        return emptyResult('No speech detected in the recording.', engine.type);
      }

      return {
        success: true,
        text: parsed.text,
        segments: parsed.segments,
        words: parsed.words,
        clarityScore: computeClarityScore(parsed.words),
        speechDurationSec: computeSpeechDuration(parsed.segments),
        engine: engine.type
      };
    } finally {
      rmSync(jsonDir, { recursive: true, force: true });
    }
  }

  const outDir = mkdtempSync(join(tmpdir(), 'linguagate-stt-'));
  try {
    const { ok, stderr } = await runProcess(
      engine.cmd,
      buildOpenAiWhisperArgs(wavPath, outDir, engine.model)
    );
    if (!ok) return emptyResult(normalizeTranscript(stderr) || 'whisper failed.', engine.type);

    const txtPath = join(outDir, `${basename(wavPath, extname(wavPath))}.txt`);
    if (!existsSync(txtPath)) return emptyResult('Transcript file was not produced.', engine.type);

    const text = stripNonSpeech(readFileSync(txtPath, 'utf-8'));
    if (isSilenceArtifact(text)) {
      return emptyResult('No speech detected in the recording.', engine.type);
    }

    return { success: true, text, segments: [], words: [], clarityScore: 0, speechDurationSec: 0, engine: engine.type };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}
