import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { setInputSource, resetInputSource } from '../../src/ui/prompt.js';
import { createScriptedInput } from '../../src/ui/scripted-input.js';
import { loadConfig, DEFAULT_CONFIG } from '../../src/services/config.js';
import { runSettings } from '../../src/modes/settings.js';

describe('Settings mode', () => {
  let tempDir;
  let silenced;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'settings-mode-'));
    process.env.LINGUAGATE_DATA_DIR = tempDir;

    silenced = [console.log, console.error, console.clear];
    console.log = () => {};
    console.error = () => {};
    console.clear = () => {};
  });

  afterEach(() => {
    [console.log, console.error, console.clear] = silenced;
    resetInputSource();
    delete process.env.LINGUAGATE_DATA_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('the engine surfaces added this session are reachable from the menu', async () => {
    const scripted = createScriptedInput(['BACK']);
    setInputSource(scripted);

    await runSettings();

    const values = scripted.calls[0].config.choices.map((c) => c.value);
    for (const surface of ['AI', 'STT', 'TTS']) {
      assert.ok(values.includes(surface), `settings must expose ${surface}, got ${values}`);
    }
  });

  test('picking an AI provider persists it', async () => {
    setInputSource(createScriptedInput(['AI', 'anthropic', 'BACK']));
    await runSettings();

    assert.strictEqual(loadConfig().aiProvider, 'anthropic');
  });

  test('picking an STT engine persists it', async () => {
    setInputSource(createScriptedInput(['STT', 'off', 'BACK']));
    await runSettings();

    assert.strictEqual(loadConfig().sttEngine, 'off');
  });

  test('picking a voice engine persists it', async () => {
    setInputSource(createScriptedInput(['TTS', 'espeak-ng', 'BACK']));
    await runSettings();

    assert.strictEqual(loadConfig().ttsEngine, 'espeak-ng');
  });

  test('cancelling leaves the setting untouched', async () => {
    setInputSource(createScriptedInput(['TTS', 'CANCEL', 'BACK']));
    await runSettings();

    assert.strictEqual(loadConfig().ttsEngine, DEFAULT_CONFIG.ttsEngine);
  });

  test('unavailable engines are listed with a reason rather than hidden', async () => {
    const scripted = createScriptedInput(['STT', 'CANCEL', 'BACK']);
    setInputSource(scripted);

    await runSettings();

    const sttMenu = scripted.calls.find((c) => c.config.message?.includes('speech-to-text'));
    assert.ok(sttMenu, 'the STT submenu should have been shown');

    const values = sttMenu.config.choices.map((c) => c.value);
    assert.deepStrictEqual(values, ['auto', 'whisper-cpp', 'openai-whisper', 'off', 'CANCEL']);
    // Every engine row carries its status line, installed or not.
    for (const choice of sttMenu.config.choices) {
      if (choice.value !== 'CANCEL') assert.match(choice.name, /✔|✖/);
    }
  });

  test('resetting restores every engine default', async () => {
    setInputSource(createScriptedInput(['TTS', 'espeak-ng', 'RESET', true, 'BACK']));
    await runSettings();

    const config = loadConfig();
    assert.strictEqual(config.ttsEngine, DEFAULT_CONFIG.ttsEngine);
    assert.strictEqual(config.aiProvider, DEFAULT_CONFIG.aiProvider);
    assert.strictEqual(config.sttEngine, DEFAULT_CONFIG.sttEngine);
  });
});
