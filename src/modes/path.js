import readline from 'node:readline';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { select } from '@inquirer/prompts';
import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import {
  getLessonPhrase,
  getLessonFillBlank,
  getLessonChatPrompt,
  getLessonTheory,
  checkTranslation,
  checkGrammar,
  chatReply
} from '../services/agy.js';
import { loadProgress, completeLesson, isLessonUnlocked } from '../services/progress.js';
import { recordError, updateStreak } from '../services/history.js';
import {
  clearScreen,
  printAppHeader,
  printStreak,
  printDivider,
  printError,
  printBotReply,
  printTheoryCard
} from '../ui/display.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const curriculumPath = join(__dirname, '../curriculum.json');
const curriculum = JSON.parse(readFileSync(curriculumPath, 'utf-8'));

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function getAllLessons() {
  const list = [];
  for (const unit of curriculum.units) {
    for (const lesson of unit.lessons) {
      list.push({ ...lesson, unitTitle: unit.title, unitLevel: unit.level });
    }
  }
  return list;
}

function renderOverview(progress, allLessons) {
  let unitBadges = [];
  for (const unit of curriculum.units) {
    const unitLessons = unit.lessons;
    const completedCount = unitLessons.filter((l) => progress.completedLessons.includes(l.id)).length;
    const isUnlocked = isLessonUnlocked(unitLessons[0].id, allLessons);

    if (completedCount === unitLessons.length) {
      unitBadges.push(chalk.green(`[${unit.level} ✓]`));
    } else if (isUnlocked) {
      unitBadges.push(chalk.bold.yellow(`[${unit.level} 📍 ${completedCount}/${unitLessons.length}]`));
    } else {
      unitBadges.push(chalk.dim(`[${unit.level} 🔒]`));
    }
  }

  console.log('  ' + unitBadges.join('  ') + '\n');
}

async function runExercise(exerciseType, lesson, stats, rl, index, total) {
  console.log(chalk.bold.cyan(`  Exercise [${index + 1}/${total}] • `) + chalk.bold.white(exerciseType.toUpperCase()));
  console.log(chalk.dim(`  Topic: ${lesson.topic}`));
  console.log();

  if (exerciseType === 'translate') {
    const spinner = ora({ text: 'Generating phrase...', color: 'cyan', indent: 2 }).start();
    let phrase;
    try {
      phrase = getLessonPhrase(lesson);
      spinner.stop();
    } catch (err) {
      spinner.fail('Error generating phrase');
      return false;
    }

    console.log(`  ${chalk.bold.yellow('🇪🇸')} ${chalk.bold.white(phrase.spanish)}`);
    console.log(`  ${chalk.dim('💡 Hint:')} ${chalk.gray(phrase.hint)}\n`);

    const input = (await ask(rl, chalk.bold.green('  Your translation › '))).trim();
    if (!input) return false;

    const evalSpinner = ora({ text: 'Evaluating...', color: 'yellow', indent: 2 }).start();
    let evaluation;
    try {
      evaluation = checkTranslation(phrase.spanish, input, phrase.english);
      evalSpinner.stop();
    } catch (err) {
      evalSpinner.fail('Evaluation failed');
      return false;
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
      console.log(`  ${chalk.dim('🎯 Ideal:')} ${chalk.cyan(phrase.english)}\n`);
      updateStreak(true);
      stats.recordCorrect();
      return true;
    } else {
      console.log(chalk.red(`  ✖ Needs improvement (${evaluation.score}/100)`));
      if (evaluation.feedback) {
        console.log(chalk.gray(`  💬 ${evaluation.feedback}`));
      }
      console.log(`  ${chalk.dim('🎯 Expected:')} ${chalk.cyan(phrase.english)}\n`);

      if (evaluation.errors?.length > 0) {
        for (const err of evaluation.errors) {
          console.log(`  ${chalk.red('❌')} ${chalk.yellow(err.wrong)} ${chalk.dim('→')} ${chalk.green(err.correct)}`);
          console.log(`     ${chalk.bold.white(err.rule)}: ${chalk.gray(err.theory)}`);
          if (err.example) console.log(`     ${chalk.dim('e.g.')} ${chalk.italic.gray(err.example)}`);
          console.log();
          recordError(err.rule, phrase.spanish, phrase.english);
        }
      }
      updateStreak(false);
      stats.recordIncorrect(lesson.grammar);
      return false;
    }
  }

  if (exerciseType === 'fillblank') {
    const spinner = ora({ text: 'Generating blank...', color: 'cyan', indent: 2 }).start();
    let exercise;
    try {
      exercise = getLessonFillBlank(lesson);
      spinner.stop();
    } catch (err) {
      spinner.fail('Error loading exercise');
      return false;
    }

    const sentenceWithHighlight = exercise.sentence.replace('___', chalk.bold.cyan('___'));
    console.log(`  ${chalk.bold.white(sentenceWithHighlight)}`);
    console.log(`  ${chalk.dim('💡 Hint:')} ${chalk.gray(exercise.hint)}\n`);

    const input = (await ask(rl, chalk.bold.green('  Your answer › '))).trim();
    if (!input) return false;

    const isMatch = input.toLowerCase() === exercise.answer.toLowerCase();
    console.log();
    if (isMatch) {
      console.log(chalk.green(`  ✔ Correct! "${exercise.answer}" is right.\n`));
      updateStreak(true);
      stats.recordCorrect();
      return true;
    } else {
      console.log(chalk.red(`  ✖ Incorrect. The answer is: "${chalk.white(exercise.answer)}"`));
      if (exercise.explanation) {
        console.log(`  ${chalk.dim('Why:')} ${chalk.gray(exercise.explanation)}`);
      }
      console.log();
      updateStreak(false);
      stats.recordIncorrect(lesson.grammar);
      recordError(lesson.grammar, exercise.sentence, exercise.answer);
      return false;
    }
  }

  if (exerciseType === 'chat') {
    const spinner = ora({ text: 'Tutor thinking...', color: 'cyan', indent: 2 }).start();
    let promptQuestion;
    try {
      promptQuestion = getLessonChatPrompt(lesson);
      spinner.stop();
    } catch (err) {
      spinner.fail('Tutor error');
      return false;
    }

    console.log(`  ${chalk.bold.blue('🤖 Tutor:')} ${chalk.white(promptQuestion)}`);
    console.log(`  ${chalk.dim(`(Practice: ${lesson.grammar})`)}\n`);

    const input = (await ask(rl, chalk.bold.green('  Your reply › '))).trim();
    if (!input) return false;

    const checkSpinner = ora({ text: 'Checking grammar...', color: 'yellow', indent: 2 }).start();
    let result;
    try {
      result = checkGrammar(input);
      checkSpinner.stop();
    } catch (err) {
      checkSpinner.fail('Check failed');
      return false;
    }

    console.log();
    if (result.isCorrect) {
      console.log(chalk.green('  ✔ Great grammar!'));
      const reply = chatReply(input);
      printBotReply(reply);
      updateStreak(true);
      stats.recordCorrect();
      return true;
    } else {
      printError(result);
      updateStreak(false);
      stats.recordIncorrect(lesson.grammar);
      result.corrections?.forEach((c) => recordError(c, input, result.correctedText));
      return false;
    }
  }

  return true;
}

export async function runPath(stats) {
  clearScreen();
  printAppHeader('Learning Path');

  const allLessons = getAllLessons();
  const progress = loadProgress();

  renderOverview(progress, allLessons);

  const choices = allLessons.map((lesson) => {
    const isCompleted = progress.completedLessons.includes(lesson.id);
    const isUnlocked = isLessonUnlocked(lesson.id, allLessons);

    let prefix = '🔒';
    if (isCompleted) prefix = '✅';
    else if (isUnlocked) prefix = '📍';

    return {
      name: `${prefix} [${lesson.id}] ${lesson.title} (${lesson.unitLevel})`,
      value: lesson.id,
      disabled: !isUnlocked ? '(Locked)' : false
    };
  });

  choices.push({ name: '🔙 Back to Main Menu', value: 'BACK' });

  const chosenLessonId = await select({
    message: 'Select a lesson to start:',
    choices
  });

  if (chosenLessonId === 'BACK') return;

  const lesson = allLessons.find((l) => l.id === chosenLessonId);

  // Clear and display clean lesson header
  clearScreen();
  printAppHeader(`Lesson ${lesson.id}: ${lesson.title}`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const theorySpinner = ora({ text: 'Loading theory...', color: 'magenta', indent: 2 }).start();
  try {
    const theory = getLessonTheory(lesson);
    theorySpinner.stop();
    printTheoryCard(theory, lesson);
    await ask(rl, chalk.bold.green('  Press [ENTER] to start the exercises › '));
  } catch (err) {
    theorySpinner.stop();
  }

  let passedCount = 0;
  const exercises = lesson.exercises || ['translate', 'fillblank', 'chat'];

  for (let i = 0; i < exercises.length; i++) {
    clearScreen();
    printAppHeader(`Lesson ${lesson.id} • ${lesson.title}`);

    const exType = exercises[i];
    let passed = false;
    let attempts = 0;
    while (!passed && attempts < 2) {
      attempts++;
      passed = await runExercise(exType, lesson, stats, rl, i, exercises.length);
      if (!passed && attempts < 2) {
        console.log(chalk.yellow('  🔄 Let’s retry this exercise to reinforce the rule.\n'));
      }
    }

    if (passed) passedCount++;
    if (i < exercises.length - 1) {
      await ask(rl, chalk.dim('  Press [ENTER] for next exercise › '));
    }
  }

  rl.close();

  // Evaluate Lesson Completion
  clearScreen();
  printAppHeader(`Lesson ${lesson.id} Complete`);

  if (passedCount >= Math.ceil(exercises.length * 0.7)) {
    const earnedXp = 50 + passedCount * 10;
    completeLesson(lesson.id, earnedXp);
    console.log(
      boxen(
        `${chalk.bold.green('🎉 LESSON PASSED!')}\n\n` +
        `${chalk.white(`Score: ${passedCount}/${exercises.length} exercises`)}\n` +
        `${chalk.yellow(`Earned: +${earnedXp} XP ⚡`)}\n\n` +
        `${chalk.cyan('Next lesson is now unlocked!')}`,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'green'
        }
      )
    );
  } else {
    console.log(
      boxen(
        `${chalk.bold.yellow('⚠️ LESSON INCOMPLETE')}\n\n` +
        `${chalk.white(`Score: ${passedCount}/${exercises.length} exercises`)}\n` +
        `${chalk.gray('Review the theory and try again to unlock the next level!')}`,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'yellow'
        }
      )
    );
  }
}
