import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-opus-5';
const MAX_TOKENS = 4096;

/**
 * Adapter for direct Claude inference via the official SDK.
 *
 * Unlike the agy adapter this issues a single stateless completion: no agent
 * harness, no tool/plugin/MCP preamble, no multi-turn loop. Measured on this
 * project's grammar-check prompt, agy billed 28,030 input tokens per call
 * against roughly 150 here, for the same model and the same account.
 *
 * @param {{ apiKey?: string, model?: string }} [options]
 */
export function createAnthropicProvider(options = {}) {
  const client = options.apiKey ? new Anthropic({ apiKey: options.apiKey }) : new Anthropic();
  const model = options.model || DEFAULT_MODEL;

  return {
    name: 'anthropic',
    model,
    async complete({ prompt, schema }) {
      // Structured outputs: the API constrains the response to this schema,
      // so the answer needs no fence stripping or brace scanning.
      const response = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
        ...(schema
          ? { output_config: { format: { type: /** @type {'json_schema'} */ ('json_schema'), schema } } }
          : {})
      });

      if (response.stop_reason === 'refusal') {
        throw new Error('The model declined to answer this request.');
      }

      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();

      return { text };
    }
  };
}
