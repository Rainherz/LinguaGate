/**
 * The AI port: the only surface the domain is allowed to know about.
 * Adapters live in ./adapters and are selected in ./index.js — no module
 * outside this directory may import a vendor SDK or spawn a vendor binary.
 */

/** Raised when a provider's answer cannot be trusted as the requested shape. */
export class SchemaValidationError extends Error {
  /**
   * @param {string} message
   * @param {{ raw?: string }} [details]
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'SchemaValidationError';
    this.raw = details.raw;
  }
}

/**
 * Pulls a JSON object out of a model response, tolerating code fences and
 * surrounding prose. Brace matching is string-aware so a "}" inside a value
 * does not truncate the object.
 * @param {string} raw
 * @returns {Record<string, any>}
 */
export function extractJson(raw) {
  const text = String(raw ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  if (!text) throw new SchemaValidationError('Provider returned an empty response.', { raw });

  try {
    return JSON.parse(text);
  } catch {
    // fall through to brace scanning
  }

  const start = text.indexOf('{');
  if (start === -1) {
    throw new SchemaValidationError('Provider response contained no JSON object.', { raw });
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          throw new SchemaValidationError('Provider response held malformed JSON.', { raw });
        }
      }
    }
  }

  throw new SchemaValidationError('Provider response held an unterminated JSON object.', { raw });
}

function typeOf(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

/**
 * Validates the subset of JSON Schema this project actually uses:
 * required keys and top-level property types.
 * @param {unknown} value
 * @param {{ required?: string[], properties?: Record<string, { type?: string }> }} schema
 * @returns {Record<string, any>}
 */
export function validateAgainstSchema(value, schema) {
  if (typeOf(value) !== 'object') {
    throw new SchemaValidationError(`Expected a JSON object, received ${typeOf(value)}.`);
  }

  const record = /** @type {Record<string, unknown>} */ (value);

  for (const key of schema?.required ?? []) {
    if (!(key in record)) {
      throw new SchemaValidationError(`Missing required field "${key}" in provider response.`);
    }
  }

  for (const [key, spec] of Object.entries(schema?.properties ?? {})) {
    if (!(key in record) || spec?.type === undefined) continue;

    const actual = typeOf(record[key]);
    const expected = spec.type === 'integer' ? 'number' : spec.type;
    if (actual !== expected) {
      throw new SchemaValidationError(
        `Field "${key}" should be ${expected} but the provider sent ${actual}.`
      );
    }
  }

  return /** @type {Record<string, any>} */ (record);
}

/**
 * @typedef {object} AiProvider
 * @property {string} name
 * @property {(req: { prompt: string, schema?: object }) => Promise<{ text?: string, data?: unknown }>} complete
 */

/** @type {AiProvider | null} */
let activeProvider = null;

/**
 * Overrides the resolved provider. Used by tests and by settings changes.
 * @param {AiProvider} provider
 */
export function setProvider(provider) {
  activeProvider = provider;
}

/** Drops the override so the next call re-resolves from config. */
export function resetProvider() {
  activeProvider = null;
}

async function resolveProvider() {
  if (activeProvider) return activeProvider;
  const { getProvider } = await import('./index.js');
  activeProvider = /** @type {AiProvider} */ (await getProvider());
  return activeProvider;
}

/**
 * Asks the active provider for free-form text.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
export async function askText(prompt) {
  const provider = await resolveProvider();
  const { text } = await provider.complete({ prompt });
  return String(text ?? '').trim();
}

/**
 * Asks the active provider for an object matching `schema`.
 * Providers that support native structured output return `data` directly;
 * the rest are parsed from text and retried once on a malformed answer.
 *
 * The return type is inferred from the caller's declared shape, so domain
 * functions in tutor.js keep precise types without casting at every site.
 * @template {Record<string, any>} T
 * @param {string} prompt
 * @param {object} schema
 * @returns {Promise<T>}
 */
export async function askJson(prompt, schema) {
  const provider = await resolveProvider();
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    // Provider errors are transport failures, not shape failures — never retried here.
    const response = await provider.complete({ prompt, schema });

    try {
      if (response.data !== undefined) {
        return /** @type {T} */ (validateAgainstSchema(response.data, schema));
      }
      return /** @type {T} */ (validateAgainstSchema(extractJson(response.text), schema));
    } catch (err) {
      if (!(err instanceof SchemaValidationError)) throw err;
      lastError = err;
    }
  }

  throw lastError;
}
