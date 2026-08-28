import readline from 'node:readline';
import ora from 'ora';
import chalk from 'chalk';
import { getSpanishPhrase } from '../services/agy.js';
import { evaluateTranslationExercise } from '../services/evaluator.js';
import { clearScreen, printAppHeader, printStreak, printDivider } from '../ui/display.js';
import { ask } from '../ui/prompt.js';

export async function runTranslate(stats, difficulty) {
  clearScreen();
  printAppHeader(`Translate (${difficulty.toUpperCase()})`);
  console.log(chalk.gray('  Translate the Spanish phrase to natural English. Type /quit to exit.\n'));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let running = true;
  while (running) {
    const spinner = ora({ text: 'Getting a phrase...', color: 'cyan', indent: 2 }).start();
    let phrase;
    try {
      phrase = getSpanishPhrase(difficulty);
      spinner.stop();
    } catch (err) {
      spinner.fail('Could not load phrase.');
      console.error(chalk.red(`  ${err.message}\n`));
      break;
    }

    const res = await evaluateTranslationExercise({
      spanish: phrase.spanish,
      expectedEnglish: phrase.english,
      hint: phrase.hint,
      grammarRule: 'Translation Practice',
      stats,
      rl
    });

    printDivider();
    const again = (await ask(rl, chalk.gray('  Next phrase? (y/n) › '))).trim().toLowerCase();
    if (again !== 'y') running = false;
  }

  rl.close();
}
