import readline from 'node:readline';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { select, confirm } from '@inquirer/prompts';
import ora from 'ora';
import chalk from 'chalk';
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
import { printStreak, printDivider, printError, printBotReply } from '../ui/display.js';

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

function renderMap() {
  const progress = loadProgress();
  const allLessons = getAllLessons();

  console.log(chalk.bold.cyan('\n🗺️  CEFR LEARNING PATH (A1 ➔ C1)'));
  console.log(chalk.yellow(`   ⚡ XP: ${progress.xp} | 🏆 Completed: ${progress.completedLessons.length}/${allLessons.length} lessons\n`));

  for (const unit of curriculum.units) {
    console.log(chalk.bold.magenta(`  [${unit.level}] ${unit.title.toUpperCase()}`) + chalk.gray(` — ${unit.description}`));
    for (const lesson of unit.lessons) {
      const isCompleted = progress.completedLessons.includes(lesson.id);
      const isUnlocked = isLessonUnlocked(lesson.id, allLessons);

      let icon = chalk.gray('🔒 [Locked]');
      let titleFormatted = chalk.gray(`${lesson.id}: ${lesson.title}`);

      if (isCompleted) {
        icon = chalk.green('✅ [Done]');
        titleFormatted = chalk.white(`${lesson.id}: ${lesson.title}`);
      } else if (isUnlocked) {
        icon = chalk.bold.yellow('📍 [Ready]');
        titleFormatted = chalk.bold.cyan(`${lesson.id}: ${lesson.title}`);
      }

      console.log(`    ${icon} ${titleFormatted}`);
    }
    console.log();
  }
}

async function runExercise(exerciseType, lesson, stats, rl) {
  if (exerciseType === 'translate') {
    const spinner = ora({ text: 'Generating lesson phrase...', color: 'cyan', indent: 4 }).start();
    let phrase;
    try {
      phrase = getLessonPhrase(lesson);
      spinner.stop();
    } catch (err) {
      spinner.fail('Error generating phrase');
      return false;
    }

    console.log(chalk.bold.yellow(`\n    🇪🇸 ${phrase.spanish}`));
    console.log(chalk.gray(`    💡 Grammar Hint (${lesson.grammar}): ${phrase.hint}\n`));

    const input = (await ask(rl, chalk.bold.green('    Your translation › '))).trim();
    if (!input) return false;

    const evalSpinner = ora({ text: 'Evaluating...', color: 'yellow', indent: 4 }).start();
    let evaluation;
    try {
      evaluation = checkTranslation(phrase.spanish, input, phrase.english);
      evalSpinner.stop();
    } catch (err) {
      evalSpinner.fail('Evaluation failed');
      return false;
    }

    if (evaluation.isCorrect) {
      if (evaluation.score === 100) {
        console.log(chalk.bold.green(`    ✔ Perfect! (100/100)`));
      } else {
        console.log(chalk.green(`    ✔ Accepted! (${evaluation.score}/100)`));
      }
      if (evaluation.feedback) {
        console.log(chalk.gray(`    💬 Feedback: ${evaluation.feedback}`));
      }
      console.log(chalk.cyan(`    🎯 Ideal Translation: `) + chalk.white(phrase.english) + '\n');
      updateStreak(true);
      stats.recordCorrect();
      return true;
    } else {
      console.log(chalk.red(`    ✖ Needs improvement (${evaluation.score}/100)`));
      if (evaluation.feedback) {
        console.log(chalk.gray(`    💬 Feedback: ${evaluation.feedback}\n`));
      }
      console.log(chalk.cyan(`    🎯 Expected Translation: `) + chalk.white(phrase.english) + '\n');

      if (evaluation.errors?.length > 0) {
        for (const err of evaluation.errors) {
          console.log(chalk.yellow(`    ❌ "${err.wrong}" → "${err.correct}"`));
          console.log(chalk.bold.white(`       📖 ${err.rule}`));
          console.log(chalk.gray(`       ${err.theory}`));
          console.log(chalk.gray(`       e.g. "${err.example}"\n`));
          recordError(err.rule, phrase.spanish, phrase.english);
        }
      }
      updateStreak(false);
      stats.recordIncorrect(lesson.grammar);
      return false;
    }
  }

  if (exerciseType === 'fillblank') {
    const spinner = ora({ text: 'Generating fill-in-the-blank...', color: 'cyan', indent: 4 }).start();
    let exercise;
    try {
      exercise = getLessonFillBlank(lesson);
      spinner.stop();
    } catch (err) {
      spinner.fail('Error loading exercise');
      return false;
    }

    const sentenceWithHighlight = exercise.sentence.replace('___', chalk.bold.cyan('___'));
    console.log(chalk.bold(`\n    ${sentenceWithHighlight}`));
    console.log(chalk.gray(`    💡 Hint: ${exercise.hint}\n`));

    const input = (await ask(rl, chalk.bold.green('    Your answer › '))).trim();
    if (!input) return false;

    const isMatch = input.toLowerCase() === exercise.answer.toLowerCase();
    if (isMatch) {
      console.log(chalk.green(`    ✔ Correct! "${exercise.answer}" fits perfectly.`));
      updateStreak(true);
      stats.recordCorrect();
      return true;
    } else {
      console.log(chalk.red(`    ✖ Incorrect. Correct answer: "${chalk.white(exercise.answer)}"`));
      if (exercise.explanation) {
        console.log(chalk.gray(`    Why: ${exercise.explanation}`));
      }
      updateStreak(false);
      stats.recordIncorrect(lesson.grammar);
      recordError(lesson.grammar, exercise.sentence, exercise.answer);
      return false;
    }
  }

  if (exerciseType === 'chat') {
    const spinner = ora({ text: 'Tutor is preparing a question...', color: 'cyan', indent: 4 }).start();
    let promptQuestion;
    try {
      promptQuestion = getLessonChatPrompt(lesson);
      spinner.stop();
    } catch (err) {
      spinner.fail('Tutor error');
      return false;
    }

    console.log(chalk.bold.blue(`\n    🤖 Tutor: `) + chalk.white(promptQuestion));
    console.log(chalk.gray(`    (Respond using: ${lesson.grammar})\n`));

    const input = (await ask(rl, chalk.bold.green('    Your reply › '))).trim();
    if (!input) return false;

    const checkSpinner = ora({ text: 'Analyzing response...', color: 'yellow', indent: 4 }).start();
    let result;
    try {
      result = checkGrammar(input);
      checkSpinner.stop();
    } catch (err) {
      checkSpinner.fail('Check failed');
      return false;
    }

    if (result.isCorrect) {
      console.log(chalk.green('    ✔ Great grammar!'));
      const reply = chatReply(input);
      printBotReply(`    ${reply}`);
      updateStreak(true);
      stats.recordCorrect();
      return true;
    } else {
      console.log(chalk.red('    ✖ Grammar issue:'));
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
  renderMap();

  const allLessons = getAllLessons();
  const progress = loadProgress();

  const choices = allLessons.map((lesson) => {
    const isCompleted = progress.completedLessons.includes(lesson.id);
    const isUnlocked = isLessonUnlocked(lesson.id, allLessons);

    let prefix = '🔒';
    if (isCompleted) prefix = '✅';
    else if (isUnlocked) prefix = '📍';

    return {
      name: `${prefix} [${lesson.id}] ${lesson.title} (${lesson.unitLevel} - ${lesson.grammar})`,
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

  console.log(chalk.bold.cyan(`\n══════════════════════════════════════════════════════════════════`));
  console.log(chalk.bold.yellow(`  LESSON ${lesson.id}: ${lesson.title.toUpperCase()}`));
  console.log(chalk.cyan(`  Focus: `) + chalk.white(lesson.grammar));
  console.log(chalk.cyan(`  Topic: `) + chalk.white(lesson.topic));
  console.log(chalk.bold.cyan(`══════════════════════════════════════════════════════════════════\n`));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const theorySpinner = ora({ text: 'Preparando píldora teórica...', color: 'magenta', indent: 2 }).start();
  try {
    const theory = getLessonTheory(lesson);
    theorySpinner.stop();
    console.log(chalk.bold.magenta('┌─── 📖 PÍLDORA TEÓRICA ───────────────────────────────────────────┐'));
    console.log(chalk.white(`│  ${chalk.bold(theory.title || lesson.title)}`));
    console.log(chalk.gray(`│  ${theory.explanation}\n│`));
    if (theory.rules) {
      theory.rules.forEach((r) => {
        console.log(chalk.yellow(`│  • ${r.rule}`));
        console.log(chalk.white(`│    Ejemplo: ${r.example}`));
        if (r.note) console.log(chalk.gray(`│    Ojo: ${r.note}`));
        console.log(chalk.gray('│'));
      });
    }
    if (theory.tip) {
      console.log(chalk.bold.cyan(`│  💡 Regla de oro: ${theory.tip}`));
    }
    console.log(chalk.bold.magenta('└──────────────────────────────────────────────────────────────────┘\n'));
    await ask(rl, chalk.bold.green('  Presioná [ENTER] cuando estés listo para los ejercicios › '));
  } catch (err) {
    theorySpinner.stop();
  }

  let passedCount = 0;
  const exercises = lesson.exercises || ['translate', 'fillblank', 'chat'];

  for (let i = 0; i < exercises.length; i++) {
    const exType = exercises[i];
    console.log(chalk.bold.magenta(`\n  [Exercise ${i + 1}/${exercises.length}: ${exType.toUpperCase()}]`));

    let passed = false;
    let attempts = 0;
    while (!passed && attempts < 2) {
      attempts++;
      passed = await runExercise(exType, lesson, stats, rl);
      if (!passed && attempts < 2) {
        console.log(chalk.yellow('    🔄 Let’s retry this exercise before moving forward.\n'));
      }
    }

    if (passed) passedCount++;
    printDivider();
  }

  rl.close();

  // Evaluate Lesson Completion
  if (passedCount >= Math.ceil(exercises.length * 0.7)) {
    const earnedXp = 50 + passedCount * 10;
    completeLesson(lesson.id, earnedXp);
    console.log(chalk.bold.green(`\n🎉 LESSON COMPLETE! You earned +${earnedXp} XP! 🚀`));
    console.log(chalk.green(`Next lesson unlocked!\n`));
  } else {
    console.log(chalk.bold.yellow(`\n⚠️ Lesson ended. Score: ${passedCount}/${exercises.length}. Try again to unlock next lesson!\n`));
  }
}
