import ora from 'ora';
import chalk from 'chalk';
import { checkTranslation, checkGrammar, chatReply } from './agy.js';
import { updateStreak, recordError } from './history.js';
import { printError, printBotReply } from '../ui/display.js';
import { safeInput } from '../ui/prompt.js';

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
    evaluation = checkTranslation(spanish, input, expectedEnglish);
    evalSpinner.stop();
  } catch (err) {
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

  const isMatch = input.toLowerCase() === answer.toLowerCase().trim();
  console.log();
  if (isMatch) {
    console.log(chalk.green(`  ✔ Correct! "${answer}" is right.\n`));
    updateStreak(true);
    stats.recordCorrect();
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
    result = checkGrammar(input);
    checkSpinner.stop();
  } catch (err) {
    checkSpinner.fail('Check failed');
    return { isCorrect: false };
  }

  console.log();
  if (result.isCorrect) {
    console.log(chalk.green('  ✔ Great grammar!'));
    const reply = chatReply(input);
    printBotReply(reply);
    updateStreak(true);
    stats.recordCorrect();
    return { isCorrect: true };
  } else {
    printError(result);
    updateStreak(false);
    stats.recordIncorrect(grammarRule);
    result.corrections?.forEach((c) => recordError(c, input, result.correctedText));
    return { isCorrect: false };
  }
}
