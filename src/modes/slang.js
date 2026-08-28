import readline from 'node:readline';
import { select } from '@inquirer/prompts';
import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import { getSlangWorkout } from '../services/agy.js';
import { updateStreak, recordError } from '../services/history.js';
import { clearScreen, printAppHeader, printDivider } from '../ui/display.js';

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

export async function runSlang(stats) {
  clearScreen();
  printAppHeader('Phrasal Verbs & Slang Vault');

  const category = await select({
    message: 'Select a theme to master:',
    choices: [
      { name: '💻 Tech & Workplace (touch base, circle back, ship it...)', value: 'tech & software engineering workplace' },
      { name: '☕ Everyday Life & Idioms (hang out, spill the beans, bite the bullet...)', value: 'everyday native slang and idioms' },
      { name: '💼 Business & Negotiations (bottom line, cut corners, ballpark...)', value: 'business and professional negotiation' },
      { name: '🔙 Back to Main Menu', value: 'BACK' }
    ]
  });

  if (category === 'BACK') return;

  clearScreen();
  printAppHeader('Slang Vault • Workout');

  const spinner = ora({ text: 'Curating native expressions...', color: 'cyan', indent: 2 }).start();
  let workout;
  try {
    workout = getSlangWorkout(category);
    spinner.stop();
  } catch (err) {
    spinner.fail('Failed to load expressions');
    console.error(err.message);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  for (let i = 0; i < workout.items.length; i++) {
    const item = workout.items[i];
    clearScreen();
    printAppHeader(`Expression [${i + 1}/${workout.items.length}] • ${item.phrase}`);

    // Render Educational Card
    let cardText = `${chalk.bold.yellow('🎯 Significado Real:')} ${chalk.white(item.realMeaning)}\n`;
    cardText += `${chalk.dim('❌ Literal (error común):')} ${chalk.gray(item.literalMeaning)}\n\n`;
    cardText += `${chalk.cyan('💬 Cuándo se usa:')} ${chalk.gray(item.situation)}\n`;
    cardText += `${chalk.bold.green('🗣️ Ejemplo:')} ${chalk.italic.white(`"${item.example}"`)}`;

    console.log(
      boxen(cardText, {
        title: chalk.bold.cyan(` 🏷️  ${item.phrase.toUpperCase()} `),
        titleAlignment: 'left',
        padding: 1,
        margin: { top: 0, bottom: 1, left: 1, right: 1 },
        borderStyle: 'round',
        borderColor: 'cyan',
        dimBorder: true
      })
    );

    console.log(chalk.bold.white(`  Desafío de aplicación:\n  ${chalk.cyan(item.challenge.prompt)}\n`));
    if (item.challenge.hint) {
      console.log(`  ${chalk.dim('💡 Pista:')} ${chalk.gray(item.challenge.hint)}\n`);
    }

    const input = (await ask(rl, chalk.bold.green('  Your answer › '))).trim();

    const isMatch = input.toLowerCase().includes(item.challenge.answer.toLowerCase().trim());
    console.log();
    if (isMatch) {
      console.log(chalk.bold.green(`  ✔ Correct! You mastered "${item.phrase}".`));
      updateStreak(true);
      stats.recordCorrect();
    } else {
      console.log(chalk.bold.red(`  ✖ Almost. The expected phrase was: "${chalk.white(item.challenge.answer)}"`));
      updateStreak(false);
      stats.recordIncorrect(`Phrasal Verb / Slang: ${item.phrase}`);
      recordError(`Phrasal Verb: ${item.phrase}`, item.challenge.prompt, item.challenge.answer);
    }

    if (i < workout.items.length - 1) {
      await ask(rl, chalk.dim('\n  Press [ENTER] for the next expression › '));
    }
  }

  rl.close();

  clearScreen();
  printAppHeader('Workout Completed');
  console.log(
    boxen(
      `${chalk.bold.green('🎉 SLANG WORKOUT COMPLETE!')}\n\n` +
      `${chalk.white('You expanded your real-world vocabulary with 3 native expressions.')}\n` +
      `${chalk.yellow('Reward: +45 XP ⚡')}`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green'
      }
    )
  );
}
