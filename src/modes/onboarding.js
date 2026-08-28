import chalk from 'chalk';
import boxen from 'boxen';
import { updateConfig } from '../services/config.js';
import { runPlacementTest } from './placement.js';
import { clearScreen, printAppHeader } from '../ui/display.js';
import { safeSelect, safeInput, safeConfirm } from '../ui/prompt.js';

export async function runOnboardingWizard() {
  clearScreen();

  const welcomeBanner =
    `${chalk.bold.cyan('Welcome to LinguaGate! 🚪🗣️')}\n\n` +
    `${chalk.white('The AI-powered English training engine with active grammar gating.\nLet’s personalize your experience in less than 2 minutes.')}`;

  console.log(
    boxen(welcomeBanner, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    })
  );

  // Step 1: Name / Alias
  console.log(chalk.bold.yellow('  [Step 1/3] Personalization'));
  const inputName = (await safeInput({
    message: 'What is your name or alias? ›',
    default: process.env.USER || 'Learner'
  })).trim();

  const userName = inputName || 'Learner';

  // Step 2: Daily Target
  console.log(chalk.bold.yellow('\n  [Step 2/3] Daily Study Commitment'));
  const dailyGoalChoice = await safeSelect({
    message: 'Select your daily study target (XP):',
    choices: [
      { name: '🔥 Regular (50 XP / ~1 complete lesson per day) — Recommended', value: 50 },
      { name: '🌱 Casual (30 XP / ~1-2 quick exercises per day)', value: 30 },
      { name: '⚡ Serious (100 XP / ~2 lessons + gym drills per day)', value: 100 },
      { name: '🚀 Super Learner (150 XP / intensive daily immersion)', value: 150 }
    ]
  });

  const dailyGoalXp = typeof dailyGoalChoice === 'number' ? dailyGoalChoice : 50;

  // Step 3: Diagnostic Test
  clearScreen();
  printAppHeader('Diagnostic Calibration');

  console.log(chalk.bold.yellow('  [Step 3/3] Level Calibration'));
  const calibrationChoice = await safeSelect({
    message: 'How would you like to begin your learning path?',
    choices: [
      {
        name: '🎓 Take the 2-minute Placement Test (Auto-unlock A2, B1, B2 or C1 with bonus XP)',
        value: 'TEST'
      },
      {
        name: '🌱 Start from the beginning (Unit A1.1: The Basics)',
        value: 'A1'
      }
    ]
  });

  if (calibrationChoice === 'TEST') {
    await runPlacementTest();
  } else {
    clearScreen();
    console.log(
      boxen(
        `${chalk.bold.green('🌱 Starting Level Set: A1.1 (The Basics)')}\n\n` +
        `${chalk.white('You will begin from foundational building blocks (Pronouns, Articles & Daily Routines).')}`,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'green'
        }
      )
    );
    await safeConfirm({ message: 'Press Enter to continue', default: true });
  }

  // Save onboarding state
  updateConfig({
    userName,
    dailyGoalXp,
    onboarded: true
  });
}
