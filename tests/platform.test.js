import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeCommand,
  hasBinary,
  audioPlayersFor,
  ttsEnginesFor,
  modelSearchDirs
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
});
