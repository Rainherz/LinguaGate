import ora from 'ora';
import chalk from 'chalk';
import { checkTranslation, checkGrammar, chatReply } from '../../services/tutor.js';
import { updateStreak, recordError } from '../../services/history.js';
import { playAudio, isAudioSupported } from '../../services/audio.js';
import { gradeFillBlank, sanitizeForSpeech, parseAudioAction } from '../../services/grading.js';
import { printError, printBotReply } from '../../ui/display.js';
import { safeInput } from '../../ui/prompt.js';

/**
 * Interactive exercise flows shared across modes.
 *
 * These live under modes/ rather than services/ because they are terminal
 * orchestration: they prompt, print, spin, and drive the session. They compose
 * the pure rules from services/grading.js with the AI port and the history
 * store — but they are not themselves a service.
 */

/**
 * Prompts user with options to listen to the phrase audio (1.0x / 0.7x) or continue immediately.
 * @param {string} phrase
 */
export async function promptAudioFollowup(phrase) {
  if (!phrase || !isAudioSupported()) return;

  const cleanPhrase = sanitizeForSpeech(phrase);
  if (!cleanPhrase) return;

  while (true) {
    const action = parseAudioAction(
      await safeInput({
        message: `${chalk.dim('[ENTER] Next')} • ${chalk.cyan('[a] 🔊 Audio')} • ${chalk.yellow('[s] 🐢 Slow')} ›`
      })
    );

    if (action === 'continue') break;

    if (action === 'normal') {
      const spinner = ora({ text: '🔊 Playing native pronunciation...', color: 'cyan', indent: 2 }).start();
      await playAudio(cleanPhrase, { speed: 'normal' });
      spinner.succeed(chalk.green('Audio played 🔊'));
      console.log();
    } else if (action === 'slow') {
      const spinner = ora({ text: '🐢 Playing slow pronunciation (0.7x)...', color: 'yellow', indent: 2 }).start();
      await playAudio(cleanPhrase, { speed: 'slow' });
      spinner.succeed(chalk.green('Slow audio played 🐢'));
      console.log();
    }
  }
}

export async function evaluateTranslationExercise({
  spanish,
  expectedEnglish,
  hint,
  grammarRule = 'translation error',
  stats
}) {
  console.log(`  ${chalk.bold.yellow('🇪🇸')} ${chalk.bold.white(spanish)}`);
  if (hint) {
    console.log(`  ${chalk.dim('💡 Hint:')} ${chalk.gray(hint)}\n`);
  }

  const input = (await safeInput({ message: 'Your translation ›' })).trim();
  if (!input || input === '/quit') return { isCorrect: false, score: 0, quit: input === '/quit' };

  const evalSpinner = ora({ text: 'Evaluating...', color: 'yellow', indent: 2 }).start();
  let evaluation;
  try {
    evaluation = await checkTranslation(spanish, input, expectedEnglish);
    evalSpinner.stop();
  } catch {
    evalSpinner.fail('Evaluation failed');
    return { isCorrect: false, score: 0 };
  }

  console.log();
  if (evaluation.isCorrect) {
    if (evaluation.score === 100) {
      console.log(chalk.bold.green(`  ✔ Perfect! (100/100)`));
    } else {
      console.log(chalk.green(`  ✔ Accepted! (${evaluation.score}/100)`));
    }
    if (evaluation.feedback) {
      console.log(chalk.gray(`  💬 ${evaluation.feedback}`));
    }
    console.log(`  ${chalk.dim('🎯 Ideal:')} ${chalk.cyan(expectedEnglish)}\n`);
    updateStreak(true);
    stats.recordCorrect();
    await promptAudioFollowup(expectedEnglish);
    return { isCorrect: true, score: evaluation.score };
  } else {
    console.log(chalk.red(`  ✖ Needs improvement (${evaluation.score}/100)`));
    if (evaluation.feedback) {
      console.log(chalk.gray(`  💬 ${evaluation.feedback}`));
    }
    console.log(`  ${chalk.dim('🎯 Expected:')} ${chalk.cyan(expectedEnglish)}\n`);

    if (evaluation.errors?.length > 0) {
      for (const err of evaluation.errors) {
        console.log(`  ${chalk.red('❌')} ${chalk.yellow(err.wrong)} ${chalk.dim('→')} ${chalk.green(err.correct)}`);
        console.log(`     ${chalk.bold.white(err.rule)}: ${chalk.gray(err.theory)}`);
        if (err.example) console.log(`     ${chalk.dim('e.g.')} ${chalk.italic.gray(err.example)}`);
        console.log();
        recordError(err.rule, spanish, expectedEnglish);
      }
    }
    updateStreak(false);
    stats.recordIncorrect(grammarRule);
    await promptAudioFollowup(expectedEnglish);
    return { isCorrect: false, score: evaluation.score };
  }
}

export async function evaluateFillBlankExercise({
  sentence,
  answer,
  hint,
  explanation,
  grammarRule = 'fill-in-the-blank error',
  stats
}) {
  const sentenceWithHighlight = sentence.replace('___', chalk.bold.cyan('___'));
  console.log(`  ${chalk.bold.white(sentenceWithHighlight)}`);
  if (hint) {
    console.log(`  ${chalk.dim('💡 Hint:')} ${chalk.gray(hint)}\n`);
  }

  const input = (await safeInput({ message: 'Your answer ›' })).trim();
  if (!input || input === '/quit') return { isCorrect: false, quit: input === '/quit' };

  const isMatch = gradeFillBlank(input, answer);
  console.log();
  const fullSentence = sentence.replace('___', answer);

  if (isMatch) {
    console.log(chalk.green(`  ✔ Correct! "${answer}" is right.\n`));
    updateStreak(true);
    stats.recordCorrect();
    await promptAudioFollowup(fullSentence);
    return { isCorrect: true };
  } else {
    console.log(chalk.red(`  ✖ Incorrect. The answer is: "${chalk.white(answer)}"`));
    if (explanation) {
      console.log(`  ${chalk.dim('Why:')} ${chalk.gray(explanation)}`);
    }
    console.log();
    updateStreak(false);
    stats.recordIncorrect(grammarRule);
    recordError(grammarRule, sentence, answer);
    await promptAudioFollowup(fullSentence);
    return { isCorrect: false };
  }
}

export async function evaluateChatExercise({
  promptQuestion,
  grammarRule = 'conversation error',
  stats
}) {
  console.log(`  ${chalk.bold.blue('🤖 Tutor:')} ${chalk.white(promptQuestion)}`);
  if (grammarRule) {
    console.log(`  ${chalk.dim(`(Practice: ${grammarRule})`)}\n`);
  }

  const input = (await safeInput({ message: 'Your reply ›' })).trim();
  if (!input || input === '/quit') return { isCorrect: false, quit: input === '/quit' };

  const checkSpinner = ora({ text: 'Checking grammar...', color: 'yellow', indent: 2 }).start();
  let result;
  try {
    result = await checkGrammar(input);
    checkSpinner.stop();
  } catch {
    checkSpinner.fail('Check failed');
    return { isCorrect: false };
  }

  console.log();
  if (result.isCorrect) {
    console.log(chalk.green('  ✔ Great grammar!'));
    const reply = await chatReply(input);
    printBotReply(reply);
    updateStreak(true);
    stats.recordCorrect();
    await promptAudioFollowup(reply);
    return { isCorrect: true };
  } else {
    printError(result);
    updateStreak(false);
    stats.recordIncorrect(grammarRule);
    result.corrections?.forEach((c) => recordError(c.rule, input, result.correctedText));
    if (result.correctedText) {
      await promptAudioFollowup(result.correctedText);
    }
    return { isCorrect: false };
  }
}
