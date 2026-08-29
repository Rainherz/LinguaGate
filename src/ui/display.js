import chalk from 'chalk';
import boxen from 'boxen';

export function clearScreen() {
  console.clear();
}

export function printAppHeader(subTitle = '') {
  const brand = chalk.bold.cyan('LinguaGate') + chalk.dim(' 🚪🗣️');
  const path = subTitle ? chalk.dim(' › ') + chalk.bold.white(subTitle) : '';
  console.log(`\n  ${brand}${path}\n`);
}

export function banner() {
  clearScreen();
  console.log(
    boxen(
      `${chalk.bold.cyan('LinguaGate')} ${chalk.dim('— English Learning Engine')}\n` +
      `${chalk.gray('Active grammar gate • CEFR Path • Spaced Repetition')}`,
      {
        padding: { top: 0, bottom: 0, left: 2, right: 2 },
        margin: { top: 1, bottom: 1, left: 1, right: 1 },
        borderStyle: 'round',
        borderColor: 'cyan',
        dimBorder: true
      }
    )
  );
}

export function printStreak(n) {
  if (n <= 0) return;
  const fire = '🔥'.repeat(Math.min(n, 5));
  console.log(chalk.yellow(`  ${fire} ${n} streak!\n`));
}

export function printError(result) {
  console.log(chalk.red('  ✖ Grammar error — fix it and try again.\n'));
  if (result.corrections?.length > 0) {
    console.log(chalk.yellow('  Errors found:'));
    result.corrections.forEach((c) => {
      console.log(
        `    ${chalk.red('✖')} ${chalk.yellow(c.wrong)} ${chalk.dim('→')} ${chalk.green(c.correct)}` +
        `  ${chalk.dim(`(${c.rule})`)}`
      );
      if (c.explanation) console.log(`       ${chalk.gray(c.explanation)}`);
    });
  }
  if (result.correctedText) {
    console.log(chalk.gray(`\n  Suggestion: ${chalk.white(result.correctedText)}`));
  }
  if (result.explanation) {
    console.log(chalk.gray(`  Why: ${result.explanation}`));
  }
  console.log();
}

export function printSuccess(msg) {
  console.log(chalk.green(`  ✔ ${msg}`));
}

export function printBotReply(text) {
  console.log(chalk.bold.blue('\n  LinguaGate › ') + text + '\n');
}

export function printWordOfDay({ word, partOfSpeech, definition, example }) {
  console.log(
    boxen(
      `${chalk.bold.magenta('✨ Word of the Day')} ${chalk.dim(`(${partOfSpeech})`)}\n` +
      `${chalk.bold.white(word)}\n` +
      `${chalk.gray(definition)}\n` +
      `${chalk.italic.dim(`e.g. "${example}"`)}`,
      {
        padding: { top: 0, bottom: 0, left: 2, right: 2 },
        margin: { top: 0, bottom: 1, left: 1, right: 1 },
        borderStyle: 'round',
        borderColor: 'magenta',
        dimBorder: true
      }
    )
  );
}

export function printTheoryCard(theory, lesson) {
  let content = `${chalk.bold.yellow(theory.title || lesson.title)}\n`;
  content += `${chalk.gray(theory.explanation)}\n\n`;

  if (theory.rules && theory.rules.length > 0) {
    theory.rules.forEach((r) => {
      content += `${chalk.cyan('• ' + r.rule)}\n`;
      content += `  ${chalk.white('Ejemplo:')} ${chalk.italic(r.example)}\n`;
      if (r.note) content += `  ${chalk.dim('Ojo:')} ${chalk.gray(r.note)}\n`;
      content += '\n';
    });
  }

  if (theory.tip) {
    const cleanTip = theory.tip.replace(/^Regla de oro:\s*/i, '');
    content += `${chalk.bold.green('💡 Regla de oro:')} ${chalk.white(cleanTip)}`;
  }

  console.log(
    boxen(content.trim(), {
      title: chalk.bold.magenta(' 📖 Píldora Teórica '),
      titleAlignment: 'left',
      padding: 1,
      margin: { top: 1, bottom: 1, left: 1, right: 1 },
      borderStyle: 'round',
      borderColor: 'magenta',
      dimBorder: false
    })
  );
}

export function printDivider() {
  console.log(chalk.dim('  ───────────────────────────────────────────────────\n'));
}

/**
 * Renders an end-of-session summary card.
 * @param {{ mode: string, duration: number, correct: number, incorrect: number, topErrors: string[] }} summary
 */
export function printSessionSummary(summary) {
  const { mode, duration, correct, incorrect, topErrors } = summary;
  const total = correct + incorrect;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;

  let content = `${chalk.dim('Mode:')}     ${chalk.bold.white(mode)}\n` +
    `${chalk.dim('Time:')}     ${chalk.white(`${mins}m ${secs}s`)}\n` +
    `${chalk.dim('Correct:')}  ${chalk.green(correct)}\n` +
    `${chalk.dim('Errors:')}   ${chalk.red(incorrect)}\n` +
    `${chalk.dim('Accuracy:')} ${chalk.bold.yellow(`${pct}%`)}`;

  if (topErrors.length > 0) {
    content += `\n\n${chalk.dim('Top mistakes:')}\n`;
    topErrors.forEach((e) => {
      content += `  ${chalk.red('•')} ${chalk.gray(e)}\n`;
    });
  }

  console.log(
    boxen(content.trim(), {
      title: chalk.bold.cyan(' 📊 Session Summary '),
      titleAlignment: 'left',
      padding: 1,
      margin: { top: 1, bottom: 1, left: 1, right: 1 },
      borderStyle: 'round',
      borderColor: 'cyan',
      dimBorder: true
    })
  );
}
