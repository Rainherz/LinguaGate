import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import { getMistakeExercise } from '../services/tutor.js';
import { getDueSrsCards, reviewSrsCard } from '../services/history.js';
import { promptAudioFollowup } from '../services/evaluator.js';
import { clearScreen, printAppHeader } from '../ui/display.js';
import { safeInput } from '../ui/prompt.js';

export async function runReview(stats) {
  clearScreen();
  printAppHeader('Spaced Repetition (SRS Review)');
  console.log(chalk.gray('  Reviewing grammar patterns scheduled by the SM-2 retention engine.\n'));

  const dueCards = getDueSrsCards();
  if (dueCards.length === 0) {
    console.log(chalk.green('  ✨ No cards currently due for review! Excellent job.\n'));
    console.log(chalk.gray('  Keep practicing in Learning Path or Chat to add new challenge cards.\n'));
    return;
  }

  console.log(chalk.bold(`  📚 Cards queued for review (${dueCards.length}):`));
  dueCards.forEach((card, i) => {
    const repText = card.repetition > 0 ? `(Streak: ${card.repetition}x | Int: ${card.interval}d)` : `(Needs Practice)`;
    console.log(chalk.yellow(`    ${i + 1}. ${card.rule} ${chalk.gray(repText)}`));
  });
  console.log();

  await safeInput({ message: 'Press [ENTER] to start review ›' });

  for (let i = 0; i < dueCards.length; i++) {
    const card = dueCards[i];
    clearScreen();
    printAppHeader(`SRS Card [${i + 1}/${dueCards.length}] • ${card.rule}`);

    const spinner = ora({ text: 'Loading targeted exercise & theory...', color: 'cyan', indent: 2 }).start();
    let exercise;
    try {
      exercise = await getMistakeExercise(card.rule);
      spinner.stop();
    } catch (err) {
      spinner.fail('Could not generate exercise.');
      console.error(chalk.red(`  ${err.message}\n`));
      continue;
    }

    // Display Theory Recap Box
    let cardContent = '';
    if (exercise.ruleRecap) {
      cardContent += `${chalk.bold.white('📖 Regla / Recordatorio:')}\n${chalk.gray(exercise.ruleRecap)}\n\n`;
    }
    if (exercise.tip) {
      cardContent += `${chalk.bold.cyan('💡 Tip Clave:')} ${chalk.white(exercise.tip)}`;
    }

    if (cardContent) {
      console.log(
        boxen(cardContent.trim(), {
          title: chalk.bold.yellow(` ${card.rule} `),
          titleAlignment: 'left',
          padding: 1,
          margin: { top: 0, bottom: 1, left: 1, right: 1 },
          borderStyle: 'round',
          borderColor: 'yellow',
          dimBorder: true
        })
      );
    }

    console.log(chalk.bold.white(`  Desafío:\n  ${chalk.cyan(exercise.exercise)}\n`));
    if (exercise.hint) {
      console.log(`  ${chalk.dim('💡 Pista:')} ${chalk.gray(exercise.hint)}\n`);
    }

    const input = (await safeInput({ message: 'Your answer ›' })).trim();
    if (input === '/quit' || input.toLowerCase() === 'exit') break;

    const isCorrect = input.toLowerCase().trim() === exercise.answer.toLowerCase().trim();
    console.log();
    if (isCorrect) {
      reviewSrsCard(card.rule, true);
      console.log(chalk.bold.green(`  ✔ Correct! Next review interval increased 📈`));
      if (exercise.explanation) {
        console.log(`  ${chalk.gray(exercise.explanation)}`);
      }
      console.log();
      stats.recordCorrect();
    } else {
      reviewSrsCard(card.rule, false);
      console.log(chalk.bold.red(`  ✖ Needs correction.`));
      console.log(`  ${chalk.dim('Tu respuesta:')}      ${chalk.red(input)}`);
      console.log(`  ${chalk.dim('🎯 Respuesta ideal:')} ${chalk.bold.green(exercise.answer)}\n`);
      if (exercise.explanation) {
        console.log(`  ${chalk.dim('Explicación:')} ${chalk.gray(exercise.explanation)}`);
      }
      console.log(chalk.yellow(`  ⚠️ Review interval reset to 1 day.\n`));
      stats.recordIncorrect(card.rule);
    }

    await promptAudioFollowup(exercise.answer);
  }

  clearScreen();
  printAppHeader('SRS Review Completed');
  console.log(chalk.bold.green('  🎉 Great session! Your spaced repetition memory intervals have been updated.\n'));
}
