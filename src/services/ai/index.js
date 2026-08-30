import { loadConfig } from '../config.js';
import { hasBinary } from '../platform.js';
import { createAgyProvider } from './adapters/agy-cli.js';
import { createAnthropicProvider } from './adapters/anthropic.js';

const SELECTABLE = ['auto', 'agy', 'anthropic'];

let cached = null;

/** Selectable values for the settings screen. */
export function listProviders() {
  return [...SELECTABLE];
}

/** Drops the memoised provider so the next call re-resolves. */
export function resetProviderCache() {
  cached = null;
}

function hasAnthropicCredential(env) {
  return Boolean(
    (env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim()) ||
    (env.ANTHROPIC_AUTH_TOKEN && env.ANTHROPIC_AUTH_TOKEN.trim())
  );
}

/**
 * Decides which adapter to use. Explicit config wins; otherwise direct Claude
 * is preferred when a credential exists, since routing through the agy agent
 * harness costs ~28k input tokens per exercise versus ~150 for direct inference.
 * @param {{ aiProvider?: string }} config
 * @param {Record<string, string|undefined>} env
 * @returns {'agy' | 'anthropic'}
 */
export function resolveProviderName(config = {}, env = process.env) {
  const preference = config.aiProvider;
  if (preference === 'agy' || preference === 'anthropic') return preference;
  return hasAnthropicCredential(env) ? 'anthropic' : 'agy';
}

/**
 * Whether a provider could actually run here.
 * @param {string} name
 * @param {Record<string, string|undefined>} [env]
 * @param {(cmd: string) => boolean} [probe] injectable for tests
 * @returns {boolean}
 */
export function isProviderAvailable(name, env = process.env, probe = hasBinary) {
  if (name === 'anthropic') return hasAnthropicCredential(env);
  if (name === 'agy') return probe('agy');
  return false;
}

/**
 * Explains why no AI provider can run, or null when one can.
 *
 * This is the one capability the app cannot degrade around: every mode needs a
 * provider to generate an exercise. Left unchecked it surfaces as
 * `spawn agy ENOENT` the first time a learner picks a mode, which says nothing
 * about what to do.
 * @param {{ aiProvider?: string }} [config]
 * @param {Record<string, string|undefined>} [env]
 * @param {(cmd: string) => boolean} [probe]
 * @returns {string | null}
 */
export function describeProviderGap(config = {}, env = process.env, probe = hasBinary) {
  const resolved = resolveProviderName(config, env);
  if (isProviderAvailable(resolved, env, probe)) return null;

  if (config.aiProvider === 'anthropic') {
    return 'The Claude API is selected but no credential is set. Export ANTHROPIC_API_KEY, or switch the AI provider in Settings.';
  }
  if (config.aiProvider === 'agy') {
    return 'The agy CLI is selected but not installed. Install it, or switch the AI provider in Settings.';
  }

  return (
    'No AI provider is available, so exercises cannot be generated. ' +
    'Either export ANTHROPIC_API_KEY to use the Claude API directly, or install the agy CLI. ' +
    'Choose one in Settings once it is ready.'
  );
}

/**
 * Builds (and memoises) the active provider.
 * @returns {Promise<import('./port.js').AiProvider>}
 */
export async function getProvider() {
  if (cached) return cached;

  const config = loadConfig();
  const name = resolveProviderName(config, process.env);

  cached = name === 'anthropic'
    ? createAnthropicProvider({ model: config.aiModel || undefined })
    : createAgyProvider();

  return cached;
}
