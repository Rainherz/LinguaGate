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
