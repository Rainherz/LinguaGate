#!/usr/bin/env node
/**
 * Verifies the platform assumptions LinguaGate makes on the machine it runs on.
 *
 * Every per-OS decision — how binaries are looked up, which player and which
 * voice are chosen, where models live — was written against documentation on a
 * Linux box. This exercises them for real and reports what actually happened.
 *
 * Run with: node scripts/platform-check.js
 */
import { platform, tmpdir, homedir, release } from 'node:os';
import { join } from 'node:path';
import { existsSync, statSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

import {
  probeCommand,
  hasBinary,
  audioPlayersFor,
  ttsEnginesFor,
  modelSearchDirs,
  playableFormats
} from '../src/services/platform.js';
import { detectRecorderDriver } from '../src/services/recorder.js';
import { detectTtsEngine, synthesize, resetTtsCache } from '../src/services/tts.js';
import { detectTranscriberEngine, resetTranscriberCache } from '../src/services/transcriber.js';
import { playbackCommand } from '../src/services/audio.js';

const PASS = '  [ OK ]';
const FAIL = '  [FAIL]';
const INFO = '  [INFO]';
const WARN = '  [WARN]';

let failures = 0;

function heading(text) {
  console.log(`\n${'='.repeat(60)}\n${text}\n${'='.repeat(60)}`);
}

function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? PASS : FAIL} ${label}${detail ? ` — ${detail}` : ''}`);
}

function info(label, detail = '') {
  console.log(`${INFO} ${label}${detail ? ` — ${detail}` : ''}`);
}

heading('1. Environment');
info('platform', platform());
info('release', release());
info('node', process.version);
info('home', homedir());
info('binary probe', probeCommand());

heading('2. Binary lookup');
check('the probe finds node itself', hasBinary('node'), `via "${probeCommand()} node"`);
check('the probe rejects a nonsense name', !hasBinary('linguagate-not-real-xyz'));
for (const cmd of ['ffmpeg', 'ffplay', 'powershell', 'pwsh', 'afplay', 'say', 'espeak-ng', 'piper', 'whisper-cli', 'whisper']) {
  info(`${cmd.padEnd(12)} ${hasBinary(cmd) ? 'present' : 'not found'}`);
}

heading('3. Audio playback');
const players = audioPlayersFor();
info('candidates, best first', players.map((p) => p.cmd).join(' -> '));
const usablePlayer = players.find((p) => hasBinary(p.cmd));
check('at least one player is usable', Boolean(usablePlayer), usablePlayer?.cmd ?? 'none found');
if (usablePlayer) {
  info('command shape', playbackCommand(usablePlayer, usablePlayer.args, join(tmpdir(), 'sample file.wav')));
}

heading('4. Speech synthesis');
info('formats this machine can play', playableFormats().join(', ') || 'none');
resetTtsCache();
info('engines for this platform', ttsEnginesFor().join(' -> '));
const engine = detectTtsEngine({ ttsEngine: 'auto' });
check('an engine resolves', Boolean(engine), engine?.type ?? 'none');

for (const type of ttsEnginesFor()) {
  resetTtsCache();
  const probe = detectTtsEngine({ ttsEngine: type });
  info(`${type.padEnd(12)} ${probe ? 'available' : 'unavailable'}`);
}

const PHRASE = 'I want to schedule a technical meeting.';
// Google is included deliberately: it renders MP3 while the local engines
// render WAV, and a player that only handles one of them is a platform
// problem, not a network one. PowerShell's Media.SoundPlayer is WAV-only.
for (const type of ttsEnginesFor()) {
  resetTtsCache();
  if (!detectTtsEngine({ ttsEngine: type })) continue;

  const started = Date.now();
  const result = await synthesize(PHRASE, { speed: 'normal', config: { ttsEngine: type, ttsVoice: 'en-us' } });
  const ms = Date.now() - started;

  if (!result.success) {
    check(`${type} renders audio`, false, result.error);
    continue;
  }

  const bytes = existsSync(result.path) ? statSync(result.path).size : 0;
  check(`${type} renders audio`, bytes > 1000, `${bytes} bytes in ${ms}ms -> ${result.path}`);

  if (usablePlayer && bytes > 1000) {
    try {
      console.log(`${INFO} playing it now — you should hear a sentence`);
      execSync(playbackCommand(usablePlayer, usablePlayer.args, result.path), { stdio: 'ignore', timeout: 20000 });
      check(`${type} audio plays through ${usablePlayer.cmd}`, true);
    } catch (err) {
      const format = result.path.split('.').pop();
      check(
        `${type} audio plays through ${usablePlayer.cmd}`,
        false,
        `${err.message.split('\n')[0]} (format: .${format})`
      );
    }
  }
  rmSync(result.path, { force: true });
}

heading('5. Microphone');
const driver = detectRecorderDriver();
if (driver) {
  check('a recorder driver resolves', true, driver);
} else {
  // Recording is optional: the app falls back to a typed simulation and says so.
  console.log(`${WARN} no recorder — install ffmpeg to speak instead of typing (not a platform failure)`);
}

heading('6. Speech-to-text');
resetTranscriberCache();
const stt = detectTranscriberEngine({ sttEngine: 'auto' });
if (stt) {
  check('an STT engine resolves', true, `${stt.type}${stt.model ? ` with ${stt.model}` : ''}`);
} else {
  console.log(`${WARN} no STT engine — speaking scores will be self-reported (not a platform failure)`);
}
info('model directories searched', '');
for (const dir of modelSearchDirs('whisper')) {
  console.log(`         ${existsSync(dir) ? 'exists ' : 'missing'}  ${dir}`);
}

heading('Result');
if (failures === 0) {
  console.log('  Everything the platform layer promises on this machine holds.\n');
} else {
  console.log(`  ${failures} check(s) failed — paste this output to get them fixed.\n`);
}
process.exit(failures === 0 ? 0 : 1);
