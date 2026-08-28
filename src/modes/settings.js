import chalk from 'chalk';
import boxen from 'boxen';
import { loadConfig, updateConfig, resetConfig } from '../services/config.js';
import { clearScreen, printAppHeader } from '../ui/display.js';
import { safeSelect, safeInput, safeConfirm } from '../ui/prompt.js';

export async function runSettings() {
  while (true) {
    clearScreen();
    printAppHeader('User Preferences & Settings');

    const config = loadConfig();

    const summaryText =
      `${chalk.bold.white('Current Configuration:')}\n\n` +
      `  ${chalk.dim('• User Name:')}          ${chalk.cyan(config.userName)}\n` +
      `  ${chalk.dim('• Default Audio Speed:')} ${chalk.yellow(config.audioSpeed)}\n` +
      `  ${chalk.dim('• Audio Engine:')}        ${chalk.green(config.audioPlayer)}\n` +
      `  ${chalk.dim('• Default Difficulty:')}  ${chalk.magenta(config.defaultDifficulty)}\n` +
      `  ${chalk.dim('• Sound Effects:')}       ${chalk.white(config.soundEffects ? 'Enabled' : 'Disabled')}`;

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
        { name: `🔊 Change Default Audio Speed (${config.audioSpeed})`, value: 'SPEED' },
        { name: `🎧 Change Audio Engine / Mute (${config.audioPlayer})`, value: 'ENGINE' },
        { name: `🎯 Change Default Difficulty (${config.defaultDifficulty})`, value: 'DIFFICULTY' },
        { name: `👤 Edit User Name (${config.userName})`, value: 'NAME' },
        { name: '🔄 Reset All Settings to Defaults', value: 'RESET' }
      ]
    });

    if (!action || action === 'BACK') {
      break;
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

    if (action === 'RESET') {
      const confirm = await safeConfirm({
        message: 'Are you sure you want to reset all preferences to default values?',
        default: false
      });
      if (confirm) {
        resetConfig();
      }
    }
  }
}
