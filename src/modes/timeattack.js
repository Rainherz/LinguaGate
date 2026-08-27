import readline from 'node:readline';
import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { updateStreak } from '../services/history.js';
import { printStreak, printDivider } from '../ui/display.js';

const QUICK_QUESTIONS = [
  { prompt: 'She (dont / doesnt) know the answer.', answer: 'doesnt', hint: 'Third person singular' },
  { prompt: 'I have been working here (since / for) 3 years.', answer: 'for', hint: 'Duration' },
  { prompt: 'He is taller (then / than) his brother.', answer: 'than', hint: 'Comparison' },
  { prompt: 'We went to the beach (yesterday / tomorrow).', answer: 'yesterday', hint: 'Past tense' },
  { prompt: 'They (was / were) playing football.', answer: 'were', hint: 'Plural past continuous' },
  { prompt: 'I need to buy (a / an) umbrella.', answer: 'an', hint: 'Vowel sound' },
  { prompt: 'If it rains, we (stay / will stay) at home.', answer: 'will stay', hint: 'First conditional' },
  { prompt: 'She enjoys (to read / reading) books.', answer: 'reading', hint: 'Gerund after enjoy' },
  { prompt: 'I am interested (in / on) learning English.', answer: 'in', hint: 'Adjective + preposition' },
  { prompt: 'Have you (ever / never) been to Paris?', answer: 'ever', hint: 'Question with present perfect' },
  { prompt: 'The car was repaired (by / with) the mechanic.', answer: 'by', hint: 'Passive agent' },
  { prompt: 'You (must / should) stop at a red light.', answer: 'must', hint: 'Obligation / Law' }
];

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

export async function runTimeAttack(stats) {
  console.log(chalk.bold.cyan('\n══════════════════════════════════════════════════════════════════'));
  console.log(chalk.bold.yellow('  ⚡ TIME ATTACK: 60-SECOND RAPID FIRE'));
  console.log(chalk.gray('  Answer as many quick grammar challenges as you can before time runs out!'));
  console.log(chalk.bold.cyan('══════════════════════════════════════════════════════════════════\n'));

  // Shuffle questions
  const questions = [...QUICK_QUESTIONS].sort(() => Math.random() - 0.5);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await ask(rl, chalk.bold.green('  Press [ENTER] to start the 60-second timer! '));

  const startTime = Date.now();
  const DURATION_MS = 60 * 1000;
  let score = 0;
  let mistakes = 0;
  let qIndex = 0;

  while (Date.now() - startTime < DURATION_MS && qIndex < questions.length) {
    const elapsed = Date.now() - startTime;
    const remainingSecs = Math.max(0, Math.ceil((DURATION_MS - elapsed) / 1000));
    const q = questions[qIndex];

    console.log(chalk.bold.magenta(`\n  ⏱️  [${remainingSecs}s left] `) + chalk.bold.white(q.prompt));
    const answer = (await ask(rl, chalk.bold.green('  › '))).trim();

    // Check if time expired during question
    if (Date.now() - startTime >= DURATION_MS) {
      console.log(chalk.yellow('\n  ⏰ Time is UP!'));
      break;
    }

    if (answer.toLowerCase() === q.answer.toLowerCase()) {
      score++;
      console.log(chalk.green(`  ⚡ Correct! (+1)`));
      stats.recordCorrect();
    } else {
      mistakes++;
      console.log(chalk.red(`  ✖ Oops! Correct was: "${q.answer}"`));
      stats.recordIncorrect('time attack speed error');
    }
    qIndex++;
  }

  rl.close();

  const total = score + mistakes;
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

  console.log(chalk.bold.cyan('\n┌─── ⚡ TIME ATTACK RESULTS ─────────────┐'));
  console.log(chalk.cyan(`│  Score:    ${chalk.bold.green(String(score).padEnd(27))}│`));
  console.log(chalk.cyan(`│  Mistakes: ${chalk.red(String(mistakes).padEnd(27))}│`));
  console.log(chalk.cyan(`│  Accuracy: ${chalk.yellow(`${accuracy}%`.padEnd(27))}│`));
  
  let rank = '🌱 Rookie';
  if (score >= 10) rank = '🔥 Turbo Master';
  else if (score >= 7) rank = '⚡ Speed Demon';
  else if (score >= 4) rank = '🎯 Sharp Shooter';

  console.log(chalk.cyan(`│  Rank:     ${chalk.bold.magenta(rank.padEnd(27))}│`));
  console.log(chalk.bold.cyan('└───────────────────────────────────────┘\n'));
}
