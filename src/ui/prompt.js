import { select, confirm, input } from '@inquirer/prompts';

/**
 * Swappable input source. Defaults to the real inquirer prompts; tests inject
 * a scripted queue so interactive modes can be driven without a terminal.
 * @type {{ input: Function, select: Function, confirm: Function } | null}
 */
let inputSource = null;

/** @param {{ input: Function, select: Function, confirm: Function }} source */
export function setInputSource(source) {
  inputSource = source;
}

/** Restores the real inquirer prompts. */
export function resetInputSource() {
  inputSource = null;
}

export async function safeSelect(config) {
  try {
    return await (inputSource ? inputSource.select(config) : select(config));
  } catch (err) {
    if (
      err?.name === 'ExitPromptError' ||
      err?.name === 'AbortPromptError' ||
      err?.message?.includes('force closed')
    ) {
      return 'BACK';
    }
    throw err;
  }
}

export async function safeConfirm(config) {
  try {
    return await (inputSource ? inputSource.confirm(config) : confirm(config));
  } catch (err) {
    if (
      err?.name === 'ExitPromptError' ||
      err?.name === 'AbortPromptError' ||
      err?.message?.includes('force closed')
    ) {
      return false;
    }
    throw err;
  }
}

export async function safeInput(config) {
  try {
    return await (inputSource ? inputSource.input(config) : input(config));
  } catch (err) {
    if (
      err?.name === 'ExitPromptError' ||
      err?.name === 'AbortPromptError' ||
      err?.message?.includes('force closed')
    ) {
      return '/quit';
    }
    throw err;
  }
}

// Backward-compatibility fallback if any legacy caller passes (rl, message)
export async function ask(rl, message) {
  return await safeInput({ message: typeof message === 'string' ? message : '› ' });
}
