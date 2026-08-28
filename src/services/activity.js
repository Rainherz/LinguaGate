import chalk from 'chalk';
import { readJson, writeJsonAtomic, getDataDir } from './storage.js';
import { join } from 'node:path';

function getHistoryFilePath() {
  return join(getDataDir(), 'history.json');
}

/**
 * Returns ISO date formatted as YYYY-MM-DD.
 * @param {Date} [d]
 * @returns {string}
 */
export function getTodayKey(d = new Date()) {
  return d.toISOString().split('T')[0];
}

/**
 * Records daily XP and session activity to history storage.
 * @param {number} xpEarned
 * @param {number} [lessonsCount=0]
 */
export function recordDailyActivity(xpEarned = 0, lessonsCount = 0) {
  const filePath = getHistoryFilePath();
  const history = readJson(filePath, { errors: [], sessions: [], streak: 0, bestStreak: 0, srsCards: {}, dailyActivity: {} });

  if (!history.dailyActivity) history.dailyActivity = {};

  const today = getTodayKey();
  if (!history.dailyActivity[today]) {
    history.dailyActivity[today] = { xp: 0, sessions: 0, lessons: 0 };
  }

  history.dailyActivity[today].xp += Math.max(0, xpEarned);
  history.dailyActivity[today].sessions += 1;
  history.dailyActivity[today].lessons += Math.max(0, lessonsCount);

  writeJsonAtomic(filePath, history);
  return history.dailyActivity[today];
}

/**
 * Gets progress toward the daily XP goal.
 * @param {number} [targetXp=50]
 * @returns {{ current: number, target: number, completed: boolean, percent: number }}
 */
export function getDailyGoalProgress(targetXp = 50) {
  const history = readJson(getHistoryFilePath(), { dailyActivity: {} });
  const today = getTodayKey();
  const todayStats = history.dailyActivity?.[today] || { xp: 0, sessions: 0, lessons: 0 };

  const current = todayStats.xp;
  const percent = Math.min(100, Math.round((current / targetXp) * 100));
  const completed = current >= targetXp;

  return { current, target: targetXp, completed, percent };
}

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
 * Generates an array of activity data for the past N days.
 * @param {number} [daysCount=28]
 * @returns {Array<{ date: string, xp: number, level: number, dayOfWeek: number }>}
 */
export function getActivityDays(daysCount = 28) {
  const history = readJson(getHistoryFilePath(), { dailyActivity: {} });
  const activityMap = history.dailyActivity || {};

  const days = [];
  const now = new Date();

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = getTodayKey(d);
    const dayData = activityMap[key] || { xp: 0, sessions: 0, lessons: 0 };
    const xp = dayData.xp || 0;

    let level = 0;
    if (xp > 0 && xp <= 20) level = 1;
    else if (xp > 20 && xp <= 50) level = 2;
    else if (xp > 50 && xp <= 100) level = 3;
    else if (xp > 100) level = 4;

    days.push({
      date: key,
      xp,
      level,
      dayOfWeek: d.getDay() // 0 = Sun, 1 = Mon, ...
    });
  }

  return days;
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
