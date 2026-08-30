import { resolveProviderName, isProviderAvailable } from './ai/index.js';
import { detectTranscriberEngine } from './transcriber.js';
import { detectTtsEngine, listTtsEngines, isEnginePlayable } from './tts.js';
import { playableFormats, ENGINE_FORMATS } from './platform.js';

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
      option(
        'agy',
        'agy CLI',
        isProviderAvailable('agy', env),
        isProviderAvailable('agy', env)
          ? 'Agent harness — heavier per request, no API key needed'
          : 'Not installed — install the agy CLI to use it'
      ),
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

  const DETAILS = {
    piper: (probe) => probe
      ? `Ready — voice ${probe.model.split(/[\\/]/).pop()}`
      : 'pip install piper-tts, then add a .onnx voice to the model folder',
    google: () => 'Natural voice, but needs an internet connection',
    say: (probe) => probe ? 'Ready — built into macOS' : 'Only available on macOS',
    sapi: (probe) => probe ? 'Ready — built into Windows' : 'Only available on Windows',
    'espeak-ng': (probe) => probe
      ? 'Ready — formant synthesis; do not shadow its prosody'
      : 'Install espeak-ng'
  };

  const LABELS = {
    piper: 'piper (local, natural)',
    google: 'Google Translate TTS',
    say: 'macOS say (local, natural)',
    sapi: 'Windows SAPI (local)',
    'espeak-ng': 'espeak-ng (local, robotic)'
  };

  // Only the engines this platform can actually run are offered; listing
  // macOS say on Linux would be noise, not a discoverable capability.
  const formats = playableFormats();
  const engineOptions = listTtsEngines().map((type) => {
    const probe = type === 'google' ? { type } : detectTtsEngine({ ...config, ttsEngine: type });
    const playable = isEnginePlayable(type, formats);

    // An engine that renders a format no installed player understands is
    // reported as unusable with the reason, not silently ranked and ignored.
    if (probe && !playable) {
      return option(
        type,
        LABELS[type] || type,
        false,
        `Renders .${ENGINE_FORMATS[type]}, which no installed player can play — install ffmpeg`
      );
    }

    return option(type, LABELS[type] || type, Boolean(probe), DETAILS[type]?.(probe) ?? '');
  });

  return {
    selected,
    resolved: resolvedEngine?.type ?? null,
    options: [
      option('auto', 'Auto-detect', true, 'Best available voice, quality first'),
      ...engineOptions,
      option('off', 'Off', true, 'No reference audio')
    ]
  };
}

