import readline from 'node:readline';
import ora from 'ora';
import chalk from 'chalk';
import { getMistakeExercise } from '../services/agy.js';
import { getDueSrsCards, reviewSrsCard } from '../services/history.js';
import { clearScreen, printAppHeader, printDivider } from '../ui/display.js';

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

export async function runReview(stats) {
  clearScreen();
  printAppHeader('Spaced Repetition (SRS Review)');
  console.log(chalk.gray('  Reviewing grammar patterns scheduled by the SM-2 retention engine.\n'));

  const dueCards = getDueSrsCards();
  if (dueCards.length === 0) {
    console.log(chalk.green('  ✨ No cards currently due for review! Excellent job.\n'));
    console.log(chalk.gray('  Keep chatting or doing lessons to add new challenge cards.\n'));
    return;
  }

  console.log(chalk.bold(`  📚 Cards queued for review today (${dueCards.length}):`));
  dueCards.forEach((card, i) => {
    const repText = card.repetition > 0 ? `(Streak: ${card.repetition}x | Int: ${card.interval}d)` : `(Needs Practice)`;
    console.log(chalk.yellow(`    ${i + 1}. ${card.rule} ${chalk.gray(repText)}`));
  });
  console.log();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  for (let i = 0; i < dueCards.length; i++) {
    const card = dueCards[i];
    printDivider();
    console.log(chalk.bold.magenta(`  [Card ${i + 1}/${dueCards.length}] `) + chalk.bold.yellow(`Rule: ${card.rule}`));
    if (card.lastMistake?.original) {
      console.log(chalk.gray(`  Last caught on: "${card.lastMistake.original}"`));
    }
    console.log();

    const spinner = ora({ text: 'Generating targeted exercise...', color: 'cyan', indent: 2 }).start();
    let exercise;
    try {
      exercise = getMistakeExercise(card.rule);
      spinner.stop();
    } catch (err) {
      spinner.fail('Could not generate exercise.');
      console.error(chalk.red(`  ${err.message}\n`));
      continue;
    }

    console.log(chalk.bold(`  ${exercise.exercise}\n`));
    const input = (await ask(rl, chalk.bold.green('  Your answer › '))).trim();

    const isCorrect = input.toLowerCase().trim() === exercise.answer.toLowerCase().trim();
    if (isCorrect) {
      reviewSrsCard(card.rule, true);
      console.log(chalk.green(`  ✔ Correct! Next review interval increased 📈\n`));
      stats.recordCorrect();
    } else {
      reviewSrsCard(card.rule, false);
      console.log(chalk.red(`  ✖ The correct answer is: ${chalk.white(exercise.answer)}`));
      console.log(chalk.gray(`  ${exercise.explanation}`));
      console.log(chalk.yellow(`  ⚠️ Review interval reset to 1 day.\n`));
      stats.recordIncorrect(card.rule);
    }
  }

  rl.close();
  console.log(chalk.bold.cyan('\n  🎉 SRS Review complete! Your memory intervals have been updated.\n'));
}
