/**
 * In-memory provider for tests. Records every call so a test can assert on the
 * prompt and schema the domain actually sent.
 * @param {{ text?: string, json?: object, structured?: object, sequence?: string[], error?: Error }} script
 */
export function createFakeProvider(script = {}) {
  const calls = [];

  return {
    name: 'fake',
    calls,
    async complete({ prompt, schema }) {
      calls.push({ prompt, schema });

      if (script.error) throw script.error;
      if (script.structured !== undefined) return { data: script.structured };
      if (script.sequence) return { text: script.sequence[calls.length - 1] ?? '' };
      if (script.json !== undefined) return { text: JSON.stringify(script.json) };
      return { text: script.text ?? '' };
    }
  };
}
