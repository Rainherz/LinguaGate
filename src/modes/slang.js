import { safeSelect, safeInput } from '../ui/prompt.js';
import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import { getSlangWorkout } from '../services/tutor.js';
import { updateStreak, recordError } from '../services/history.js';
import { promptAudioFollowup } from '../services/evaluator.js';
import { clearScreen, printAppHeader } from '../ui/display.js';

export async function runSlang(stats) {
  clearScreen();
  printAppHeader('Phrasal Verbs & Slang Vault');

  const category = await safeSelect({
    message: 'Select a theme to master (Esc to go back):',
    choices: [
      { name: '🔙 Back to Main Menu (or press Esc)', value: 'BACK' },
      { name: '💻 Tech & Workplace (touch base, circle back, ship it...)', value: 'tech & software engineering workplace' },
      { name: '☕ Everyday Life & Idioms (hang out, spill the beans, bite the bullet...)', value: 'everyday native slang and idioms' },
      { name: '💼 Business & Negotiations (bottom line, cut corners, ballpark...)', value: 'business and professional negotiation' }
    ]
  });

  if (!category || category === 'BACK') return;

  clearScreen();
  printAppHeader('Slang Vault • Workout');

  const spinner = ora({ text: 'Curating native expressions...', color: 'cyan', indent: 2 }).start();
  let workout;
  try {
    workout = await getSlangWorkout(category);
    spinner.stop();
  } catch (err) {
    spinner.fail('Failed to load expressions');
    console.error(err.message);
    return;
  }

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

    const input = (await safeInput({ message: 'Your answer ›' })).trim();
    if (input === '/quit' || input.toLowerCase() === 'exit') break;

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

    console.log();
    await promptAudioFollowup(item.example);
  }

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
