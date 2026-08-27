import readline from 'node:readline';
import ora from 'ora';
import chalk from 'chalk';
import { getMistakeExercise } from '../services/agy.js';
import { getTopErrors } from '../services/history.js';
import { printDivider } from '../ui/display.js';

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

export async function runReview(stats) {
  console.log(chalk.gray('\n  🔄 Review My Mistakes mode.\n'));

  const topErrors = getTopErrors(3);
  if (topErrors.length === 0) {
    console.log(chalk.yellow('  No mistakes recorded yet! Go practice first.\n'));
    return;
  }

  console.log(chalk.bold('  Your most common mistakes:'));
  topErrors.forEach(({ type, count }, i) => {
    console.log(chalk.red(`    ${i + 1}. ${type} (${count}x)`));
  });
  console.log();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  for (const { type } of topErrors) {
    printDivider();
    console.log(chalk.bold.yellow(`  Targeting: ${type}\n`));

    const spinner = ora({ text: 'Generating exercise...', color: 'cyan', indent: 2 }).start();
    let exercise;
    try {
      exercise = getMistakeExercise(type);
      spinner.stop();
    } catch (err) {
      spinner.fail('Could not generate exercise.');
      console.error(chalk.red(`  ${err.message}\n`));
      continue;
    }

    console.log(chalk.bold(`\n  ${exercise.exercise}\n`));
    const input = (await ask(rl, chalk.bold.green('  Your answer › '))).trim();

    const isCorrect = input.toLowerCase().trim() === exercise.answer.toLowerCase().trim();
    if (isCorrect) {
      console.log(chalk.green(`  ✔ Correct!\n`));
      stats.recordCorrect();
    } else {
      console.log(chalk.red(`  ✖ The correct answer is: ${chalk.white(exercise.answer)}`));
      console.log(chalk.gray(`  ${exercise.explanation}\n`));
      stats.recordIncorrect(type);
    }
  }

  rl.close();
  console.log(chalk.cyan('\n  Review complete!\n'));
}
