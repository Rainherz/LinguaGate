/**
 * A queue-backed input source for tests, mirroring the fake AI provider.
 *
 * Modes are interactive: without a seam here, nothing above the services layer
 * could be exercised without a terminal. Answers are consumed in order and
 * every prompt is recorded so a test can assert on the flow, not just the
 * outcome.
 *
 * @param {unknown[]} script answers, in the order they are consumed. A select can
 *   return any value, so this is deliberately unconstrained.
 */
export function createScriptedInput(script = []) {
  const queue = [...script];
  const calls = [];

  const next = (kind, config) => {
    calls.push({ kind, config });
    if (queue.length === 0) {
      throw new Error(
        `Scripted input exhausted: "${config?.message ?? kind}" asked for answer #${calls.length}, ` +
        `but the script only had ${script.length}.`
      );
    }
    return queue.shift();
  };

  return {
    calls,
    remaining: () => [...queue],
    async input(config) {
      return String(next('input', config) ?? '');
    },
    async select(config) {
      return next('select', config);
    },
    async confirm(config) {
      return Boolean(next('confirm', config));
    }
  };
}
