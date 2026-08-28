import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import { getMistakeExercise } from '../services/tutor.js';
import { getDueSrsCards, reviewSrsCard, getCardKind, srsCardKey } from '../services/history.js';
import { promptAudioFollowup } from '../services/evaluator.js';
import { isRecorderAvailable, startRecording } from '../services/recorder.js';
import { isTranscriptionAvailable, transcribeAudio } from '../services/transcriber.js';
import { diagnoseArticulation, diffSpokenWords } from '../services/speech.js';
import { playAudio, playAudioSlow } from '../services/audio.js';
import { clearScreen, printAppHeader } from '../ui/display.js';
import { safeInput } from '../ui/prompt.js';

/**
 * Reviews a pronunciation card by having the learner SAY the phrase again and
 * verifying it with speech-to-text — the same measurement that created the
 * card. Typing it back would prove nothing about pronunciation.
 * @param {{ rule: string, target: string, lastSpoken?: string, confidence?: number|null }} card
 * @returns {Promise<{ isCorrect: boolean, quit: boolean }>}
 */
async function reviewPronunciationCard(card) {
  console.log(
    boxen(
      `${chalk.bold.white('🎯 Say this out loud:')}\n\n  ${chalk.bold.cyan(card.target)}\n\n` +
      (card.lastSpoken
        ? `${chalk.dim('Last time it came out as:')} ${chalk.red(card.lastSpoken)}` +
          (typeof card.confidence === 'number' ? chalk.dim(` (${card.confidence.toFixed(2)})`) : '')
        : ''),
      {
        padding: 1,
        margin: { top: 0, bottom: 1, left: 1, right: 1 },
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    )
  );

  while (true) {
    const control = (await safeInput({
      message: 'Listen first ([r] native / [s] slow) or press Enter to record ›'
    })).trim().toLowerCase();
    if (control === 'r') await playAudio(card.target);
    else if (control === 's') await playAudioSlow(card.target);
    else break;
  }

  let spoken = '';

  if (isRecorderAvailable() && isTranscriptionAvailable()) {
    const recorder = startRecording();
    const recSpinner = ora({ text: '🔴 RECORDING... say it now, press Enter when done.', color: 'red' }).start();
    await safeInput({ message: '' });
    recSpinner.stop();

    const recording = await recorder.stop();
    const sttSpinner = ora({ text: '🧠 Checking what you actually said...', color: 'magenta', indent: 2 }).start();
    const stt = await transcribeAudio(recording.path);

    if (stt.success) {
      sttSpinner.succeed(chalk.green('Transcribed 🧠'));
      spoken = stt.text;
      console.log(`\n  ${chalk.dim('👂 Heard:')} ${chalk.bold.white(`"${spoken}"`)}\n`);
    } else {
      sttSpinner.warn(chalk.yellow(stt.error || 'Could not transcribe.'));
    }
  }

  if (!spoken) {
    console.log(chalk.yellow('  ⚠ No transcript — this check is self-reported.\n'));
    spoken = (await safeInput({ message: 'Type what you actually said ›' })).trim();
    if (spoken === '/quit') return { isCorrect: false, quit: true };
  }

  if (!spoken) return { isCorrect: false, quit: false };

  const diagnosis = diagnoseArticulation(card.target, spoken, []);
  const { expectedTokens, actualTokens } = diffSpokenWords(card.target, spoken);
  const render = (tokens, ok) =>
    tokens.map((t) => (t.matched ? ok(t.word) : chalk.bold.red.underline(t.word))).join(' ');

  console.log(`  ${chalk.dim('🎯 Target:  ')} ${render(expectedTokens, chalk.gray)}`);
  console.log(`  ${chalk.dim('👂 You said:')} ${render(actualTokens, chalk.green)}\n`);

  return { isCorrect: diagnosis.verdict === 'clean', quit: false };
}

export async function runReview(stats) {
  clearScreen();
  printAppHeader('Spaced Repetition (SRS Review)');
  console.log(chalk.gray('  Reviewing grammar and pronunciation scheduled by the SM-2 retention engine.\n'));

  const dueCards = getDueSrsCards();
  if (dueCards.length === 0) {
    console.log(chalk.green('  ✨ No cards currently due for review! Excellent job.\n'));
    console.log(chalk.gray('  Keep practicing in Learning Path or Chat to add new challenge cards.\n'));
    return;
  }

  console.log(chalk.bold(`  📚 Cards queued for review (${dueCards.length}):`));
  dueCards.forEach((card, i) => {
    const repText = card.repetition > 0 ? `(Streak: ${card.repetition}x | Int: ${card.interval}d)` : `(Needs Practice)`;
    const badge = getCardKind(card) === 'pronunciation' ? chalk.magenta('🎙️ ') : chalk.cyan('📖 ');
    console.log(chalk.yellow(`    ${i + 1}. ${badge}${card.rule} ${chalk.gray(repText)}`));
  });
  console.log();

  await safeInput({ message: 'Press [ENTER] to start review ›' });

  for (let i = 0; i < dueCards.length; i++) {
    const card = dueCards[i];
    clearScreen();
    printAppHeader(`SRS Card [${i + 1}/${dueCards.length}] • ${card.rule}`);

    if (getCardKind(card) === 'pronunciation') {
      const outcome = await reviewPronunciationCard(card);
      if (outcome.quit) break;

      if (outcome.isCorrect) {
        reviewSrsCard(srsCardKey(card), true);
        console.log(chalk.bold.green('  ✔ Nailed it! Next review interval increased 📈\n'));
        stats.recordCorrect();
      } else {
        reviewSrsCard(srsCardKey(card), false);
        console.log(chalk.bold.red('  ✖ Still not matching the target.'));
        console.log(chalk.yellow('  ⚠️ Review interval reset to 1 day.\n'));
        stats.recordIncorrect(card.rule);
      }

      await promptAudioFollowup(card.target);
      continue;
    }

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
      reviewSrsCard(srsCardKey(card), true);
      console.log(chalk.bold.green(`  ✔ Correct! Next review interval increased 📈`));
      if (exercise.explanation) {
        console.log(`  ${chalk.gray(exercise.explanation)}`);
      }
      console.log();
      stats.recordCorrect();
    } else {
      reviewSrsCard(srsCardKey(card), false);
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
