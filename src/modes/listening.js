import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import { playAudio, isAudioSupported } from '../services/audio.js';
import { getListeningPhrase, evaluateListening } from '../services/agy.js';
import { updateStreak, recordError } from '../services/history.js';
import { clearScreen, printAppHeader, printStreak, printDivider } from '../ui/display.js';
import { safeSelect, safeConfirm, safeInput } from '../ui/prompt.js';

export async function runListening(stats) {
  clearScreen();
  printAppHeader('Listening & Dictation Lab');

  if (!isAudioSupported()) {
    console.log(
      boxen(
        `${chalk.bold.yellow('⚠️ Audio Player Not Detected')}\n\n` +
        `${chalk.white('To hear spoken audio in terminal, please install mpg123 or ffplay:')}\n` +
        `${chalk.cyan('sudo pacman -S mpg123 ffmpeg')} ${chalk.gray('(Arch)')}`,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'yellow'
        }
      )
    );
    await safeConfirm({ message: 'Return to Main Menu?', default: true });
    return;
  }

  const difficulty = await safeSelect({
    message: 'Select listening level (Esc to go back):',
    choices: [
      { name: '🔙 Back to Main Menu (or press Esc)', value: 'BACK' },
      { name: '🟢 Beginner (short phrases, clear articulation)', value: 'beginner' },
      { name: '🟡 Intermediate (natural speed, contractions, phrasal verbs)', value: 'intermediate' },
      { name: '🔴 Advanced (fast connected speech, reductions, idioms)', value: 'advanced' }
    ]
  });

  if (!difficulty || difficulty === 'BACK') return;

  let challengeCount = 0;
  let running = true;

  while (running) {
    challengeCount++;
    clearScreen();
    printAppHeader(`Listening Lab (${difficulty.toUpperCase()}) • Audio #${challengeCount}`);

    const loadSpinner = ora({ text: 'Generating audio challenge...', color: 'cyan', indent: 2 }).start();
    let phrase;
    try {
      phrase = getListeningPhrase(difficulty);
      loadSpinner.stop();
    } catch (err) {
      loadSpinner.fail('Failed to generate audio phrase');
      break;
    }

    // Play Audio Initial (Normal)
    const playSpinner = ora({ text: '🔊 Playing audio through speakers...', color: 'yellow', indent: 2 }).start();
    await playAudio(phrase.phrase, { speed: 'normal' });
    playSpinner.succeed(chalk.green('Audio played! 🔊'));

    let transcription = '';
    while (!transcription) {
      console.log(
        boxen(
          `${chalk.bold.white('Controls:')}\n` +
          `  Type what you heard and press ${chalk.bold.green('[ENTER]')}\n` +
          `  ${chalk.yellow('[r]')} Replay normal speed (1.0x)\n` +
          `  ${chalk.cyan('[s]')} Replay slow speed (0.7x)\n` +
          `  ${chalk.magenta('[u]')} Replay ultra slow (0.4x - cámara lenta)\n` +
          `  ${chalk.red('/quit')} Exit to menu`,
          {
            padding: { top: 0, bottom: 0, left: 1, right: 1 },
            margin: { top: 1, bottom: 1, left: 1, right: 1 },
            borderStyle: 'round',
            borderColor: 'cyan',
            dimBorder: true
          }
        )
      );

      const input = (await safeInput({ message: 'Your transcription ›' })).trim();

      if (!input) {
        console.log(chalk.yellow('\n  ⚠️ Escribí lo que escuchaste, o usá [r] / [s] / [u] para repetir el audio.\n'));
        continue;
      }

      if (input === '/quit' || input.toLowerCase() === 'exit') {
        running = false;
        break;
      }

      if (input.toLowerCase() === 'r') {
        const rSpinner = ora({ text: '🔊 Replaying (1.0x normal)...', color: 'yellow', indent: 2 }).start();
        await playAudio(phrase.phrase, { speed: 'normal' });
        rSpinner.succeed(chalk.green('Played at normal speed!'));
        continue;
      }

      if (input.toLowerCase() === 's') {
        const sSpinner = ora({ text: '🔊 Replaying (0.7x slow)...', color: 'cyan', indent: 2 }).start();
        await playAudio(phrase.phrase, { speed: 'slow' });
        sSpinner.succeed(chalk.cyan('Played slowly!'));
        continue;
      }

      if (input.toLowerCase() === 'u') {
        const uSpinner = ora({ text: '🔊 Replaying (0.4x ultra slow)...', color: 'magenta', indent: 2 }).start();
        await playAudio(phrase.phrase, { speed: 'ultra' });
        uSpinner.succeed(chalk.magenta('Played ultra slowly!'));
        continue;
      }

      transcription = input;
    }

    if (!running) break;

    // Evaluate Dictation
    const evalSpinner = ora({ text: 'Analyzing phonetic accuracy...', color: 'yellow', indent: 2 }).start();
    let evaluation;
    try {
      evaluation = evaluateListening(phrase.phrase, transcription);
      evalSpinner.stop();
    } catch {
      evalSpinner.stop();
      evaluation = { isCorrect: false, score: 50, phoneticInsight: phrase.listeningTip };
    }

    console.log();
    if (evaluation.isCorrect) {
      if (evaluation.score === 100) {
        console.log(chalk.bold.green('  🎉 Perfect Match! (100/100) — Oído impecable!'));
      } else {
        console.log(chalk.bold.green(`  ✔ Accepted! (${evaluation.score}/100)`));
      }
      updateStreak(true);
      stats.recordCorrect();
    } else {
      console.log(chalk.bold.red(`  ✖ Dictation needs review (${evaluation.score}/100)`));
      updateStreak(false);
      stats.recordIncorrect('listening dictation error');
      recordError('Listening / Connected Speech', phrase.phrase, phrase.translation);
    }

    console.log(`\n  ${chalk.dim('Tu transcripción:')} ${chalk.white(transcription)}`);
    console.log(`  ${chalk.bold.cyan('🎯 Texto Original:')}    ${chalk.bold.white(phrase.phrase)}`);
    console.log(`  ${chalk.dim('🇪🇸 Traducción:')}        ${chalk.gray(phrase.translation)}`);
    if (phrase.phoneticIpa) {
      console.log(`  ${chalk.dim('🗣️ Fonética IPA:')}       ${chalk.magenta(phrase.phoneticIpa)}`);
    }

    if (evaluation.phoneticInsight || phrase.listeningTip) {
      console.log(
        boxen(
          `${chalk.bold.yellow('💡 Fenómeno Fonético / Connected Speech:')}\n` +
          `${chalk.white(evaluation.phoneticInsight || phrase.listeningTip)}`,
          {
            padding: 1,
            margin: { top: 1, bottom: 1, left: 1, right: 1 },
            borderStyle: 'round',
            borderColor: 'yellow',
            dimBorder: true
          }
        )
      );
    }

    // Play final review audio
    await playAudio(phrase.phrase, { speed: 'normal' });

    printDivider();
    const again = await safeConfirm({ message: 'Next audio challenge?', default: true });
    if (!again) running = false;
  }
}
