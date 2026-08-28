import ora from 'ora';
import chalk from 'chalk';
import { checkGrammar, chatReply } from '../services/tutor.js';
import { recordError, updateStreak } from '../services/history.js';
import { clearScreen, printAppHeader, printError, printBotReply, printStreak } from '../ui/display.js';
import { safeInput } from '../ui/prompt.js';

export async function runChat(stats) {
  clearScreen();
  printAppHeader('Free Chat (Grammar Gate)');
  console.log(chalk.gray('  Type anything in English. Type /quit or press Esc to exit.\n'));

  let running = true;
  while (running) {
    const input = (await safeInput({ message: 'You ›' })).trim();
    if (!input) continue;
    if (input === '/quit' || input.toLowerCase() === 'exit') break;

    const spinner = ora({ text: 'Checking grammar...', color: 'yellow', indent: 2 }).start();
    try {
      const result = await checkGrammar(input);
      if (result.isCorrect) {
        spinner.succeed(chalk.green('Grammar looks good! ✓'));
        spinner.start('Thinking...');
        const reply = await chatReply(input);
        spinner.stop();
        printBotReply(reply);
        const streak = updateStreak(true);
        printStreak(streak);
        stats.recordCorrect();
      } else {
        spinner.fail(chalk.red('Grammar error.'));
        printError(result);
        updateStreak(false);
        stats.recordIncorrect(result.corrections?.[0] ?? 'grammar error');
        result.corrections?.forEach((c) => recordError(c, input, result.correctedText));
      }
    } catch (err) {
      spinner.fail(chalk.red('Something went wrong.'));
      console.error(chalk.red(`  ${err.message}\n`));
    }
  }
}
