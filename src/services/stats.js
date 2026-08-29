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
}
