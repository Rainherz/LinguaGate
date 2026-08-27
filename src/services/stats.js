import chalk from 'chalk';

export class SessionStats {
  constructor(mode) {
    this.mode = mode;
    this.startTime = Date.now();
    this.correct = 0;
    this.incorrect = 0;
    this.errorTypes = {};
  }

  recordCorrect() {
    this.correct += 1;
  }

  recordIncorrect(errorType) {
    this.incorrect += 1;
    if (errorType) {
      this.errorTypes[errorType] = (this.errorTypes[errorType] ?? 0) + 1;
    }
  }

  getSummary() {
    const duration = Math.round((Date.now() - this.startTime) / 1000);
    const topErrors = Object.entries(this.errorTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);
    return { mode: this.mode, duration, correct: this.correct, incorrect: this.incorrect, topErrors };
  }

  print() {
    const { mode, duration, correct, incorrect, topErrors } = this.getSummary();
    const total = correct + incorrect;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;

    console.log(chalk.bold.cyan('\n┌─── Session Summary ───────────────────┐'));
    console.log(chalk.cyan(`│  Mode:     ${chalk.white(mode.padEnd(27))}│`));
    console.log(chalk.cyan(`│  Duration: ${chalk.white(`${mins}m ${secs}s`.padEnd(27))}│`));
    console.log(chalk.cyan(`│  Correct:  ${chalk.green(String(correct).padEnd(27))}│`));
    console.log(chalk.cyan(`│  Errors:   ${chalk.red(String(incorrect).padEnd(27))}│`));
    console.log(chalk.cyan(`│  Score:    ${chalk.yellow(`${pct}%`.padEnd(27))}│`));
    if (topErrors.length > 0) {
      console.log(chalk.cyan(`│  Top mistakes:${' '.repeat(24)}│`));
      topErrors.forEach((e) => {
        const line = `  • ${e}`.slice(0, 38).padEnd(38);
        console.log(chalk.cyan(`│  ${chalk.red(line)}│`));
      });
    }
    console.log(chalk.bold.cyan('└───────────────────────────────────────┘\n'));
  }
}
