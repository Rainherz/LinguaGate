import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Platform capability map.
 *
 * The probe and the candidate lists were duplicated across audio.js,
 * recorder.js, tts.js and transcriber.js, each with its own idea of how to look
 * a binary up — audio.js hardcoded `which`, so on Windows every lookup threw
 * and the app silently decided it had no way to play sound at all.
 */

/**
 * @param {NodeJS.Platform | string} [platform]
 * @returns {'where' | 'which'}
 */
export function probeCommand(platform = process.platform) {
  return platform === 'win32' ? 'where' : 'which';
}

/**
 * @param {string} cmd
 * @returns {boolean}
 */
export function hasBinary(cmd) {
  if (!cmd) return false;
  try {
    execSync(`${probeCommand()} ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * What each synthesis engine writes.
 *
 * This matters because players are not interchangeable: PowerShell's
 * Media.SoundPlayer and aplay handle WAV only, mpg123 handles MP3 only. A bare
 * Windows box proved it — `auto` picked Google, which renders MP3, and the only
 * available player could not play it, so the learner got silence.
 */
export const ENGINE_FORMATS = {
  piper: 'wav',
  say: 'aiff',
  google: 'mp3',
  sapi: 'wav',
  'espeak-ng': 'wav'
};

const ALL_FORMATS = ['wav', 'mp3', 'aiff'];

const FFPLAY = {
  type: 'ffplay',
  cmd: 'ffplay',
  args: '-nodisp -autoexit -loglevel quiet',
  formats: ALL_FORMATS
};

/**
 * Audio players worth trying, best first.
 *
 * afplay and PowerShell ship with their operating systems, so they are listed
 * ahead of tools the learner would have to install. aplay is ALSA and exists
 * only on Linux.
 * @param {NodeJS.Platform | string} [platform]
 * @returns {Array<{ type: string, cmd: string, args: string, formats: string[] }>}
 */
export function audioPlayersFor(platform = process.platform) {
  if (platform === 'darwin') {
    return [{ type: 'afplay', cmd: 'afplay', args: '', formats: ALL_FORMATS }, FFPLAY];
  }

  if (platform === 'win32') {
    return [
      FFPLAY,
      {
        type: 'powershell',
        cmd: 'powershell',
        args: '-NoProfile -Command',
        // Media.SoundPlayer is WAV only.
        formats: ['wav']
      }
    ];
  }

  return [
    FFPLAY,
    { type: 'mpg123', cmd: 'mpg123', args: '-q', formats: ['mp3'] },
    { type: 'aplay', cmd: 'aplay', args: '-q', formats: ['wav'] }
  ];
}

/**
 * Formats the players actually installed on this machine can play.
 * @param {NodeJS.Platform | string} [platform]
 * @param {(cmd: string) => boolean} [probe] injectable for tests
 * @returns {string[]}
 */
export function playableFormats(platform = process.platform, probe = hasBinary) {
  const formats = new Set();
  for (const player of audioPlayersFor(platform)) {
    if (probe(player.cmd)) player.formats.forEach((f) => formats.add(f));
  }
  return [...formats];
}

/**
 * Speech synthesis engines available on a platform, ordered by voice quality.
 *
 * The ordering is deliberate and survives per platform: this app is used for
 * shadowing, so an audibly robotic engine must never outrank a natural one.
 * @param {NodeJS.Platform | string} [platform]
 * @returns {string[]}
 */
export function ttsEnginesFor(platform = process.platform) {
  if (platform === 'darwin') return ['piper', 'say', 'google', 'espeak-ng'];
  if (platform === 'win32') return ['piper', 'google', 'sapi', 'espeak-ng'];
  return ['piper', 'google', 'espeak-ng'];
}

/**
 * Where to look for local model files.
 * @param {'whisper' | 'piper'} kind
 * @param {NodeJS.Platform | string} [platform]
 * @returns {string[]}
 */
export function modelSearchDirs(kind, platform = process.platform) {
  const home = homedir();

  if (platform === 'win32') {
    const appData = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local');
    return [join(appData, kind), join(home, `.${kind}`), join(home, kind)];
  }

  if (platform === 'darwin') {
    return [
      join(home, 'Library', 'Application Support', kind),
      join(home, '.local', 'share', kind),
      join('/opt/homebrew/share', kind),
      join('/usr/local/share', kind)
    ];
  }

  const shared = kind === 'whisper'
    ? ['/usr/share/whisper.cpp/models', '/usr/share/whisper', '/opt/whisper.cpp/models']
    : ['/usr/share/piper-voices', '/usr/share/piper'];

  return [
    join(home, '.local/share', kind),
    join(home, '.cache', kind),
    join(home, `${kind}.cpp/models`),
    ...shared
  ];
}
