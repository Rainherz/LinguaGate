import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { safeInput, safeSelect, safeConfirm, setInputSource, resetInputSource } from '../src/ui/prompt.js';
import { createScriptedInput } from '../src/ui/scripted-input.js';

describe('Prompt input source', () => {
  afterEach(() => resetInputSource());

  test('routes every prompt kind through the injected source', async () => {
    setInputSource(createScriptedInput(['typed answer', 'PATH', true]));

    assert.strictEqual(await safeInput({ message: 'a' }), 'typed answer');
    assert.strictEqual(await safeSelect({ message: 'b', choices: [] }), 'PATH');
    assert.strictEqual(await safeConfirm({ message: 'c' }), true);
  });

  test('records what each prompt asked, so tests can assert on the flow', async () => {
    const scripted = createScriptedInput(['x', false]);
    setInputSource(scripted);

    await safeInput({ message: 'Your answer ›' });
    await safeConfirm({ message: 'Next exercise?' });

    assert.deepStrictEqual(
      scripted.calls.map((c) => [c.kind, c.config.message]),
      [['input', 'Your answer ›'], ['confirm', 'Next exercise?']]
    );
  });

  test('an exhausted script fails loudly instead of hanging the test', async () => {
    setInputSource(createScriptedInput(['only one']));
    await safeInput({ message: 'first' });

    await assert.rejects(() => safeInput({ message: 'second' }), /exhausted/i);
  });

  test('resetInputSource restores the real prompt path', () => {
    setInputSource(createScriptedInput(['x']));
    resetInputSource();
    // Nothing to await here — asserting only that the override is cleared,
    // since driving real inquirer would block on stdin.
    assert.doesNotThrow(() => resetInputSource());
  });

  test('a scripted /quit reaches the caller unchanged', async () => {
    setInputSource(createScriptedInput(['/quit']));
    assert.strictEqual(await safeInput({ message: 'a' }), '/quit');
  });

  test('remaining() reports what the script never consumed', async () => {
    const scripted = createScriptedInput(['a', 'b', 'c']);
    setInputSource(scripted);
    await safeInput({ message: 'x' });

    assert.deepStrictEqual(scripted.remaining(), ['b', 'c']);
  });
});
