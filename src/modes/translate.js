import readline from 'node:readline';
import ora from 'ora';
import chalk from 'chalk';
import { getSpanishPhrase, checkTranslation } from '../services/agy.js';
import { recordError, updateStreak } from '../services/history.js';
import { clearScreen, printAppHeader, printStreak, printDivider } from '../ui/display.js';

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

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

    console.log(chalk.bold.yellow(`\n  🇪🇸 ${phrase.spanish}`));
    console.log(chalk.gray(`  Hint: ${phrase.hint}\n`));

    const input = (await ask(rl, chalk.bold.green('  Your translation › '))).trim();
    if (input === '/quit') break;

    const evalSpinner = ora({ text: 'Evaluating...', color: 'yellow', indent: 2 }).start();
    let evaluation;
    try {
      evaluation = checkTranslation(phrase.spanish, input, phrase.english);
      evalSpinner.stop();
    } catch (err) {
      evalSpinner.fail('Could not evaluate.');
      console.error(chalk.red(`  ${err.message}\n`));
      break;
    }

    if (evaluation.isCorrect) {
      if (evaluation.score === 100) {
        console.log(chalk.bold.green(`  ✔ Perfect! (100/100)`));
      } else {
        console.log(chalk.green(`  ✔ Accepted! Score: ${evaluation.score}/100`));
      }
      if (evaluation.feedback) {
        console.log(chalk.gray(`  💬 Feedback: ${evaluation.feedback}`));
      }
      console.log(chalk.cyan(`  🎯 Ideal Translation: `) + chalk.white(phrase.english) + '\n');
      const streak = updateStreak(true);
      printStreak(streak);
      stats.recordCorrect();
    } else {
      console.log(chalk.red(`  ✖ Needs improvement. Score: ${evaluation.score}/100`));
      if (evaluation.feedback) {
        console.log(chalk.gray(`  💬 Feedback: ${evaluation.feedback}\n`));
      }
      console.log(chalk.cyan(`  🎯 Expected Translation: `) + chalk.white(phrase.english) + '\n');

      if (evaluation.errors?.length > 0) {
        for (const err of evaluation.errors) {
          console.log(chalk.yellow(`  ❌ "${err.wrong}" → "${err.correct}"`));
          console.log(chalk.bold.white(`     📖 ${err.rule}`));
          console.log(chalk.gray(`     ${err.theory}`));
          console.log(chalk.gray(`     e.g. "${err.example}"\n`));
          recordError(err.rule, phrase.spanish, phrase.english);
        }
      }

      updateStreak(false);
      stats.recordIncorrect(evaluation.errors?.[0]?.rule ?? 'translation error');
      console.log();
    }



    printDivider();
    const again = (await ask(rl, chalk.gray('  Next phrase? (y/n) › '))).trim().toLowerCase();
    if (again !== 'y') running = false;
  }

  rl.close();
}
