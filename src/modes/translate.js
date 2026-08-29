import ora from 'ora';
import chalk from 'chalk';
import { getSpanishPhrase } from '../services/tutor.js';
import { evaluateTranslationExercise } from './shared/exercises.js';
import { clearScreen, printAppHeader, printDivider } from '../ui/display.js';
import { safeConfirm } from '../ui/prompt.js';

export async function runTranslate(stats, difficulty) {
  clearScreen();
  printAppHeader(`Translate (${difficulty.toUpperCase()})`);
  console.log(chalk.gray('  Translate the Spanish phrase to natural English. Type /quit to exit.\n'));

  let running = true;
  while (running) {
    const spinner = ora({ text: 'Getting a phrase...', color: 'cyan', indent: 2 }).start();
    let phrase;
    try {
      phrase = await getSpanishPhrase(difficulty);
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
      stats
    });

    if (res.quit) break;

    printDivider();
    const again = await safeConfirm({ message: 'Next phrase?', default: true });
    if (!again) running = false;
  }
}
