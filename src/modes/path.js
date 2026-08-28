import readline from 'node:readline';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeSelect, safeConfirm } from '../ui/prompt.js';
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

import {
  evaluateTranslationExercise,
  evaluateFillBlankExercise,
  evaluateChatExercise
} from '../services/evaluator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const curriculumPath = join(__dirname, '../curriculum.json');
const curriculum = JSON.parse(readFileSync(curriculumPath, 'utf-8'));

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
    } catch {
      spinner.fail('Error generating phrase');
      return false;
    }

    const res = await evaluateTranslationExercise({
      spanish: phrase.spanish,
      expectedEnglish: phrase.english,
      hint: phrase.hint,
      grammarRule: lesson.grammar,
      stats,
      rl
    });
    return res.isCorrect;
  }

  if (exerciseType === 'fillblank') {
    const spinner = ora({ text: 'Generating blank...', color: 'cyan', indent: 2 }).start();
    let exercise;
    try {
      exercise = getLessonFillBlank(lesson);
      spinner.stop();
    } catch {
      spinner.fail('Error loading exercise');
      return false;
    }

    const res = await evaluateFillBlankExercise({
      sentence: exercise.sentence,
      answer: exercise.answer,
      hint: exercise.hint,
      explanation: exercise.explanation,
      grammarRule: lesson.grammar,
      stats,
      rl
    });
    return res.isCorrect;
  }

  if (exerciseType === 'chat') {
    const spinner = ora({ text: 'Tutor thinking...', color: 'cyan', indent: 2 }).start();
    let promptQuestion;
    try {
      promptQuestion = getLessonChatPrompt(lesson);
      spinner.stop();
    } catch {
      spinner.fail('Tutor error');
      return false;
    }

    const res = await evaluateChatExercise({
      promptQuestion,
      grammarRule: lesson.grammar,
      stats,
      rl
    });
    return res.isCorrect;
  }

  return true;
}


async function executeSingleLesson(lesson, stats) {
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

  clearScreen();
  printAppHeader(`Lesson ${lesson.id} Complete`);

  const passedThreshold = Math.ceil(exercises.length * 0.7);
  const isPassed = passedCount >= passedThreshold;

  if (isPassed) {
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
        `${chalk.white(`Score: ${passedCount}/${exercises.length} exercises (needed ${passedThreshold})`)}\n` +
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

  return isPassed;
}

export async function runPath(stats) {
  clearScreen();
  printAppHeader('Learning Path');

  const allLessons = getAllLessons();
  const progress = loadProgress();

  renderOverview(progress, allLessons);

  const choices = [
    { name: '🔙 Back to Main Menu (or press Esc)', value: 'BACK' },
    ...allLessons.map((lesson) => {
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
    })
  ];

  const chosenLessonId = await safeSelect({
    message: 'Select a lesson to start (Esc to go back):',
    choices
  });

  if (!chosenLessonId || chosenLessonId === 'BACK') return;

  let currentLesson = allLessons.find((l) => l.id === chosenLessonId);

  while (currentLesson) {
    const isPassed = await executeSingleLesson(currentLesson, stats);

    if (isPassed) {
      const currentIndex = allLessons.findIndex((l) => l.id === currentLesson.id);
      const nextLesson = allLessons[currentIndex + 1];

      if (nextLesson) {
        const continueNext = await safeConfirm({
          message: `Continue directly to next lesson (${nextLesson.id}: ${nextLesson.title})?`,
          default: true
        });

        if (continueNext) {
          currentLesson = nextLesson;
          continue;
        }
      }
      break;
    } else {
      const retryLesson = await safeConfirm({
        message: `Retry this lesson (${currentLesson.id}: ${currentLesson.title})?`,
        default: true
      });

      if (retryLesson) {
        continue;
      }
      break;
    }
  }
}

