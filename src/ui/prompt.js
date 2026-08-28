import { select, confirm, input } from '@inquirer/prompts';

export async function safeSelect(config) {
  try {
    return await select(config);
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
    return await confirm(config);
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
    return await input(config);
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
