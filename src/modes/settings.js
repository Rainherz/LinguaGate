import chalk from 'chalk';
import boxen from 'boxen';
import { loadConfig, updateConfig, resetConfig } from '../services/config.js';
import { renderTerminalHeatmap, formatDailyGoalBar } from '../ui/activity-view.js';
import { renderProgressReport } from '../ui/progress-view.js';
import { clearScreen, printAppHeader } from '../ui/display.js';
import { safeSelect, safeInput, safeConfirm } from '../ui/prompt.js';
import {
  describeAiProviders,
  describeSttEngines,
  describeTtsEngines
} from '../services/engine-status.js';
import { resetProviderCache } from '../services/ai/index.js';
import { resetTranscriberCache } from '../services/transcriber.js';
import { resetTtsCache } from '../services/tts.js';

/**
 * Renders one engine report as a selectable list.
 * Unavailable engines stay on the list, marked and annotated: hiding them
 * hides the capability, and the annotation is what tells you how to get it.
 * @param {import('../services/engine-status.js').EngineReport} report
 */
function engineChoices(report) {
  return [
    ...report.options.map((o) => ({
      name:
        `${o.available ? chalk.green('✔') : chalk.red('✖')} ${chalk.white(o.label)}` +
        `${o.value === report.selected ? chalk.cyan('  ← current') : ''}` +
        `\n      ${chalk.dim(o.detail)}`,
      value: o.value
    })),
    { name: '🔙 Cancel', value: 'CANCEL' }
  ];
}

/** Formats `saved → what actually runs` for the menu label. */
function engineLabel(report) {
  if (report.selected === report.resolved || report.resolved === null) return report.selected;
  return `${report.selected} → ${report.resolved}`;
}

export async function runSettings() {
  while (true) {
    clearScreen();
    printAppHeader('User Preferences & Settings');

    const config = loadConfig();

    const summaryText =
      `${chalk.bold.white('Current Configuration:')}\n\n` +
      `  ${chalk.dim('• User Name:')}          ${chalk.cyan(config.userName)}\n` +
      `  ${chalk.dim('• Daily XP Goal:')}       ${chalk.green(config.dailyGoalXp + ' XP')}\n` +
      `  ${chalk.dim('• Default Audio Speed:')} ${chalk.yellow(config.audioSpeed)}\n` +
      `  ${chalk.dim('• Audio Engine:')}        ${chalk.green(config.audioPlayer)}\n` +
      `  ${chalk.dim('• Default Difficulty:')}  ${chalk.magenta(config.defaultDifficulty)}\n` +
      `  ${chalk.dim('• Sound Effects:')}       ${chalk.white(config.soundEffects ? 'Enabled' : 'Disabled')}\n` +
      `  ${chalk.dim('• AI Provider:')}         ${chalk.blue(engineLabel(describeAiProviders(config)))}\n` +
      `  ${chalk.dim('• Speech-to-Text:')}      ${chalk.blue(engineLabel(describeSttEngines(config)))}\n` +
      `  ${chalk.dim('• Voice Engine:')}        ${chalk.blue(engineLabel(describeTtsEngines(config)))}`;

    console.log(
      boxen(summaryText, {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        borderColor: 'cyan',
        borderStyle: 'round',
        dimBorder: true
      })
    );
    console.log();

    const action = await safeSelect({
      message: 'Select an option to customize (Esc to return):',
      choices: [
        { name: '🔙 Back to Main Menu (or press Esc)', value: 'BACK' },
        { name: '📅 View 30-Day Activity Heatmap', value: 'HEATMAP' },
        { name: '📈 View Accuracy by Mode', value: 'PROGRESS' },
        { name: `🎯 Change Daily XP Goal (${config.dailyGoalXp} XP)`, value: 'GOAL' },
        { name: `🔊 Change Default Audio Speed (${config.audioSpeed})`, value: 'SPEED' },
        { name: `🎧 Change Audio Engine / Mute (${config.audioPlayer})`, value: 'ENGINE' },
        { name: `🎓 Change Default Difficulty (${config.defaultDifficulty})`, value: 'DIFFICULTY' },
        { name: `🧠 AI Provider (${engineLabel(describeAiProviders(config))})`, value: 'AI' },
        { name: `🎙️  Speech-to-Text (${engineLabel(describeSttEngines(config))})`, value: 'STT' },
        { name: `🔊 Voice Engine (${engineLabel(describeTtsEngines(config))})`, value: 'TTS' },
        { name: `👤 Edit User Name (${config.userName})`, value: 'NAME' },
        { name: '🔄 Reset All Settings to Defaults', value: 'RESET' }
      ]
    });

    if (!action || action === 'BACK') {
      break;
    }

    if (action === 'HEATMAP') {
      clearScreen();
      printAppHeader('Your 30-Day Learning Activity');
      console.log(formatDailyGoalBar(config.dailyGoalXp) + '\n');
      console.log(
        boxen(renderTerminalHeatmap(28), {
          padding: 1,
          margin: 1,
          borderColor: 'green',
          borderStyle: 'round'
        })
      );
      await safeConfirm({ message: 'Return to Settings?', default: true });
      continue;
    }

    if (action === 'GOAL') {
      const goalChoice = await safeSelect({
        message: 'Select your daily study target:',
        choices: [
          { name: '🌱 Casual (30 XP / ~1-2 exercises per day)', value: 30 },
          { name: '🔥 Regular (50 XP / ~1 complete lesson per day)', value: 50 },
          { name: '⚡ Serious (100 XP / ~2 lessons or extensive gym drills)', value: 100 },
          { name: '🚀 Super Learner (150 XP / daily mastery immersion)', value: 150 },
          { name: '🔙 Cancel', value: 0 }
        ]
      });
      if (goalChoice && typeof goalChoice === 'number' && goalChoice > 0) {
        updateConfig({ dailyGoalXp: goalChoice });
      }
    }

    if (action === 'SPEED') {
      const speedChoice = await safeSelect({
        message: 'Select default playback speed for audio exercises:',
        choices: [
          { name: '🐇 Normal (1.0x natural speed)', value: 'normal' },
          { name: '🐢 Slow (0.7x clearer cadence)', value: 'slow' },
          { name: '🔬 Ultra-Slow (0.4x phonetic breakdown)', value: 'ultra-slow' },
          { name: '🔙 Cancel', value: 'CANCEL' }
        ]
      });
      if (speedChoice && speedChoice !== 'CANCEL') {
        updateConfig({ audioSpeed: speedChoice });
      }
    }

    if (action === 'ENGINE') {
      const engineChoice = await safeSelect({
        message: 'Select audio playback engine:',
        choices: [
          { name: '✨ Auto-Detect (Recommend best available: ffplay / mpg123 / aplay)', value: 'auto' },
          { name: '🔊 Force ffplay (ffmpeg)', value: 'ffplay' },
          { name: '🔊 Force mpg123', value: 'mpg123' },
          { name: '🔊 Force aplay (ALSA)', value: 'aplay' },
          { name: '🔇 Mute Audio (Silent mode)', value: 'muted' },
          { name: '🔙 Cancel', value: 'CANCEL' }
        ]
      });
      if (engineChoice && engineChoice !== 'CANCEL') {
        updateConfig({ audioPlayer: engineChoice });
      }
    }

    if (action === 'DIFFICULTY') {
      const diffChoice = await safeSelect({
        message: 'Select default starting difficulty for exercises:',
        choices: [
          { name: '🟢 Beginner (A1 - A2)', value: 'beginner' },
          { name: '🟡 Intermediate (B1 - B2)', value: 'intermediate' },
          { name: '🔴 Advanced (C1)', value: 'advanced' },
          { name: '🔙 Cancel', value: 'CANCEL' }
        ]
      });
      if (diffChoice && diffChoice !== 'CANCEL') {
        updateConfig({ defaultDifficulty: diffChoice });
      }
    }

    if (action === 'NAME') {
      const newName = await safeInput({
        message: 'Enter your name or alias ›',
        default: config.userName
      });
      if (newName && newName.trim()) {
        updateConfig({ userName: newName.trim() });
      }
    }

    if (action === 'PROGRESS') {
      clearScreen();
      printAppHeader('Accuracy by Mode');
      console.log(
        boxen(renderProgressReport(), {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'green',
          dimBorder: true
        })
      );
      await safeConfirm({ message: 'Return to Settings?', default: true });
    }

    if (action === 'AI') {
      const choice = await safeSelect({
        message: 'Select the AI provider:',
        choices: engineChoices(describeAiProviders(config))
      });
      if (choice && choice !== 'CANCEL') {
        updateConfig({ aiProvider: choice });
        // Without this the previous provider stays memoised until restart.
        resetProviderCache();
      }
    }

    if (action === 'STT') {
      const choice = await safeSelect({
        message: 'Select the speech-to-text engine:',
        choices: engineChoices(describeSttEngines(config))
      });
      if (choice && choice !== 'CANCEL') {
        updateConfig({ sttEngine: choice });
        resetTranscriberCache();
      }
    }

    if (action === 'TTS') {
      const choice = await safeSelect({
        message: 'Select the voice engine:',
        choices: engineChoices(describeTtsEngines(config))
      });
      if (choice && choice !== 'CANCEL') {
        updateConfig({ ttsEngine: choice });
        resetTtsCache();
      }
    }

    if (action === 'RESET') {
      const confirm = await safeConfirm({
        message: 'Are you sure you want to reset all preferences to default values?',
        default: false
      });
      if (confirm) {
        resetConfig();
        resetProviderCache();
        resetTranscriberCache();
        resetTtsCache();
      }
    }
  }
}
