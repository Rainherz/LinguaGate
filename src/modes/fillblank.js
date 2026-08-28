import ora from 'ora';
import chalk from 'chalk';
import { getFillBlank } from '../services/agy.js';
import { evaluateFillBlankExercise } from '../services/evaluator.js';
import { clearScreen, printAppHeader, printDivider } from '../ui/display.js';
import { safeConfirm } from '../ui/prompt.js';

export async function runFillBlank(stats, difficulty) {
  clearScreen();
  printAppHeader(`Fill in the Blank (${difficulty.toUpperCase()})`);
  console.log(chalk.gray('  Type the missing word or preposition. Type /quit to exit.\n'));

  let running = true;
  while (running) {
    const spinner = ora({ text: 'Generating exercise...', color: 'cyan', indent: 2 }).start();
    let exercise;
    try {
      exercise = getFillBlank(difficulty);
      spinner.stop();
    } catch (err) {
      spinner.fail('Could not load exercise.');
      console.error(chalk.red(`  ${err.message}\n`));
      break;
    }

    const res = await evaluateFillBlankExercise({
      sentence: exercise.sentence,
      answer: exercise.answer,
      hint: exercise.hint,
      explanation: exercise.explanation,
      grammarRule: 'Fill-in-the-blank Practice',
      stats
    });

    if (res.quit) break;

    printDivider();
    const again = await safeConfirm({ message: 'Next exercise?', default: true });
    if (!again) running = false;
  }
}
