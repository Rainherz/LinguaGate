import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeSelect, safeInput, safeConfirm } from '../ui/prompt.js';
import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import { checkTranslation } from '../services/agy.js';
import { unlockUpToLevel } from '../services/progress.js';
import { clearScreen, printAppHeader, printDivider } from '../ui/display.js';

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

export const PLACEMENT_QUESTIONS = [
  {
    level: 'A1',
    type: 'choice',
    prompt: 'She ___ to the gym every morning.',
    options: [
      { name: 'go', value: false },
      { name: 'goes', value: true },
      { name: 'going', value: false },
      { name: 'is go', value: false }
    ],
    rule: 'Third-person singular present simple (he/she/it takes -s/-es)',
    category: 'Present Simple & Subject-Verb Agreement'
  },
  {
    level: 'A2',
    type: 'choice',
    prompt: 'Yesterday we ___ a fantastic movie at the cinema.',
    options: [
      { name: 'see', value: false },
      { name: 'saw', value: true },
      { name: 'seen', value: false },
      { name: 'have saw', value: false }
    ],
    rule: 'Past simple irregular verb (see ➔ saw)',
    category: 'Past Simple & Irregular Verbs'
  },
  {
    level: 'B1',
    type: 'choice',
    prompt: 'If it ___ tomorrow, we will cancel the picnic.',
    options: [
      { name: 'rains', value: true },
      { name: 'will rain', value: false },
      { name: 'rained', value: false },
      { name: 'is raining', value: false }
    ],
    rule: 'First conditional (If + present simple, will + base verb)',
    category: 'First Conditional (Cause & Effect)'
  },
  {
    level: 'B1',
    type: 'choice',
    prompt: 'I have lived in this city ___ five years.',
    options: [
      { name: 'since', value: false },
      { name: 'for', value: true },
      { name: 'during', value: false },
      { name: 'from', value: false }
    ],
    rule: 'Present perfect with duration ("for" a period vs "since" a point in time)',
    category: 'Present Perfect (Time Prepositions)'
  },
  {
    level: 'B2',
    type: 'translate',
    spanish: 'Si hubiera tenido dinero, habría viajado a Japón.',
    correct: 'If I had had money, I would have traveled to Japan.',
    rule: 'Third conditional for past hypothetical regret (If + past perfect, would have + participle)',
    category: 'Third Conditional & Past Regrets'
  },
  {
    level: 'C1',
    type: 'choice',
    prompt: 'Hardly ___ the door when the alarm went off.',
    options: [
      { name: 'I had opened', value: false },
      { name: 'had I opened', value: true },
      { name: 'did I opened', value: false },
      { name: 'was I opened', value: false }
    ],
    rule: 'Negative inversion for emphasis (Hardly had I... when...)',
    category: 'Negative Inversion & Emphasis'
  }
];

const LEVEL_PROFILES = {
  A1: {
    title: 'A1 — Beginner (Foundations)',
    description: 'You are building foundational basics: core pronouns, present tense, everyday vocabulary, and simple sentence structures.',
    color: 'green'
  },
  A2: {
    title: 'A2 — Elementary (Everyday Fluency)',
    description: 'You understand routine expressions and basic past/future sentences. Next milestone: connecting complex thoughts and irregular verbs.',
    color: 'cyan'
  },
  B1: {
    title: 'B1 — Intermediate (Independent Communicator)',
    description: 'You communicate comfortably in daily situations and understand standard conditionals. Next milestone: passive voice and past regrets.',
    color: 'yellow'
  },
  B2: {
    title: 'B2 — Upper-Intermediate (Professional Proficiency)',
    description: 'You express nuanced opinions and hypothetical ideas with confidence. Next milestone: advanced inversion and academic structures.',
    color: 'magenta'
  },
  C1: {
    title: 'C1 — Advanced (Near-Native Mastery)',
    description: 'You demonstrate mastery over sophisticated grammar, negative fronting, and nuanced technical English.',
    color: 'bold.yellow'
  }
};

/**
 * Calculates assigned CEFR level based on scores map.
 * @param {{ A1: number, A2: number, B1: number, B2: number, C1: number }} scores
 * @returns {'A1' | 'A2' | 'B1' | 'B2' | 'C1'}
 */
export function calculatePlacementLevel(scores) {
  if (scores.A1 >= 1 && scores.A2 >= 1 && scores.B1 >= 2 && scores.B2 >= 1 && scores.C1 >= 1) {
    return 'C1';
  }
  if (scores.A1 >= 1 && scores.A2 >= 1 && scores.B1 >= 2 && scores.B2 >= 1) {
    return 'B2';
  }
  if (scores.A1 >= 1 && scores.A2 >= 1 && scores.B1 >= 1) {
    return 'B1';
  }
  if (scores.A1 >= 1 && scores.A2 >= 1) {
    return 'A2';
  }
  return 'A1';
}

export async function runPlacementTest() {
  clearScreen();
  printAppHeader('Adaptive Placement & Diagnostic Test');
  console.log(chalk.white('  Answer 6 diagnostic questions to assess your CEFR level and auto-unlock units.\n'));

  const scores = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
  const questionResults = [];

  for (let i = 0; i < PLACEMENT_QUESTIONS.length; i++) {
    const q = PLACEMENT_QUESTIONS[i];
    console.log(chalk.bold.cyan(`\n[Question ${i + 1}/${PLACEMENT_QUESTIONS.length} — Level ${q.level}: ${q.category}]`));

    let passed = false;

    if (q.type === 'choice') {
      const answer = await safeSelect({
        message: q.prompt,
        choices: q.options
      });

      if (answer === true) {
        console.log(chalk.green('  ✔ Correct!'));
        scores[q.level] += 1;
        passed = true;
      } else {
        console.log(chalk.red(`  ✖ Incorrect.`));
        console.log(chalk.dim(`  Rule: ${q.rule}`));
      }
    } else if (q.type === 'translate') {
      console.log(chalk.bold.yellow(`  🇪🇸 ${q.spanish}`));
      const input = (await safeInput({ message: 'Your translation ›' })).trim();

      const spinner = ora({ text: 'Evaluating translation...', color: 'yellow', indent: 2 }).start();
      try {
        const evalResult = checkTranslation(q.spanish, input, q.correct);
        spinner.stop();

        if (evalResult.isCorrect) {
          console.log(chalk.green(`  ✔ Correct! (${evalResult.score}/100)`));
          scores[q.level] += 1;
          passed = true;
        } else {
          console.log(chalk.red(`  ✖ Incorrect. Expected: "${chalk.white(q.correct)}"`));
          console.log(chalk.dim(`  Rule: ${q.rule}`));
        }
      } catch {
        spinner.stop();
        console.log(chalk.dim(`  Correct answer: ${q.correct}`));
      }
    }

    questionResults.push({ question: q, passed });
    printDivider();
  }

  // Determine Level
  const assignedLevel = calculatePlacementLevel(scores);
  const profile = LEVEL_PROFILES[assignedLevel];
  const allLessons = getAllLessons();

  let unlockedLessonsCount = 0;
  let bonusXp = 0;

  if (assignedLevel !== 'A1') {
    const updated = unlockUpToLevel(assignedLevel, allLessons);
    unlockedLessonsCount = updated.completedLessons.length;
    bonusXp = updated.xp;
  }

  // Render Full Diagnostic Report Card
  clearScreen();
  printAppHeader('Diagnostic Assessment Results');

  const breakdownRows = [
    `  • A1 (Foundations & Present Simple):    ${scores.A1 >= 1 ? chalk.green('✔ Passed') : chalk.red('✖ Review Needed')}`,
    `  • A2 (Past Simple & Regular Actions):   ${scores.A2 >= 1 ? chalk.green('✔ Passed') : chalk.red('✖ Review Needed')}`,
    `  • B1 (Conditionals & Present Perfect):  ${scores.B1 >= 1 ? chalk.green(`✔ Passed (${scores.B1}/2)`) : chalk.red('✖ Review Needed')}`,
    `  • B2 (Hypotheticals & Regrets):         ${scores.B2 >= 1 ? chalk.green('✔ Passed') : chalk.red('✖ Review Needed')}`,
    `  • C1 (Inversion & Advanced Nuance):     ${scores.C1 >= 1 ? chalk.green('✔ Passed') : chalk.red('✖ Review Needed')}`
  ].join('\n');

  const unlockInfo = assignedLevel !== 'A1'
    ? `  ${chalk.cyan('⚡ Auto-Unlocked:')} ${chalk.bold.white(unlockedLessonsCount + ' lessons')} (All units prior to ${assignedLevel})\n` +
      `  ${chalk.yellow('🎁 Baseline XP:')}   ${chalk.bold.yellow('+' + bonusXp + ' XP')}`
    : `  ${chalk.cyan('🌱 Starting Point:')} ${chalk.bold.white('Unit A1: The Basics (Lesson 1.1)')}`;

  const reportText =
    `${chalk.bold.yellow('🎓 DIAGNOSTIC ASSESSMENT REPORT')}\n\n` +
    `  ${chalk.dim('Calibrated Level:')}   ${chalk.bold.green(profile.title)}\n\n` +
    `${chalk.bold.white('📊 Competency Breakdown:')}\n` +
    `${breakdownRows}\n\n` +
    `${chalk.bold.white('💡 Level Assessment:')}\n` +
    `  ${profile.description}\n\n` +
    `${chalk.bold.white('🚀 Curriculum Status:')}\n` +
    `${unlockInfo}`;

  console.log(
    boxen(reportText, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green'
    })
  );

  console.log();
  await safeConfirm({ message: 'Press Enter to confirm calibration and continue', default: true });
  return assignedLevel;
}
