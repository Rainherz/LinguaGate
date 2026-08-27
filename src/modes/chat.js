import readline from 'node:readline';
import ora from 'ora';
import chalk from 'chalk';
import { checkGrammar, chatReply } from '../services/agy.js';
import { recordError, updateStreak } from '../services/history.js';
import { printError, printSuccess, printBotReply, printStreak } from '../ui/display.js';

export async function runChat(stats) {
  console.log(chalk.gray('\n  💬 Free Chat mode — type anything, grammar gate active.'));
  console.log(chalk.gray('  Type /quit to exit.\n'));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  await new Promise((resolve) => {
    const ask = () => {
      rl.question(chalk.bold.green('  You › '), async (input) => {
        const text = input.trim();
        if (!text) return ask();
        if (text === '/quit') { rl.close(); return resolve(); }

        const spinner = ora({ text: 'Checking grammar...', color: 'yellow', indent: 2 }).start();
        try {
          const result = checkGrammar(text);
          if (result.isCorrect) {
            spinner.succeed(chalk.green('Grammar looks good! ✓'));
            spinner.start('Thinking...');
            const reply = chatReply(text);
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
            result.corrections?.forEach((c) => recordError(c, text, result.correctedText));
          }
        } catch (err) {
          spinner.fail(chalk.red('Something went wrong.'));
          console.error(chalk.red(`  ${err.message}\n`));
        }
        ask();
      });
    };
    ask();
  });
}
