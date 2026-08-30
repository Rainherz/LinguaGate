#!/usr/bin/env node
import ora from 'ora';
import chalk from 'chalk';
import { safeSelect, safeConfirm } from './ui/prompt.js';
import { getWordOfDay } from './services/tutor.js';
import { loadHistory, recordSession } from './services/history.js';
import { getWeakSpots } from './services/weakspots.js';
import { describeProviderGap } from './services/ai/index.js';
import { loadProgress } from './services/progress.js';
import { loadConfig, getGreeting } from './services/config.js';
import { formatDailyGoalBar } from './ui/activity-view.js';
import { saveWordOfDay } from './services/vocabulary.js';
import { SessionStats } from './services/stats.js';
import { banner, printWordOfDay, printSessionSummary } from './ui/display.js';
import { runOnboardingWizard } from './modes/onboarding.js';
import { runPath } from './modes/path.js';
import { runSpeakingLab } from './modes/speaking.js';
import { runTechInterview } from './modes/interview.js';
import { runRoleplay } from './modes/roleplay.js';
import { runSlang } from './modes/slang.js';
import { runPlacementTest } from './modes/placement.js';
import { runTimeAttack } from './modes/timeattack.js';
import { runChat } from './modes/chat.js';
import { runTranslate } from './modes/translate.js';
import { runFillBlank } from './modes/fillblank.js';
import { runReview } from './modes/review.js';
import { runListening } from './modes/listening.js';
import { runVerbsGym } from './modes/verbs.js';
import { runCollocationsGym } from './modes/collocations.js';
import { runVocabularyVault } from './modes/vocabulary.js';
import { runExportMode } from './modes/export.js';
import { runSettings } from './modes/settings.js';

const MODES = {
  PATH: '🗺️  Learning Path (CEFR A1 ➔ C1)',
  INTERVIEW: '💼 Tech Mock Interview (Personalized)',
  SPEAKING: '🎙️  Speaking & Pronunciation Lab',
  LISTEN: '🎧 Listening & Dictation Lab',
  VERBS: '⚡ Irregular Verbs Gym (3 Forms)',
  COLLOCATIONS: '🧩 Prepositions & Collocations Gym',
  VOCAB: '📚 Vocabulary Vault & Daily Quiz',
  ROLEPLAY: '🎭 Roleplay Missions (Real Scenarios)',
  SLANG: '💬 Phrasal Verbs & Slang Vault',
  TIMEATTACK: '⚡ Time Attack (60s Rapid Fire)',
  REVIEW: '🧠 Review Mistakes (SRS / SM-2)',
  PLACEMENT: '🎓 Placement Test (Calibrate Level)',
  EXPORT: '📦 Export to Anki / Study Deck',
  SETTINGS: '⚙️  Settings & Preferences',
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
  let config = loadConfig();
  if (!config.onboarded) {
    await runOnboardingWizard();
    config = loadConfig();
  }

  banner();

  // Word of the day
  const wodSpinner = ora({ text: 'Loading word of the day...', color: 'magenta', indent: 2 }).start();
  try {
    const wod = await getWordOfDay();
    wodSpinner.stop();
    printWordOfDay(wod);
    saveWordOfDay(wod);
  } catch {
    wodSpinner.stop();
  }

  // Stats & Progress Overview
  const history = loadHistory();
  const progress = loadProgress();
  const srsDueCount = Object.values(history.srsCards || {}).filter(
    (c) => c.nextReviewDate <= new Date().toISOString()
  ).length;

  console.log(`  ${chalk.bold.cyan(getGreeting(config.userName))}`);
  console.log(
    chalk.yellow(
      `  🏆 Streak: ${history.bestStreak} | ⚡ XP: ${progress.xp} | 🎓 Lessons: ${progress.completedLessons.length} | 🧠 Due Cards: ${srsDueCount}`
    )
  );
  console.log(`  ${formatDailyGoalBar(config.dailyGoalXp)}`);

  // Analytics you have to navigate to don't get read; this is the one place
  // every session passes through.
  // Every mode needs a provider to generate an exercise, so a missing one is
  // said once here rather than surfacing as a spawn error mid-lesson.
  const providerGap = describeProviderGap(config);
  if (providerGap) {
    console.log(
      `\n  ${chalk.bold.yellow('⚠ No AI provider')}\n  ${chalk.yellow(providerGap)}`
    );
  }

  const weakSpots = getWeakSpots(3);
  if (weakSpots.length > 0) {
    console.log(`\n  ${chalk.bold.white('🩹 Your weak spots')} ${chalk.dim('(what to practice today)')}`);
    for (const spot of weakSpots) {
      const badge = spot.kind === 'pronunciation' ? chalk.magenta('🎙️') : chalk.cyan('📖');
      const times = chalk.dim(`×${spot.count}`);
      const trailing = spot.lastAttempt
        ? chalk.dim(`  came out as "${spot.lastAttempt}"`)
        : '';
      console.log(`    ${badge}  ${chalk.white(spot.label)} ${times}${trailing}`);
    }
  }
  console.log();

  let playAgain = true;
  while (playAgain) {
    const modeKey = await safeSelect({
      message: 'Choose your mode (Esc to quit):',
      choices: [
        { name: MODES.PATH,         value: 'PATH' },
        { name: MODES.INTERVIEW,    value: 'INTERVIEW' },
        { name: MODES.SPEAKING,     value: 'SPEAKING' },
        { name: MODES.LISTEN,       value: 'LISTEN' },
        { name: MODES.VERBS,        value: 'VERBS' },
        { name: MODES.COLLOCATIONS, value: 'COLLOCATIONS' },
        { name: MODES.VOCAB,        value: 'VOCAB' },
        { name: MODES.ROLEPLAY,     value: 'ROLEPLAY' },
        { name: MODES.SLANG,        value: 'SLANG' },
        { name: MODES.TIMEATTACK,   value: 'TIMEATTACK' },
        { name: MODES.REVIEW,       value: 'REVIEW' },
        { name: MODES.PLACEMENT,    value: 'PLACEMENT' },
        { name: MODES.EXPORT,       value: 'EXPORT' },
        { name: MODES.SETTINGS,     value: 'SETTINGS' },
        { name: MODES.CHAT,         value: 'CHAT' },
        { name: MODES.TRANSLATE,    value: 'TRANSLATE' },
        { name: MODES.FILLBLANK,    value: 'FILLBLANK' },
        { name: '❌ Quit (or press Esc)', value: 'QUIT' },
      ],
    });

    if (!modeKey || modeKey === 'QUIT' || modeKey === 'BACK') break;

    let difficulty = 'beginner';
    if (!['REVIEW', 'PATH', 'PLACEMENT', 'TIMEATTACK', 'ROLEPLAY', 'SLANG', 'LISTEN', 'SPEAKING', 'INTERVIEW', 'VERBS', 'COLLOCATIONS', 'VOCAB', 'EXPORT', 'SETTINGS'].includes(modeKey)) {
      difficulty = await getDifficulty();
      if (!difficulty || difficulty === 'BACK') {
        banner();
        continue;
      }
    }

    console.log();
    const stats = new SessionStats(MODES[modeKey]);

    if (modeKey === 'PATH')         await runPath(stats);
    if (modeKey === 'INTERVIEW')    await runTechInterview(stats);
    if (modeKey === 'SPEAKING')     await runSpeakingLab(stats);
    if (modeKey === 'LISTEN')       await runListening(stats);
    if (modeKey === 'VERBS')        await runVerbsGym(stats);
    if (modeKey === 'COLLOCATIONS') await runCollocationsGym(stats);
    if (modeKey === 'VOCAB')        await runVocabularyVault(stats);
    if (modeKey === 'ROLEPLAY')     await runRoleplay(stats);
    if (modeKey === 'SLANG')        await runSlang(stats);
    if (modeKey === 'TIMEATTACK')   await runTimeAttack(stats);
    if (modeKey === 'PLACEMENT')    await runPlacementTest();
    if (modeKey === 'REVIEW')       await runReview(stats);
    if (modeKey === 'EXPORT')       await runExportMode();
    if (modeKey === 'SETTINGS')     await runSettings();
    if (modeKey === 'CHAT')         await runChat(stats);
    if (modeKey === 'TRANSLATE')    await runTranslate(stats, difficulty);
    if (modeKey === 'FILLBLANK')    await runFillBlank(stats, difficulty);

    if (modeKey !== 'PLACEMENT' && modeKey !== 'EXPORT' && modeKey !== 'SETTINGS') {
      printSessionSummary(stats.getSummary());
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
