import chalk from 'chalk';
import boxen from 'boxen';
import { getVerbsByLevel, evaluateVerbAnswer } from '../services/verbs.js';
import { updateStreak, recordError } from '../services/history.js';
import { clearScreen, printAppHeader, printDivider } from '../ui/display.js';
import { safeSelect, safeConfirm, safeInput } from '../ui/prompt.js';

export async function runVerbsGym(stats) {
  clearScreen();
  printAppHeader('Irregular Verbs Gym (3 Forms)');

  const levelChoice = await safeSelect({
    message: 'Select difficulty / CEFR level (Esc to go back):',
    choices: [
      { name: '🔙 Back to Main Menu (or press Esc)', value: 'BACK' },
      { name: '🟢 Beginner (A1 - A2: go, see, make, write, speak...)', value: 'A1-A2' },
      { name: '🟡 Intermediate (B1: freeze, steal, tear, throw, bite...)', value: 'B1' },
      { name: '🔴 Advanced (B2 - C1: shrink, sink, forbid, withhold...)', value: 'B2-C1' },
      { name: '🔥 All Levels Mixed (Complete 50+ Verbs Workout)', value: 'all' }
    ]
  });

  if (!levelChoice || levelChoice === 'BACK') return;

  const pool = (
    levelChoice === 'A1-A2'
      ? [...getVerbsByLevel('A1'), ...getVerbsByLevel('A2')]
      : levelChoice === 'B2-C1'
      ? [...getVerbsByLevel('B2'), ...getVerbsByLevel('C1')]
      : getVerbsByLevel(levelChoice)
  ).sort(() => Math.random() - 0.5);

  let round = 0;
  let running = true;

  while (running && round < pool.length) {
    const verb = pool[round];
    round++;

    clearScreen();
    printAppHeader(`Verbs Gym (${verb.level}) • Round #${round}`);

    let card = `${chalk.dim('Infinitivo (V1):')}   ${chalk.bold.yellow(verb.infinitive.toUpperCase())}\n` +
      `${chalk.dim('Significado:')}       ${chalk.white(verb.spanish)}\n` +
      `${chalk.dim('Familia / Patrón:')} ${chalk.gray(verb.pattern || 'irregular')}`;

    console.log(
      boxen(card, {
        title: chalk.bold.cyan(` ⚡ Verb [${round}/${pool.length}] `),
        titleAlignment: 'left',
        padding: 1,
        margin: { top: 0, bottom: 1, left: 1, right: 1 },
        borderStyle: 'round',
        borderColor: 'cyan',
        dimBorder: true
      })
    );

    console.log(chalk.gray('  Type /quit to exit anytime.\n'));

    // Prompt Past Simple (V2)
    const pastInput = (await safeInput({ message: `1. Past Simple (V2) for "${verb.infinitive}" ›` })).trim();
    if (pastInput === '/quit') break;

    // Prompt Past Participle (V3)
    const partInput = (await safeInput({ message: `2. Past Participle (V3) for "${verb.infinitive}" ›` })).trim();
    if (partInput === '/quit') break;

    const isPastCorrect = evaluateVerbAnswer(verb.past, pastInput);
    const isPartCorrect = evaluateVerbAnswer(verb.participle, partInput);

    console.log();
    if (isPastCorrect && isPartCorrect) {
      console.log(chalk.bold.green(`  🎉 PERFECT! ${verb.infinitive} ➔ ${verb.past} ➔ ${verb.participle}`));
      updateStreak(true);
      stats.recordCorrect();
    } else {
      console.log(chalk.bold.red(`  ✖ Review needed for "${verb.infinitive}":`));
      if (!isPastCorrect) {
        console.log(`  ${chalk.red('• Past Simple (V2):')}       escribiste "${chalk.yellow(pastInput)}" (Correcto: ${chalk.bold.green(verb.past)})`);
      } else {
        console.log(`  ${chalk.green('• Past Simple (V2):')}       ✔ ${verb.past}`);
      }

      if (!isPartCorrect) {
        console.log(`  ${chalk.red('• Past Participle (V3):')}   escribiste "${chalk.yellow(partInput)}" (Correcto: ${chalk.bold.green(verb.participle)})`);
      } else {
        console.log(`  ${chalk.green('• Past Participle (V3):')}   ✔ ${verb.participle}`);
      }

      updateStreak(false);
      stats.recordIncorrect(`Irregular Verb: ${verb.infinitive}`);
      recordError(`Irregular Verb: ${verb.infinitive}`, `${pastInput} / ${partInput}`, `${verb.past} / ${verb.participle}`);
    }

    printDivider();
    if (round < pool.length) {
      const next = await safeConfirm({ message: 'Next verb?', default: true });
      if (!next) running = false;
    }
  }
}
