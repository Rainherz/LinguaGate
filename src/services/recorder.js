import { spawn, execSync } from 'node:child_process';
import { join } from 'node:path';
import { getDataDir } from './storage.js';
import { existsSync, mkdirSync } from 'node:fs';

function getSpeechCacheDir() {
  const dir = join(getDataDir(), 'cache/speech');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

let cachedRecorder = null;

/**
 * Detects the best available audio recording driver on the system.
 * @returns {'ffmpeg-pulse' | 'ffmpeg-alsa' | 'ffmpeg-dshow' | 'ffmpeg-avfoundation' | 'arecord' | null}
 */
export function detectRecorderDriver() {
  if (cachedRecorder !== null) return cachedRecorder;

  const platform = process.platform;

  if (platform === 'linux') {
    try {
      execSync('which ffmpeg', { stdio: 'ignore' });
      cachedRecorder = 'ffmpeg-pulse';
      return cachedRecorder;
    } catch {
      try {
        execSync('which arecord', { stdio: 'ignore' });
        cachedRecorder = 'arecord';
        return cachedRecorder;
      } catch {
        cachedRecorder = null;
        return null;
      }
    }
  }

  if (platform === 'win32') {
    try {
      execSync('where ffmpeg', { stdio: 'ignore' });
      cachedRecorder = 'ffmpeg-dshow';
      return cachedRecorder;
    } catch {
      cachedRecorder = null;
      return null;
    }
  }

  if (platform === 'darwin') {
    try {
      execSync('which ffmpeg', { stdio: 'ignore' });
      cachedRecorder = 'ffmpeg-avfoundation';
      return cachedRecorder;
    } catch {
      cachedRecorder = null;
      return null;
    }
  }

  return null;
}

/**
 * Checks if audio recording is supported on this machine.
 * @returns {boolean}
 */
export function isRecorderAvailable() {
  return detectRecorderDriver() !== null;
}

/**
 * Starts recording audio to the specified WAV file.
 * @param {string} [customPath]
 * @returns {{ stop: () => Promise<{ durationSec: number, path: string, success: boolean, error?: string }> }}
 */
export function startRecording(customPath) {
  const driver = detectRecorderDriver();
  const outputPath = customPath || join(getSpeechCacheDir(), `recording_${Date.now()}.wav`);
  const startTime = Date.now();

  if (!driver) {
    return {
      stop: async () => ({
        durationSec: 0,
        path: outputPath,
        success: false,
        error: 'No compatible microphone recording binary found (install ffmpeg or arecord).'
      })
    };
  }

  let cmd = 'ffmpeg';
  let args = [];

  if (driver === 'ffmpeg-pulse') {
    args = ['-y', '-f', 'pulse', '-i', 'default', '-ar', '16000', '-ac', '1', outputPath];
  } else if (driver === 'ffmpeg-alsa') {
    args = ['-y', '-f', 'alsa', '-i', 'default', '-ar', '16000', '-ac', '1', outputPath];
  } else if (driver === 'ffmpeg-dshow') {
    args = ['-y', '-f', 'dshow', '-i', 'audio=default', '-ar', '16000', '-ac', '1', outputPath];
  } else if (driver === 'ffmpeg-avfoundation') {
    args = ['-y', '-f', 'avfoundation', '-i', ':0', '-ar', '16000', '-ac', '1', outputPath];
  } else if (driver === 'arecord') {
    cmd = 'arecord';
    args = ['-q', '-f', 'S16_LE', '-r', '16000', '-c', '1', outputPath];
  }

  const child = spawn(cmd, args, { stdio: 'ignore' });

  return {
    stop: () =>
      new Promise((resolve) => {
        const durationSec = Math.max(0.5, (Date.now() - startTime) / 1000);

        child.on('close', () => {
          resolve({
            durationSec: Number(durationSec.toFixed(2)),
            path: outputPath,
            success: true
          });
        });

        // Terminate gracefully
        child.kill('SIGINT');

        // Force kill if stuck after 1.5s
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
            resolve({
              durationSec: Number(durationSec.toFixed(2)),
              path: outputPath,
              success: true
            });
          }
        }, 1500);
      })
  };
}
