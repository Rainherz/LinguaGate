import chalk from 'chalk';

export function banner() {
  console.log(chalk.bold.cyan('\n╔══════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║       LinguaGate  🚪🗣️             ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════╝'));
  console.log(chalk.gray('  Write in English. I only reply if your grammar is correct.\n'));
}

export function printStreak(n) {
  if (n <= 0) return;
  const fire = '🔥'.repeat(Math.min(n, 5));
  console.log(chalk.yellow(`  ${fire} ${n} in a row!\n`));
}

export function printError(result) {
  console.log(chalk.red('  ✖ Grammar error — fix it and try again.\n'));
  if (result.corrections?.length > 0) {
    console.log(chalk.yellow('  Errors found:'));
    result.corrections.forEach((c) => console.log(chalk.yellow(`    • ${c}`)));
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
  console.log(chalk.bold.magenta('  ✨ Word of the Day'));
  console.log(chalk.magenta(`  ${chalk.bold(word)} ${chalk.gray(`(${partOfSpeech})`)}`));
  console.log(chalk.gray(`  ${definition}`));
  console.log(chalk.gray(`  e.g. "${example}"`));
  console.log();
}

export function printDivider() {
  console.log(chalk.gray('  ─────────────────────────────────────\n'));
}
