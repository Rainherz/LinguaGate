import chalk from 'chalk';
import boxen from 'boxen';

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
}
