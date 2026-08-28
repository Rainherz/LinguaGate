import { select, confirm } from '@inquirer/prompts';

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
