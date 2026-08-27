#!/usr/bin/env node
import { select, confirm } from '@inquirer/prompts';
import ora from 'ora';
import chalk from 'chalk';
import { getWordOfDay } from './services/agy.js';
import { loadHistory, recordSession } from './services/history.js';
import { loadProgress } from './services/progress.js';
import { SessionStats } from './services/stats.js';
import { banner, printWordOfDay } from './ui/display.js';
import { runPath } from './modes/path.js';
import { runChat } from './modes/chat.js';
import { runTranslate } from './modes/translate.js';
import { runFillBlank } from './modes/fillblank.js';
import { runReview } from './modes/review.js';

const MODES = {
  PATH: '🗺️  Learning Path (CEFR A1 ➔ C1)',
  CHAT: '💬 Free Chat',
  TRANSLATE: '🌍 Translate (ES → EN)',
  FILLBLANK: '✏️  Fill in the Blank',
  REVIEW: '🔄 Review My Mistakes',
};

async function getDifficulty() {
  return select({
    message: 'Choose difficulty:',
    choices: [
      { name: '🟢 Beginner', value: 'beginner' },
      { name: '🟡 Intermediate', value: 'intermediate' },
      { name: '🔴 Advanced', value: 'advanced' },
    ],
  });
}

async function main() {
  banner();

  // Word of the day
  const wodSpinner = ora({ text: 'Loading word of the day...', color: 'magenta', indent: 2 }).start();
  try {
    const wod = getWordOfDay();
    wodSpinner.stop();
    printWordOfDay(wod);
  } catch {
    wodSpinner.stop();
  }

  // Stats & Progress Overview
  const history = loadHistory();
  const progress = loadProgress();
  if (history.bestStreak > 0 || progress.xp > 0) {
    console.log(chalk.yellow(`  🏆 Best streak: ${history.bestStreak} in a row | ⚡ XP: ${progress.xp} | 🎓 Lessons: ${progress.completedLessons.length} done\n`));
  }

  let playAgain = true;
  while (playAgain) {
    const modeKey = await select({
      message: 'Choose your mode:',
      choices: [
        { name: MODES.PATH,      value: 'PATH' },
        { name: MODES.CHAT,      value: 'CHAT' },
        { name: MODES.TRANSLATE, value: 'TRANSLATE' },
        { name: MODES.FILLBLANK, value: 'FILLBLANK' },
        { name: MODES.REVIEW,    value: 'REVIEW' },
        { name: '❌ Quit',       value: 'QUIT' },
      ],
    });

    if (modeKey === 'QUIT') break;

    let difficulty = 'beginner';
    if (modeKey !== 'REVIEW' && modeKey !== 'PATH') {
      difficulty = await getDifficulty();
    }

    console.log();
    const stats = new SessionStats(MODES[modeKey]);

    if (modeKey === 'PATH')      await runPath(stats);
    if (modeKey === 'CHAT')      await runChat(stats, difficulty);
    if (modeKey === 'TRANSLATE') await runTranslate(stats, difficulty);
    if (modeKey === 'FILLBLANK') await runFillBlank(stats, difficulty);
    if (modeKey === 'REVIEW')    await runReview(stats);

    stats.print();
    recordSession(stats.getSummary());

    playAgain = await confirm({ message: 'Play again?', default: true });
    console.log();
  }

  console.log(chalk.cyan('\n  Bye! Keep practicing. 👋\n'));
}

main().catch((err) => {
  console.error(chalk.red(`\n  Fatal error: ${err.message}\n`));
  process.exit(1);
});
