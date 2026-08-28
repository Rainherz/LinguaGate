import readline from 'node:readline';
import ora from 'ora';
import chalk from 'chalk';
import { getFillBlank } from '../services/agy.js';
import { evaluateFillBlankExercise } from '../services/evaluator.js';
import { clearScreen, printAppHeader, printStreak, printDivider } from '../ui/display.js';
import { ask } from '../ui/prompt.js';

export async function runFillBlank(stats, difficulty) {
  clearScreen();
  printAppHeader(`Fill in the Blank (${difficulty.toUpperCase()})`);
  console.log(chalk.gray('  Type the missing word or preposition. Type /quit to exit.\n'));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

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
      stats,
      rl
    });

    printDivider();
    const again = (await ask(rl, chalk.gray('  Next exercise? (y/n) › '))).trim().toLowerCase();
    if (again !== 'y') running = false;
  }

  rl.close();
}
