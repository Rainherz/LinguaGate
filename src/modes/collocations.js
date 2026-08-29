import chalk from 'chalk';
import boxen from 'boxen';
import { getCollocationsByCategory, evaluateCollocationAnswer } from '../services/collocations.js';
import { updateStreak, recordError } from '../services/history.js';
import { clearScreen, printAppHeader, printDivider } from '../ui/display.js';
import { safeSelect, safeConfirm, safeInput } from '../ui/prompt.js';
import { promptAudioFollowup } from './shared/exercises.js';

export async function runCollocationsGym(stats) {
  clearScreen();
  printAppHeader('Prepositions & Collocations Gym');

  const categoryChoice = await safeSelect({
    message: 'Select workout theme (Esc to go back):',
    choices: [
      { name: '🔙 Back to Main Menu (or press Esc)', value: 'BACK' },
      { name: '🔥 All Mixed Challenges (Prepositions & Collocations)', value: 'all' },
      { name: '🎯 Verb + Preposition (depend on, listen to, belong to...)', value: 'verb-preposition' },
      { name: '🏷️  Adjective + Preposition (interested in, good at, afraid of...)', value: 'adjective-preposition' },
      { name: '⚔️  Make vs Do Battles (make a decision, do homework...)', value: 'make-vs-do' },
      { name: '💬 Common Verb Collocations (pay attention, tell the truth...)', value: 'verb-collocation' }
    ]
  });

  if (!categoryChoice || categoryChoice === 'BACK') return;

  let pool = getCollocationsByCategory(categoryChoice);
  pool = pool.sort(() => Math.random() - 0.5);

  let round = 0;
  let running = true;

  while (running && round < pool.length) {
    const item = pool[round];
    round++;

    clearScreen();
    printAppHeader(`Collocations Gym • Round #${round}`);

    const sentenceWithHighlight = item.prompt.replace('___', chalk.bold.cyan('___'));

    const card = `${chalk.dim('Desafío:')}     ${chalk.bold.white(sentenceWithHighlight)}\n` +
      `${chalk.dim('Significado:')} ${chalk.yellow(item.spanish)}\n` +
      `${chalk.dim('Nivel:')}       ${chalk.gray(item.level)}`;

    console.log(
      boxen(card, {
        title: chalk.bold.cyan(` 🧩 [${round}/${pool.length}] `),
        titleAlignment: 'left',
        padding: 1,
        margin: { top: 0, bottom: 1, left: 1, right: 1 },
        borderStyle: 'round',
        borderColor: 'cyan',
        dimBorder: true
      })
    );

    console.log(chalk.gray('  Type the missing word (or /quit to exit).\n'));

    const input = (await safeInput({ message: 'Your answer ›' })).trim();
    if (!input || input === '/quit' || input.toLowerCase() === 'exit') break;

    const isCorrect = evaluateCollocationAnswer(item.answer, input);
    const completedSentence = item.prompt.replace('___', item.answer);

    console.log();
    if (isCorrect) {
      console.log(chalk.bold.green(`  ✔ Correct! "${chalk.white(item.fullPhrase)}" is the exact native phrase.\n`));
      updateStreak(true);
      stats.recordCorrect();
    } else {
      console.log(chalk.bold.red(`  ✖ Incorrect. You wrote "${input}" (Correct: "${item.answer}")\n`));

      if (item.trap) {
        console.log(
          boxen(
            `${chalk.bold.yellow('💡 Ojo con el error común / traducción literal:')}\n` +
            `${chalk.white(item.trap)}`,
            {
              padding: 1,
              margin: { top: 0, bottom: 1, left: 1, right: 1 },
              borderStyle: 'round',
              borderColor: 'yellow',
              dimBorder: true
            }
          )
        );
      }

      updateStreak(false);
      stats.recordIncorrect(`Collocation: ${item.fullPhrase}`);
      recordError(`Collocation: ${item.fullPhrase}`, item.prompt, item.fullPhrase);
    }

    // Followup audio option
    await promptAudioFollowup(completedSentence);

    printDivider();
    if (round < pool.length) {
      const next = await safeConfirm({ message: 'Next challenge?', default: true });
      if (!next) running = false;
    }
  }
}
