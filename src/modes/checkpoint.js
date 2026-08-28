import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import { loadCheckpoint, completeCheckpoint } from '../services/checkpoint.js';
import { checkTranslation } from '../services/tutor.js';
import { playAudio, isAudioSupported } from '../services/audio.js';
import { updateStreak, recordError } from '../services/history.js';
import { clearScreen, printAppHeader, printDivider } from '../ui/display.js';
import { safeSelect, safeInput, safeConfirm } from '../ui/prompt.js';

/**
 * Runs a 20-question checkpoint certification exam for a CEFR level.
 * @param {string} level
 * @param {Object} stats
 * @returns {Promise<{ passed: boolean, score: number, total: number }>}
 */
export async function runCheckpointExam(level, stats) {
  const exam = loadCheckpoint(level);
  if (!exam) {
    console.log(chalk.red(`No checkpoint exam found for level ${level}.`));
    return { passed: false, score: 0, total: 0 };
  }

  clearScreen();
  printAppHeader(`Unit ${level.toUpperCase()} Certification Exam`);

  const introText =
    `${chalk.bold.yellow(`🏆 ${exam.title}`)}\n\n` +
    `${chalk.white('This comprehensive exam tests all 4 core skills across the entire unit:')}\n` +
    `  ${chalk.cyan('• 🎧 Listening & Dictation')}     (Native audio transcription)\n` +
    `  ${chalk.cyan('• 🌍 Active Translation')}         (Spanish ➔ Natural English)\n` +
    `  ${chalk.cyan('• ✏️  Grammar Precision')}         (Fill-in-the-blank & Conjugations)\n` +
    `  ${chalk.cyan('• ⚡ Syntax & Error Detection')}   (Structure & Usage Selection)\n\n` +
    `${chalk.dim('Passing threshold:')} ${chalk.bold.green(`${exam.passingScore}/${exam.totalQuestions} (80%)`)} | ${chalk.yellow(`Reward: +${exam.xpReward} XP ⚡`)}`;

  console.log(
    boxen(introText, {
      padding: 1,
      margin: { top: 0, bottom: 1, left: 1, right: 1 },
      borderColor: 'yellow',
      borderStyle: 'round'
    })
  );

  const startConfirm = await safeConfirm({
    message: `Ready to begin the 20-question ${level.toUpperCase()} Checkpoint Exam?`,
    default: true
  });

  if (!startConfirm) {
    return { passed: false, score: 0, total: exam.totalQuestions };
  }

  let score = 0;
  const topicMistakes = {};

  for (let i = 0; i < exam.questions.length; i++) {
    const q = exam.questions[i];
    clearScreen();
    printAppHeader(`Checkpoint ${level.toUpperCase()} • Question ${i + 1}/${exam.totalQuestions}`);

    console.log(chalk.bold.magenta(`  [Question ${i + 1}/${exam.totalQuestions} — ${q.type.toUpperCase()}]`));
    console.log(chalk.dim(`  Skill Area: ${q.topic}\n`));

    let isCorrect = false;

    // 1. Listening Challenge
    if (q.type === 'listening') {
      console.log(chalk.yellow('  🎧 Listen to the spoken sentence and type exactly what you hear.\n'));
      if (isAudioSupported()) {
        const audioSpinner = ora({ text: '🔊 Playing audio through speakers...', color: 'cyan', indent: 2 }).start();
        await playAudio(q.audioText || q.expected || '', { speed: 'normal' });
        audioSpinner.succeed(chalk.green('Audio played 🔊'));
      } else {
        console.log(chalk.dim(`  [Audio unavailable: "${q.audioText}"]`));
      }

      console.log();
      const input = (await safeInput({ message: 'Transcription ›' })).trim();
      const cleanInput = input.toLowerCase().replace(/[.,!?;:]/g, '').trim();
      const cleanExpected = (q.expected || '').toLowerCase().replace(/[.,!?;:]/g, '').trim();

      isCorrect = cleanInput === cleanExpected;
      console.log();
      if (isCorrect) {
        console.log(chalk.bold.green('  ✔ Correct transcription!'));
      } else {
        console.log(chalk.red(`  ✖ Expected: "${chalk.white(q.expected)}"`));
      }
    }

    // 2. Translation Challenge
    else if (q.type === 'translate') {
      console.log(`  ${chalk.bold.yellow('🇪🇸')} ${chalk.bold.white(q.spanish)}`);
      if (q.hint) console.log(`  ${chalk.dim('💡 Hint:')} ${chalk.gray(q.hint)}`);
      console.log();

      const input = (await safeInput({ message: 'Your translation ›' })).trim();
      const evalSpinner = ora({ text: 'Evaluating...', color: 'yellow', indent: 2 }).start();
      try {
        const res = await checkTranslation(q.spanish || '', input, q.expected || '');
        evalSpinner.stop();
        isCorrect = res.isCorrect;
        console.log();
        if (isCorrect) {
          console.log(chalk.bold.green(`  ✔ Accepted! (${res.score}/100)`));
        } else {
          console.log(chalk.red(`  ✖ Needs improvement (${res.score}/100)`));
          console.log(`  ${chalk.dim('🎯 Ideal:')} ${chalk.cyan(q.expected)}`);
        }
      } catch {
        evalSpinner.stop();
        isCorrect = input.toLowerCase() === (q.expected || '').toLowerCase().trim();
      }
    }

    // 3. Fill-in-the-blank Challenge
    else if (q.type === 'fillblank') {
      const sentenceWithHighlight = (q.sentence || '').replace('___', chalk.bold.cyan('___'));
      console.log(`  ${chalk.bold.white(sentenceWithHighlight)}\n`);

      const input = (await safeInput({ message: 'Your answer ›' })).trim();
      isCorrect = input.toLowerCase() === (q.answer || '').toLowerCase().trim();

      console.log();
      if (isCorrect) {
        console.log(chalk.bold.green(`  ✔ Correct! "${q.answer}" is right.`));
      } else {
        console.log(chalk.red(`  ✖ Incorrect. The answer is: "${chalk.white(q.answer)}"`));
        if (q.explanation) console.log(`  ${chalk.dim('Why:')} ${chalk.gray(q.explanation)}`);
      }
    }

    // 4. Multiple Choice Challenge
    else if (q.type === 'choice') {
      console.log(`  ${chalk.bold.white(q.prompt)}\n`);
      const answer = await safeSelect({
        message: 'Choose the best option:',
        choices: q.options || []
      });

      isCorrect = answer === true;
      console.log();
      if (isCorrect) {
        console.log(chalk.bold.green('  ✔ Correct choice!'));
      } else {
        console.log(chalk.red('  ✖ Incorrect option selected.'));
      }
    }

    if (isCorrect) {
      score++;
      updateStreak(true);
      stats.recordCorrect();
    } else {
      updateStreak(false);
      stats.recordIncorrect(`Checkpoint ${level}: ${q.topic}`);
      recordError(`Checkpoint ${level}: ${q.topic}`, q.spanish || q.prompt || q.audioText || '', q.expected || q.answer || '');
      topicMistakes[q.topic] = (topicMistakes[q.topic] || 0) + 1;
    }

    printDivider();
    if (i < exam.questions.length - 1) {
      await safeInput({ message: `${chalk.dim(`[Question ${i + 1}/${exam.totalQuestions} Complete • Score: ${score}] Press [ENTER] ›`)}` });
    }
  }

  // Final Results & Certification
  clearScreen();
  printAppHeader(`Exam Results: ${level.toUpperCase()}`);

  const passed = score >= exam.passingScore;
  const percentage = Math.round((score / exam.totalQuestions) * 100);

  if (passed) {
    const certResult = completeCheckpoint(level, score, exam.totalQuestions);

    const passBanner =
      `${chalk.bold.green('🎉 CONGRATULATIONS! YOU PASSED!')}\n\n` +
      `  ${chalk.bold.yellow(certResult.certificate)}\n\n` +
      `  ${chalk.dim('• Final Score:')}    ${chalk.bold.green(`${score}/${exam.totalQuestions} (${percentage}%)`)}\n` +
      `  ${chalk.dim('• Passing Bar:')}    ${chalk.white(`${exam.passingScore}/${exam.totalQuestions} (80%)`)}\n` +
      `  ${chalk.dim('• XP Earned:')}      ${chalk.bold.yellow(`+${certResult.xpEarned} ⚡`)}\n\n` +
      `${chalk.cyan(`🚀 Unit ${level.toUpperCase()} is officially mastered. The next level is unlocked!`)}`;

    console.log(
      boxen(passBanner, {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'green'
      })
    );
  } else {
    let failBanner =
      `${chalk.bold.red('⚠️ EXAM NOT PASSED')}\n\n` +
      `  ${chalk.dim('• Your Score:')}    ${chalk.red(`${score}/${exam.totalQuestions} (${percentage}%)`)}\n` +
      `  ${chalk.dim('• Needed:')}        ${chalk.white(`${exam.passingScore}/${exam.totalQuestions} (80%)`)}\n\n` +
      `${chalk.yellow('Topics to review before re-taking:')}\n`;

    const weakTopics = Object.entries(topicMistakes).sort((a, b) => b[1] - a[1]);
    for (const [topic, count] of weakTopics) {
      failBanner += `  ${chalk.red('•')} ${chalk.white(topic)} ${chalk.dim(`(${count} mistake${count > 1 ? 's' : ''})`)}\n`;
    }

    failBanner += chalk.gray('\nPractice these lessons in the Learning Path and try again!');

    console.log(
      boxen(failBanner.trim(), {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow'
      })
    );
  }

  await safeInput({ message: 'Press [ENTER] to return to Learning Path ›' });
  return { passed, score, total: exam.totalQuestions };
}
