import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { loadConfig, saveConfig, updateConfig, resetConfig, getGreeting, DEFAULT_CONFIG } from '../src/services/config.js';

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
    assert.strictEqual(config.onboarded, false);
  });

  test('saveConfig persists custom configuration atomically', () => {
    /** @type {import('../src/services/config.js').UserConfig} */
    const custom = {
      userName: 'Polyglot',
      audioSpeed: 'slow',
      audioPlayer: 'ffplay',
      aiProvider: 'auto',
      aiModel: '',
      defaultDifficulty: 'advanced',
      soundEffects: false,
      dailyGoalXp: 100,
      onboarded: true
    };

    saveConfig(custom);
    const loaded = loadConfig();
    // loadConfig merges over DEFAULT_CONFIG, so assert the round-trip of the
    // saved values rather than the exact key set of the defaults.
    assert.deepEqual(loaded, { ...DEFAULT_CONFIG, ...custom });
  });

  test('updateConfig merges partial changes without wiping other fields', () => {
    updateConfig({ userName: 'Master', audioSpeed: 'ultra-slow', onboarded: true });

    const loaded = loadConfig();
    assert.equal(loaded.userName, 'Master');
    assert.equal(loaded.audioSpeed, 'ultra-slow');
    assert.equal(loaded.onboarded, true);
    assert.equal(loaded.audioPlayer, DEFAULT_CONFIG.audioPlayer);
    assert.equal(loaded.defaultDifficulty, DEFAULT_CONFIG.defaultDifficulty);
  });

  test('resetConfig restores all values back to DEFAULT_CONFIG', () => {
    updateConfig({ userName: 'Temporary', audioSpeed: 'ultra-slow', onboarded: true });
    assert.equal(loadConfig().userName, 'Temporary');

    const reset = resetConfig();
    assert.deepEqual(reset, DEFAULT_CONFIG);
    assert.deepEqual(loadConfig(), DEFAULT_CONFIG);
  });

  test('getGreeting personalizes greeting by time of day', () => {
    const morning = new Date(2026, 0, 1, 9, 0);
    assert.ok(getGreeting('Rain', morning).includes('Good morning, Rain!'));

    const afternoon = new Date(2026, 0, 1, 15, 0);
    assert.ok(getGreeting('Rain', afternoon).includes('Good afternoon, Rain!'));

    const evening = new Date(2026, 0, 1, 21, 0);
    assert.ok(getGreeting('Rain', evening).includes('Good evening, Rain!'));

    const defaultName = getGreeting('', morning);
    assert.ok(defaultName.includes('Good morning, Learner!'));
  });
});
