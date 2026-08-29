import chalk from 'chalk';
import { getDailyGoalProgress, getActivityDays } from '../services/activity.js';

/**
 * Presentation for activity data.
 *
 * These render functions used to live in services/activity.js alongside the
 * data they draw. Keeping chalk out of the services layer means the numbers
 * can be asserted without parsing ANSI escapes.
 */

/**
 * Formats a terminal progress bar for the daily goal.
 * @param {number} [targetXp=50]
 * @returns {string}
 */
export function formatDailyGoalBar(targetXp = 50) {
  const { current, target, completed, percent } = getDailyGoalProgress(targetXp);
  const barLength = 12;
  const filled = Math.round((percent / 100) * barLength);
  const empty = barLength - filled;

  const bar = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  const statusIcon = completed ? chalk.bold.green('✔ GOAL REACHED') : `${current}/${target} XP`;

  return `🎯 Daily Goal: [${bar}] ${percent}% (${statusIcon})`;
}

/**
 * Renders a compact ANSI GitHub-style activity heatmap for the terminal.
 * @param {number} [daysCount=28]
 * @returns {string}
 */
export function renderTerminalHeatmap(daysCount = 28) {
  const days = getActivityDays(daysCount);

  // Group by day of week (0 to 6)
  const rows = [[], [], [], [], [], [], []];
  for (const day of days) {
    rows[day.dayOfWeek].push(day);
  }

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const blockIcons = {
    0: chalk.dim('░░'),
    1: chalk.cyan('▒▒'),
    2: chalk.green('▓▓'),
    3: chalk.bold.green('██'),
    4: chalk.bold.yellow('██')
  };

  let output = `${chalk.bold.white('Activity Heatmap (Past 4 Weeks):')}\n`;

  // Render rows (Mon, Wed, Fri, Sun for compactness)
  const displayDays = [1, 3, 5, 0]; // Mon, Wed, Fri, Sun
  for (const dayIdx of displayDays) {
    const label = chalk.dim(dayLabels[dayIdx]);
    const rowDays = rows[dayIdx] || [];
    const blocks = rowDays.map((d) => blockIcons[d.level] || blockIcons[0]).join(' ');
    output += `  ${label}  ${blocks}\n`;
  }

  output += chalk.dim('\n  Legend: ░░ 0 XP   ▒▒ 1-20 XP   ▓▓ 21-50 XP   ██ 50+ XP');
  return output;
}
