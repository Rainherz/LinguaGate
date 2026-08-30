import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeCommand,
  hasBinary,
  audioPlayersFor,
  ttsEnginesFor,
  modelSearchDirs,
  playableFormats,
  ENGINE_FORMATS
} from '../src/services/platform.js';

describe('Platform capabilities', () => {
  describe('probeCommand', () => {
    test('uses where on Windows and which elsewhere', () => {
      assert.strictEqual(probeCommand('win32'), 'where');
      assert.strictEqual(probeCommand('darwin'), 'which');
      assert.strictEqual(probeCommand('linux'), 'which');
      assert.strictEqual(probeCommand('freebsd'), 'which');
    });
  });

  describe('hasBinary', () => {
    test('finds a binary that certainly exists', () => {
      assert.strictEqual(hasBinary('node'), true);
    });

    test('reports a missing binary as false rather than throwing', () => {
      assert.strictEqual(hasBinary('definitely-not-a-real-binary-xyz'), false);
    });

    test('an empty name is never reported as present', () => {
      assert.strictEqual(hasBinary(''), false);
      assert.strictEqual(hasBinary(undefined), false);
    });
  });

  describe('audioPlayersFor', () => {
    test('macOS leads with afplay, which ships with the OS', () => {
      const players = audioPlayersFor('darwin').map((p) => p.cmd);
      assert.strictEqual(players[0], 'afplay');
      assert.ok(players.includes('ffplay'));
    });

    test('Windows offers ffplay and the built-in PowerShell player', () => {
      const players = audioPlayersFor('win32').map((p) => p.cmd);
      assert.ok(players.includes('ffplay'));
      assert.ok(players.includes('powershell'));
    });

    test('Linux keeps ffplay, mpg123 and aplay', () => {
      const players = audioPlayersFor('linux').map((p) => p.cmd);
      assert.deepStrictEqual(players, ['ffplay', 'mpg123', 'aplay']);
    });

    test('aplay is never offered off Linux — it is ALSA only', () => {
      for (const platform of ['darwin', 'win32']) {
        assert.ok(
          !audioPlayersFor(platform).some((p) => p.cmd === 'aplay'),
          `aplay must not be offered on ${platform}`
        );
      }
    });

    test('every player declares a command and its arguments', () => {
      for (const platform of ['linux', 'darwin', 'win32']) {
        for (const player of audioPlayersFor(platform)) {
          assert.ok(player.type && player.cmd);
          assert.strictEqual(typeof player.args, 'string');
        }
      }
    });
  });

  describe('ttsEnginesFor', () => {
    test('macOS exposes its built-in say voice ahead of the network', () => {
      const engines = ttsEnginesFor('darwin');
      assert.ok(engines.includes('say'));
      assert.ok(engines.indexOf('say') < engines.indexOf('google'));
    });

    test('Windows exposes SAPI', () => {
      assert.ok(ttsEnginesFor('win32').includes('sapi'));
    });

    test('piper always outranks the network, on every platform', () => {
      for (const platform of ['linux', 'darwin', 'win32']) {
        const engines = ttsEnginesFor(platform);
        assert.ok(engines.indexOf('piper') < engines.indexOf('google'), platform);
      }
    });

    test('a robotic fallback never outranks a natural voice', () => {
      // espeak-ng is formant synthesis; shadowing it teaches wrong prosody.
      const linux = ttsEnginesFor('linux');
      assert.ok(linux.indexOf('google') < linux.indexOf('espeak-ng'));
    });

    test('platform-native engines are not offered where they do not exist', () => {
      assert.ok(!ttsEnginesFor('linux').includes('say'));
      assert.ok(!ttsEnginesFor('linux').includes('sapi'));
      assert.ok(!ttsEnginesFor('darwin').includes('sapi'));
    });
  });

  describe('modelSearchDirs', () => {
    test('returns platform-appropriate locations under the user home', () => {
      for (const platform of ['linux', 'darwin', 'win32']) {
        const dirs = modelSearchDirs('whisper', platform);
        assert.ok(dirs.length > 0);
        assert.ok(dirs.every((d) => typeof d === 'string' && d.length > 0));
      }
    });

    test('POSIX system paths are not offered on Windows', () => {
      const dirs = modelSearchDirs('whisper', 'win32');
      assert.ok(!dirs.some((d) => d.startsWith('/usr') || d.startsWith('/opt')));
    });

    test('Linux keeps the shared system locations', () => {
      const dirs = modelSearchDirs('whisper', 'linux');
      assert.ok(dirs.some((d) => d.startsWith('/usr')));
    });
  });

  describe('playback formats', () => {
    test('every player declares which formats it can actually play', () => {
      for (const platform of ['linux', 'darwin', 'win32']) {
        for (const player of audioPlayersFor(platform)) {
          assert.ok(Array.isArray(player.formats) && player.formats.length > 0,
            `${player.cmd} on ${platform} must declare formats`);
        }
      }
    });

    test('the built-in Windows player is WAV only', () => {
      const ps = audioPlayersFor('win32').find((p) => p.cmd === 'powershell');
      assert.deepStrictEqual(ps.formats, ['wav']);
    });

    test('aplay is WAV only and mpg123 is MP3 only', () => {
      const linux = audioPlayersFor('linux');
      assert.deepStrictEqual(linux.find((p) => p.cmd === 'aplay').formats, ['wav']);
      assert.deepStrictEqual(linux.find((p) => p.cmd === 'mpg123').formats, ['mp3']);
    });

    test('ffplay and afplay handle everything the engines produce', () => {
      const ffplay = audioPlayersFor('linux').find((p) => p.cmd === 'ffplay');
      for (const format of Object.values(ENGINE_FORMATS)) {
        assert.ok(ffplay.formats.includes(format), `ffplay should play .${format}`);
      }
    });

    test('every synthesis engine declares its output format', () => {
      for (const engine of ['piper', 'google', 'say', 'sapi', 'espeak-ng']) {
        assert.ok(ENGINE_FORMATS[engine], `${engine} must declare an output format`);
      }
      assert.strictEqual(ENGINE_FORMATS.google, 'mp3');
      assert.strictEqual(ENGINE_FORMATS.sapi, 'wav');
    });

    test('playableFormats reports what the available players can handle', () => {
      const formats = playableFormats();
      assert.ok(Array.isArray(formats));
      // No player installed means nothing is playable, which is a valid answer.
      for (const f of formats) assert.ok(typeof f === 'string');
    });

    test('a WAV-only player makes MP3 unplayable', () => {
      const formats = playableFormats('win32', (cmd) => cmd === 'powershell');
      assert.deepStrictEqual(formats, ['wav']);
    });

    test('an MP3-only player makes WAV unplayable', () => {
      const formats = playableFormats('linux', (cmd) => cmd === 'mpg123');
      assert.deepStrictEqual(formats, ['mp3']);
    });

    test('with ffplay present everything is playable', () => {
      const formats = playableFormats('linux', (cmd) => cmd === 'ffplay');
      assert.ok(formats.includes('wav') && formats.includes('mp3'));
    });

    test('no player at all yields nothing playable', () => {
      assert.deepStrictEqual(playableFormats('linux', () => false), []);
    });
  });
});
