import chalk from 'chalk';
import { summarizeProgress } from '../services/progress-report.js';

const TREND_BADGE = {
  improving: chalk.green('▲ improving'),
  declining: chalk.red('▼ declining'),
  steady: chalk.yellow('■ steady'),
  unknown: chalk.dim('– not enough data')
};

/**
 * Renders per-mode accuracy from the session log, weakest first.
 * @returns {string}
 */
export function renderProgressReport() {
  const { modes, totals } = summarizeProgress();

  if (modes.length === 0) {
    return chalk.dim('  No sessions recorded yet — finish a practice round and come back.');
  }

  const colorFor = (accuracy) =>
    accuracy >= 85 ? chalk.green : accuracy >= 60 ? chalk.yellow : chalk.red;

  let out = `${chalk.bold.white('Accuracy by mode')} ${chalk.dim('(weakest first)')}\n\n`;
  for (const m of modes) {
    const paint = colorFor(m.accuracy);
    out += `  ${chalk.white(m.mode.padEnd(14))} ${paint(`${String(m.accuracy).padStart(3)}%`)}` +
      `  ${chalk.dim(`${m.sessions} session${m.sessions === 1 ? '' : 's'}`)}` +
      `  ${TREND_BADGE[m.trend] || ''}\n`;
  }

  out += `\n  ${chalk.dim('Overall:')} ${colorFor(totals.accuracy)(`${totals.accuracy}%`)}` +
    ` ${chalk.dim(`across ${totals.sessions} session${totals.sessions === 1 ? '' : 's'}`)}`;

  return out;
}
