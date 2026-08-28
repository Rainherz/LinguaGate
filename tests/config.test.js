import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { loadConfig, saveConfig, updateConfig, resetConfig, DEFAULT_CONFIG } from '../src/services/config.js';

describe('Config Service (User Preferences & Settings)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'config-test-'));
    process.env.LINGUAGATE_DATA_DIR = tempDir;
  });

  afterEach(() => {
    delete process.env.LINGUAGATE_DATA_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('loadConfig returns default configuration when no file exists', () => {
    const config = loadConfig();
    assert.deepEqual(config, DEFAULT_CONFIG);
  });

  test('saveConfig persists custom configuration atomically', () => {
    /** @type {import('../src/services/config.js').UserConfig} */
    const custom = {
      userName: 'Polyglot',
      audioSpeed: 'slow',
      audioPlayer: 'ffplay',
      defaultDifficulty: 'advanced',
      soundEffects: false
    };

    saveConfig(custom);
    const loaded = loadConfig();
    assert.deepEqual(loaded, custom);
  });

  test('updateConfig merges partial changes without wiping other fields', () => {
    updateConfig({ userName: 'Master', audioSpeed: 'ultra-slow' });

    const loaded = loadConfig();
    assert.equal(loaded.userName, 'Master');
    assert.equal(loaded.audioSpeed, 'ultra-slow');
    assert.equal(loaded.audioPlayer, DEFAULT_CONFIG.audioPlayer);
    assert.equal(loaded.defaultDifficulty, DEFAULT_CONFIG.defaultDifficulty);
  });

  test('resetConfig restores all values back to DEFAULT_CONFIG', () => {
    updateConfig({ userName: 'Temporary', audioSpeed: 'ultra-slow' });
    assert.equal(loadConfig().userName, 'Temporary');

    const reset = resetConfig();
    assert.deepEqual(reset, DEFAULT_CONFIG);
    assert.deepEqual(loadConfig(), DEFAULT_CONFIG);
  });
});
