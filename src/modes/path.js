import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeSelect, safeConfirm, safeInput } from '../ui/prompt.js';
import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import {
  getLessonPhrase,
  getLessonFillBlank,
  getLessonChatPrompt,
  getLessonTheory
} from '../services/tutor.js';
import { loadProgress, completeLesson, isLessonUnlocked } from '../services/progress.js';
import { isCheckpointUnlocked, isLevelCertified, loadCheckpoint } from '../services/checkpoint.js';
import { runCheckpointExam } from './checkpoint.js';
import {
  clearScreen,
  printAppHeader,
  printTheoryCard
} from '../ui/display.js';

import {
  evaluateTranslationExercise,
  evaluateFillBlankExercise,
  evaluateChatExercise
} from './shared/exercises.js';

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
    const completedCount = unitLessons.filter((l) => progress.completedLessons?.includes(l.id)).length;
    const isUnlocked = isLessonUnlocked(unitLessons[0].id, allLessons);
    const isCertified = isLevelCertified(unit.level, progress);

    if (isCertified) {
      unitBadges.push(chalk.bold.green(`[${unit.level} 🎖️ Certified]`));
    } else if (completedCount === unitLessons.length) {
      unitBadges.push(chalk.bold.yellow(`[${unit.level} ⚡ Exam Ready!]`));
    } else if (isUnlocked) {
      unitBadges.push(chalk.cyan(`[${unit.level} 📍 ${completedCount}/${unitLessons.length}]`));
    } else {
      unitBadges.push(chalk.dim(`[${unit.level} 🔒]`));
    }
  }

  console.log('  ' + unitBadges.join('  ') + '\n');
}

async function runExercise(exerciseType, lesson, stats, index, total) {
  console.log(chalk.bold.cyan(`  Exercise [${index + 1}/${total}] • `) + chalk.bold.white(exerciseType.toUpperCase()));
  console.log(chalk.dim(`  Topic: ${lesson.topic}`));
  console.log();

  if (exerciseType === 'translate') {
    const spinner = ora({ text: 'Generating phrase...', color: 'cyan', indent: 2 }).start();
    let phrase;
    try {
      phrase = await getLessonPhrase(lesson);
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
      stats
    });
    return res.isCorrect;
  }

  if (exerciseType === 'fillblank') {
    const spinner = ora({ text: 'Generating blank...', color: 'cyan', indent: 2 }).start();
    let exercise;
    try {
      exercise = await getLessonFillBlank(lesson);
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
      stats
    });
    return res.isCorrect;
  }

  if (exerciseType === 'chat') {
    const spinner = ora({ text: 'Tutor thinking...', color: 'cyan', indent: 2 }).start();
    let promptQuestion;
    try {
      promptQuestion = await getLessonChatPrompt(lesson);
      spinner.stop();
    } catch {
      spinner.fail('Tutor error');
      return false;
    }

    const res = await evaluateChatExercise({
      promptQuestion,
      grammarRule: lesson.grammar,
      stats
    });
    return res.isCorrect;
  }

  return true;
}

async function executeSingleLesson(lesson, stats) {
  clearScreen();
  printAppHeader(`Lesson ${lesson.id}: ${lesson.title}`);

  const theorySpinner = ora({ text: 'Loading theory...', color: 'magenta', indent: 2 }).start();
  try {
    const theory = await getLessonTheory(lesson);
    theorySpinner.stop();
    printTheoryCard(theory, lesson);
    await safeInput({ message: 'Press [ENTER] to start the exercises ›' });
  } catch {
    theorySpinner.stop();
  }

  let passedCount = 0;
  const exercises = lesson.exercises || ['translate', 'fillblank', 'chat'];

  for (let i = 0; i < exercises.length; i++) {
    clearScreen();
    printAppHeader(`Lesson ${lesson.id} • ${lesson.title}`);

    const exType = exercises[i];
    const isSuccess = await runExercise(exType, lesson, stats, i, exercises.length);
    if (isSuccess) passedCount++;

    if (i < exercises.length - 1) {
      console.log();
      await safeInput({ message: `${chalk.dim(`[Exercise ${i + 1}/${exercises.length} Complete] Press [ENTER] to continue ›`)}` });
    }
  }

  clearScreen();
  printAppHeader(`Lesson Summary: ${lesson.id}`);

  const passedThreshold = Math.ceil(exercises.length * 0.6);
  const isPassed = passedCount >= passedThreshold;

  if (isPassed) {
    const xpReward = 50;
    completeLesson(lesson.id, xpReward);

    console.log(
      boxen(
        `${chalk.bold.green('🎉 LESSON COMPLETE!')}\n\n` +
        `${chalk.white(`Score: ${passedCount}/${exercises.length} exercises passed.`)}\n` +
        `${chalk.yellow(`Reward: +${xpReward} XP ⚡`)}\n\n` +
        `${chalk.cyan('Next lesson has been unlocked in your path!')}`,
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
    { name: '🔙 Back to Main Menu (or press Esc)', value: 'BACK' }
  ];

  for (const unit of curriculum.units) {
    for (const lesson of unit.lessons) {
      const isCompleted = progress.completedLessons?.includes(lesson.id);
      const isUnlocked = isLessonUnlocked(lesson.id, allLessons);

      let prefix = '🔒';
      if (isCompleted) prefix = '✅';
      else if (isUnlocked) prefix = '📍';

      choices.push({
        name: `${prefix} [${lesson.id}] ${lesson.title} (${lesson.unitLevel})`,
        value: lesson.id,
        disabled: !isUnlocked ? '(Locked)' : false
      });
    }

    // Add Checkpoint Option if level checkpoint exists
    if (loadCheckpoint(unit.level)) {
      const checkpointUnlocked = isCheckpointUnlocked(unit.level, progress, allLessons);
      const isCertified = isLevelCertified(unit.level, progress);

      const cpName = isCertified
        ? `🎖️  [${unit.level} CHECKPOINT] Certification Exam (Passed ✓)`
        : checkpointUnlocked
        ? `⚡  [${unit.level} CHECKPOINT] 20-Question Certification Exam (Ready!)`
        : `🔒  [${unit.level} CHECKPOINT] Certification Exam (Locked — Complete ${unit.level} units)`;

      choices.push({
        name: cpName,
        value: `CHECKPOINT_${unit.level}`,
        disabled: !checkpointUnlocked ? '(Locked)' : false
      });
    }
  }

  const chosenId = await safeSelect({
    message: 'Select a lesson or Checkpoint Exam (Esc to go back):',
    choices
  });

  if (!chosenId || chosenId === 'BACK') return;

  // Handle Checkpoint Selection
  if (chosenId.startsWith('CHECKPOINT_')) {
    const level = chosenId.replace('CHECKPOINT_', '');
    await runCheckpointExam(level, stats);
    return;
  }

  let currentLesson = allLessons.find((l) => l.id === chosenId);

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
