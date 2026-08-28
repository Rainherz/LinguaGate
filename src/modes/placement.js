import readline from 'node:readline';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeSelect } from '../ui/prompt.js';
import ora from 'ora';
import chalk from 'chalk';
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

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

const QUESTIONS = [
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
    rule: 'Third-person singular present simple (he/she/it takes -s/-es)'
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
    rule: 'Past simple irregular verb (see ➔ saw)'
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
    rule: 'First conditional (If + present simple, will + base verb)'
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
    rule: 'Present perfect with duration ("for" a period vs "since" a point in time)'
  },
  {
    level: 'B2',
    type: 'translate',
    spanish: 'Si hubiera tenido dinero, habría viajado a Japón.',
    correct: 'If I had had money, I would have traveled to Japan.',
    rule: 'Third conditional for past hypothetical regret (If + past perfect, would have + participle)'
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
    rule: 'Negative inversion for emphasis (Hardly had I... when...)'
  }
];

export async function runPlacementTest() {
  clearScreen();
  printAppHeader('Adaptive Placement Test');
  console.log(chalk.gray('  Answer 6 diagnostic questions to calibrate your CEFR level.\n'));

  let scores = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
  const totalPerLevel = { A1: 1, A2: 1, B1: 2, B2: 1, C1: 1 };

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    console.log(chalk.bold.magenta(`\n[Question ${i + 1}/${QUESTIONS.length} — Level ${q.level}]`));

    if (q.type === 'choice') {
      const answer = await safeSelect({
        message: q.prompt,
        choices: q.options
      });

      if (answer === true) {
        console.log(chalk.green('  ✔ Correct!'));
        scores[q.level] += 1;
      } else {
        console.log(chalk.red(`  ✖ Incorrect. (Rule: ${q.rule})`));
      }
    } else if (q.type === 'translate') {
      console.log(chalk.bold.yellow(`  🇪🇸 ${q.spanish}`));
      const input = (await ask(rl, chalk.bold.green('  Your translation › '))).trim();

      const spinner = ora({ text: 'Evaluating translation...', color: 'yellow', indent: 2 }).start();
      try {
        const evalResult = checkTranslation(q.spanish, input, q.correct);
        spinner.stop();

        if (evalResult.isCorrect) {
          console.log(chalk.green(`  ✔ Correct! (${evalResult.score}/100)`));
          scores[q.level] += 1;
        } else {
          console.log(chalk.red(`  ✖ Incorrect. Expected: "${chalk.white(q.correct)}"`));
          console.log(chalk.gray(`  Rule: ${q.rule}`));
        }
      } catch {
        spinner.stop();
        console.log(chalk.gray(`  Correct answer: ${q.correct}`));
      }
    }
    printDivider();
  }

  rl.close();

  // Determine Level
  let assignedLevel = 'A1';
  if (scores.A1 >= 1 && scores.A2 >= 1) {
    assignedLevel = 'A2';
  }
  if (scores.A1 >= 1 && scores.A2 >= 1 && scores.B1 >= 1) {
    assignedLevel = 'B1';
  }
  if (scores.A1 >= 1 && scores.A2 >= 1 && scores.B1 >= 2 && scores.B2 >= 1) {
    assignedLevel = 'B2';
  }
  if (scores.A1 >= 1 && scores.A2 >= 1 && scores.B1 >= 2 && scores.B2 >= 1 && scores.C1 >= 1) {
    assignedLevel = 'C1';
  }

  console.log(chalk.bold.green(`\n🎉 ASSESSMENT COMPLETE!`));
  console.log(chalk.bold.yellow(`🏆 Recommended Starting Level: ${assignedLevel}`));

  const allLessons = getAllLessons();
  if (assignedLevel !== 'A1') {
    const updated = unlockUpToLevel(assignedLevel, allLessons);
    console.log(chalk.cyan(`⚡ Automatically unlocked all units up to ${assignedLevel}!`));
    console.log(chalk.yellow(`🎁 Credited +${updated.xp} baseline XP.\n`));
  } else {
    console.log(chalk.cyan(`You are ready to begin at Unit A1: The Basics!\n`));
  }
}
