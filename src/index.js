import ora from 'ora';
import chalk from 'chalk';
import { safeSelect, safeConfirm } from './ui/prompt.js';
import { getWordOfDay } from './services/agy.js';
import { loadHistory, recordSession } from './services/history.js';
import { loadProgress } from './services/progress.js';
import { SessionStats } from './services/stats.js';
import { banner, printWordOfDay } from './ui/display.js';
import { runPath } from './modes/path.js';
import { runRoleplay } from './modes/roleplay.js';
import { runSlang } from './modes/slang.js';
import { runPlacementTest } from './modes/placement.js';
import { runTimeAttack } from './modes/timeattack.js';
import { runChat } from './modes/chat.js';
import { runTranslate } from './modes/translate.js';
import { runFillBlank } from './modes/fillblank.js';
import { runReview } from './modes/review.js';

const MODES = {
  PATH: '🗺️  Learning Path (CEFR A1 ➔ C1)',
  ROLEPLAY: '🎭 Roleplay Missions (Real Scenarios)',
  SLANG: '💬 Phrasal Verbs & Slang Vault',
  TIMEATTACK: '⚡ Time Attack (60s Rapid Fire)',
  REVIEW: '🧠 Review Mistakes (SRS / SM-2)',
  PLACEMENT: '🎓 Placement Test (Calibrate Level)',
  CHAT: '💬 Free Chat',
  TRANSLATE: '🌍 Translate (ES → EN)',
  FILLBLANK: '✏️  Fill in the Blank',
};

async function getDifficulty() {
  return safeSelect({
    message: 'Choose difficulty (Esc to cancel):',
    choices: [
      { name: '🟢 Beginner', value: 'beginner' },
      { name: '🟡 Intermediate', value: 'intermediate' },
      { name: '🔴 Advanced', value: 'advanced' },
      { name: '🔙 Back to Menu (or press Esc)', value: 'BACK' },
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
  const srsDueCount = Object.values(history.srsCards || {}).filter(
    (c) => c.nextReviewDate <= new Date().toISOString()
  ).length;

  console.log(
    chalk.yellow(
      `  🏆 Streak: ${history.bestStreak} | ⚡ XP: ${progress.xp} | 🎓 Lessons: ${progress.completedLessons.length} | 🧠 Due Cards: ${srsDueCount}\n`
    )
  );

  let playAgain = true;
  while (playAgain) {
    const modeKey = await safeSelect({
      message: 'Choose your mode (Esc to quit):',
      choices: [
        { name: MODES.PATH,       value: 'PATH' },
        { name: MODES.ROLEPLAY,   value: 'ROLEPLAY' },
        { name: MODES.SLANG,      value: 'SLANG' },
        { name: MODES.TIMEATTACK, value: 'TIMEATTACK' },
        { name: MODES.REVIEW,     value: 'REVIEW' },
        { name: MODES.PLACEMENT,  value: 'PLACEMENT' },
        { name: MODES.CHAT,       value: 'CHAT' },
        { name: MODES.TRANSLATE,  value: 'TRANSLATE' },
        { name: MODES.FILLBLANK,  value: 'FILLBLANK' },
        { name: '❌ Quit (or press Esc)', value: 'QUIT' },
      ],
    });

    if (!modeKey || modeKey === 'QUIT' || modeKey === 'BACK') break;

    let difficulty = 'beginner';
    if (!['REVIEW', 'PATH', 'PLACEMENT', 'TIMEATTACK', 'ROLEPLAY', 'SLANG'].includes(modeKey)) {
      difficulty = await getDifficulty();
      if (!difficulty || difficulty === 'BACK') {
        banner();
        continue;
      }
    }

    console.log();
    const stats = new SessionStats(MODES[modeKey]);

    if (modeKey === 'PATH')       await runPath(stats);
    if (modeKey === 'ROLEPLAY')   await runRoleplay(stats);
    if (modeKey === 'SLANG')      await runSlang(stats);
    if (modeKey === 'TIMEATTACK') await runTimeAttack(stats);
    if (modeKey === 'PLACEMENT')  await runPlacementTest();
    if (modeKey === 'REVIEW')     await runReview(stats);
    if (modeKey === 'CHAT')       await runChat(stats, difficulty);
    if (modeKey === 'TRANSLATE')  await runTranslate(stats, difficulty);
    if (modeKey === 'FILLBLANK')  await runFillBlank(stats, difficulty);

    if (modeKey !== 'PLACEMENT') {
      stats.print();
      recordSession(stats.getSummary());
    }

    playAgain = await safeConfirm({ message: 'Return to Main Menu / Choose another mode?', default: true });
    if (playAgain) {
      banner();
    }
  }

  console.log(chalk.cyan('\n  Bye! Keep practicing. 👋\n'));
}

main().catch((err) => {
  if (err?.name === 'ExitPromptError' || err?.message?.includes('force closed')) {
    console.log(chalk.cyan('\n  Bye! Keep practicing. 👋\n'));
    process.exit(0);
  }
  console.error(chalk.red(`\n  Fatal error: ${err.message}\n`));
  process.exit(1);
});

