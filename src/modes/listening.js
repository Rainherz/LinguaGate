import readline from 'node:readline';
import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import { playAudio, isAudioSupported } from '../services/audio.js';
import { getListeningPhrase, evaluateListening } from '../services/agy.js';
import { updateStreak, recordError } from '../services/history.js';
import { clearScreen, printAppHeader, printStreak, printDivider } from '../ui/display.js';
import { safeSelect, safeConfirm, ask } from '../ui/prompt.js';

export async function runListening(stats) {
  clearScreen();
  printAppHeader('Listening & Dictation Lab');

  if (!isAudioSupported()) {
    console.log(
      boxen(
        `${chalk.bold.yellow('⚠️ Audio Player Not Detected')}\n\n` +
        `${chalk.white('To hear spoken audio in terminal, please install mpg123:')}\n` +
        `${chalk.cyan('sudo pacman -S mpg123')} ${chalk.gray('(Arch)')} or ${chalk.cyan('sudo apt install mpg123')} ${chalk.gray('(Debian/Ubuntu)')}`,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'yellow'
        }
      )
    );
    const cont = await safeConfirm({ message: 'Return to Main Menu?', default: true });
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

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let challengeCount = 0;
  let running = true;

  while (running) {
    challengeCount++;
    clearScreen();
    printAppHeader(`Listening Lab (${difficulty.toUpperCase()}) • Audio #${challengeCount}`);

    const loadSpinner = ora({ text: 'Generating audio phrase...', color: 'cyan', indent: 2 }).start();
    let phrase;
    try {
      phrase = getListeningPhrase(difficulty);
      loadSpinner.stop();
    } catch (err) {
      loadSpinner.fail('Failed to generate phrase');
      break;
    }

    // Play Audio
    const playSpinner = ora({ text: '🔊 Playing audio through speakers...', color: 'yellow', indent: 2 }).start();
    await playAudio(phrase.phrase, { isSlow: false });
    playSpinner.succeed(chalk.green('Audio played! 🔊'));

    let transcription = '';
    while (!transcription) {
      console.log(
        boxen(
          `${chalk.bold.white('Instructions:')}\n` +
          `  Type what you heard and press ${chalk.bold.green('[ENTER]')}\n` +
          `  Type ${chalk.yellow('[r]')} to replay normal speed\n` +
          `  Type ${chalk.cyan('[s]')} to replay slow speed (0.25x)\n` +
          `  Type ${chalk.red('/quit')} to exit`,
          {
            padding: { top: 0, bottom: 0, left: 1, right: 1 },
            margin: { top: 1, bottom: 1, left: 1, right: 1 },
            borderStyle: 'round',
            borderColor: 'cyan',
            dimBorder: true
          }
        )
      );

      const input = (await ask(rl, chalk.bold.green('  Your transcription › '))).trim();

      if (input === '/quit') {
        running = false;
        break;
      }

      if (input.toLowerCase() === 'r') {
        const rSpinner = ora({ text: '🔊 Replaying audio (normal)...', color: 'yellow', indent: 2 }).start();
        await playAudio(phrase.phrase, { isSlow: false });
        rSpinner.succeed(chalk.green('Replayed!'));
        continue;
      }

      if (input.toLowerCase() === 's') {
        const sSpinner = ora({ text: '🔊 Replaying audio (slow)...', color: 'cyan', indent: 2 }).start();
        await playAudio(phrase.phrase, { isSlow: true });
        sSpinner.succeed(chalk.cyan('Replayed slowly!'));
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
        console.log(chalk.bold.green('  🎉 Perfect Match! (100/100) — Incredible ear!'));
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
    await playAudio(phrase.phrase, { isSlow: false });

    printDivider();
    const again = await safeConfirm({ message: 'Next audio challenge?', default: true });
    if (!again) running = false;
  }

  rl.close();
}
