import { resolveProviderName } from './ai/index.js';
import { detectTranscriberEngine } from './transcriber.js';
import { detectTtsEngine } from './tts.js';

/**
 * Describes which engines exist, which are usable, and which one the current
 * configuration actually resolves to.
 *
 * The settings screen needs more than the stored value: with `auto`, the saved
 * setting says nothing about what will run. An engine that is missing is
 * reported with the reason rather than hidden — that is how someone finds out
 * the capability exists and what installing it would buy them.
 *
 * @typedef {{ value: string, label: string, available: boolean, detail: string }} EngineOption
 * @typedef {{ selected: string, resolved: string|null, options: EngineOption[] }} EngineReport
 */

const option = (value, label, available, detail = '') => ({ value, label, available, detail });

/**
 * @param {{ aiProvider?: string }} config
 * @param {Record<string, string|undefined>} [env]
 * @returns {EngineReport}
 */
export function describeAiProviders(config = {}, env = process.env) {
  const selected = config.aiProvider || 'auto';
  const hasKey = Boolean(
    (env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim()) ||
    (env.ANTHROPIC_AUTH_TOKEN && env.ANTHROPIC_AUTH_TOKEN.trim())
  );
  const resolved = resolveProviderName(config, env);

  return {
    selected,
    resolved,
    options: [
      option('auto', 'Auto-detect', true, 'Direct API when a credential exists, otherwise the CLI'),
      option('agy', 'agy CLI', true, 'Agent harness — heavier per request, no API key needed'),
      option(
        'anthropic',
        'Claude API (direct)',
        hasKey,
        hasKey
          ? 'Single stateless completion — far fewer input tokens per exercise'
          : 'Set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN to enable'
      )
    ]
  };
}

/**
 * @param {{ sttEngine?: string, sttModel?: string }} config
 * @returns {EngineReport}
 */
export function describeSttEngines(config = {}) {
  const selected = config.sttEngine || 'auto';
  const resolvedEngine = detectTranscriberEngine(config);
  const whisperCpp = detectTranscriberEngine({ ...config, sttEngine: 'whisper-cpp' });
  const openaiWhisper = detectTranscriberEngine({ ...config, sttEngine: 'openai-whisper' });

  return {
    selected,
    resolved: resolvedEngine?.type ?? null,
    options: [
      option('auto', 'Auto-detect', true, 'Use whichever engine is installed'),
      option(
        'whisper-cpp',
        'whisper.cpp (local)',
        Boolean(whisperCpp),
        whisperCpp
          ? `Ready — model ${whisperCpp.model.split('/').pop()}`
          : 'Install whisper-cpp and place a ggml-*.bin model in ~/.local/share/whisper'
      ),
      option(
        'openai-whisper',
        'openai-whisper (local)',
        Boolean(openaiWhisper),
        openaiWhisper ? 'Ready' : 'Install with: pip install openai-whisper'
      ),
      option('off', 'Off', true, 'Speaking scores become self-reported instead of measured')
    ]
  };
}

/**
 * @param {{ ttsEngine?: string, ttsVoice?: string, ttsModel?: string }} config
 * @returns {EngineReport}
 */
export function describeTtsEngines(config = {}) {
  const selected = config.ttsEngine || 'auto';
  const resolvedEngine = detectTtsEngine(config);
  const piper = detectTtsEngine({ ...config, ttsEngine: 'piper' });
  const espeak = detectTtsEngine({ ...config, ttsEngine: 'espeak-ng' });

  return {
    selected,
    resolved: resolvedEngine?.type ?? null,
    options: [
      option('auto', 'Auto-detect', true, 'Best available voice, quality first'),
      option(
        'piper',
        'piper (local, natural)',
        Boolean(piper),
        piper
          ? `Ready — voice ${piper.model.split('/').pop()}`
          : 'pip install piper-tts, then put a .onnx voice in ~/.local/share/piper'
      ),
      option('google', 'Google Translate TTS', true, 'Natural voice, but needs an internet connection'),
      option(
        'espeak-ng',
        'espeak-ng (local, robotic)',
        Boolean(espeak),
        espeak
          ? 'Ready — formant synthesis; do not shadow its prosody'
          : 'Install espeak-ng'
      ),
      option('off', 'Off', true, 'No reference audio')
    ]
  };
}
