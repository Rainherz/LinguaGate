import readline from 'node:readline';
import ora from 'ora';
import chalk from 'chalk';
import { getFillBlank } from '../services/agy.js';
import { recordError, updateStreak } from '../services/history.js';
import { printStreak, printDivider } from '../ui/display.js';

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

export async function runFillBlank(stats, difficulty) {
  console.log(chalk.gray(`\n  ✏️  Fill in the Blank mode (${difficulty}).`));
  console.log(chalk.gray('  Type /quit to exit.\n'));

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

    const displayed = exercise.sentence.replace('___', chalk.bold.cyan('___'));
    console.log(chalk.bold(`\n  ${displayed}`));
    console.log(chalk.gray(`  Hint: ${exercise.hint}\n`));

    const input = (await ask(rl, chalk.bold.green('  Your answer › '))).trim();
    if (input === '/quit') break;

    const isCorrect = input.toLowerCase() === exercise.answer.toLowerCase();

    if (isCorrect) {
      console.log(chalk.green(`  ✔ Correct! The answer is "${exercise.answer}"`));
      const streak = updateStreak(true);
      printStreak(streak);
      stats.recordCorrect();
    } else {
      console.log(chalk.red(`  ✖ Not quite. The correct answer is: ${chalk.white(exercise.answer)}`));
      console.log(chalk.gray(`  Why: ${exercise.explanation}`));
      updateStreak(false);
      stats.recordIncorrect('fill-in-the-blank error');
      recordError('fill-in-the-blank error', exercise.sentence, exercise.answer);
      console.log();
    }

    printDivider();
    const again = (await ask(rl, chalk.gray('  Next exercise? (y/n) › '))).trim().toLowerCase();
    if (again !== 'y') running = false;
  }

  rl.close();
}
