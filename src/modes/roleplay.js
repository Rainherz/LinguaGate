import readline from 'node:readline';
import { safeSelect } from '../ui/prompt.js';
import ora from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import { roleplayTurn } from '../services/agy.js';
import { updateStreak, recordError } from '../services/history.js';
import { clearScreen, printAppHeader, printError } from '../ui/display.js';

const SCENARIOS = [
  {
    id: 'coffee',
    title: '☕ Brooklyn Coffee Shop',
    description: 'Order your morning coffee and pastry in a bustling NYC cafe.',
    character: 'Friendly, fast-paced Brooklyn barista',
    initialMessage: "Hey there! Welcome to Drift Coffee. What can I get started for you today?",
    objectives: [
      { id: 1, text: 'Order a specific coffee and specify your milk preference (e.g., oat/almond)', completed: false },
      { id: 2, text: 'Ask if they have any fresh pastries or food recommendations', completed: false },
      { id: 3, text: 'Specify take-out/for here and complete the payment/tip', completed: false }
    ]
  },
  {
    id: 'standup',
    title: '💼 Software Engineering Daily Standup',
    description: 'Give your daily status update in an agile tech team meeting.',
    character: 'Tech Lead / Scrum Master running the 15-minute standup',
    initialMessage: "Alright team, let's keep it brief. Who wants to go next with their daily update?",
    objectives: [
      { id: 1, text: 'Summarize what ticket/feature you closed or worked on yesterday', completed: false },
      { id: 2, text: 'Mention if you have any blockers or need help with a PR review', completed: false },
      { id: 3, text: 'State clearly what task you are picking up today', completed: false }
    ]
  },
  {
    id: 'airport',
    title: '✈️ Airport Border Control (JFK / Heathrow)',
    description: 'Clear immigration customs smoothly with a border officer.',
    character: 'Strict but professional Immigration & Customs Officer',
    initialMessage: "Good morning. Passports and landing cards, please. What is the main purpose of your visit?",
    objectives: [
      { id: 1, text: 'State the clear purpose of your trip (vacation, business, conference)', completed: false },
      { id: 2, text: 'Explain where you are staying (hotel name / address)', completed: false },
      { id: 3, text: 'State the exact duration of your stay and your return date', completed: false }
    ]
  },
  {
    id: 'hotel',
    title: '🏨 Hotel Check-in & Issue Resolution',
    description: 'Check into your hotel room and politely resolve a problem.',
    character: 'Helpful hotel front-desk manager',
    initialMessage: "Good evening! Welcome to the Grand Central Hotel. Are you checking in tonight?",
    objectives: [
      { id: 1, text: 'Provide your reservation name and request your key cards', completed: false },
      { id: 2, text: 'Politely explain an issue with the room (e.g. broken AC or missing towels)', completed: false },
      { id: 3, text: 'Request a solution (maintenance or a room change) gracefully', completed: false }
    ]
  }
];

function renderMissionBoard(scenario, objectives) {
  let list = `${chalk.bold.yellow('Mission Objectives:')}\n`;
  objectives.forEach((obj) => {
    const icon = obj.completed ? chalk.bold.green('✓ [DONE]') : chalk.dim('○ [PENDING]');
    const text = obj.completed ? chalk.green(obj.text) : chalk.white(obj.text);
    list += `  ${icon} ${text}\n`;
  });

  console.log(
    boxen(list.trim(), {
      title: chalk.bold.cyan(` 🎯 ${scenario.title} `),
      titleAlignment: 'left',
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 1, left: 1, right: 1 },
      borderStyle: 'round',
      borderColor: 'cyan',
      dimBorder: true
    })
  );
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

export async function runRoleplay(stats) {
  clearScreen();
  printAppHeader('Interactive Roleplay Missions');

  const chosenId = await safeSelect({
    message: 'Choose a real-world mission (Esc to go back):',
    choices: [
      { name: '🔙 Back to Main Menu (or press Esc)', value: 'BACK' },
      ...SCENARIOS.map((s) => ({ name: `${s.title} — ${chalk.gray(s.description)}`, value: s.id }))
    ]
  });

  if (!chosenId || chosenId === 'BACK') return;

  const baseScenario = SCENARIOS.find((s) => s.id === chosenId);
  const scenario = structuredClone(baseScenario);
  const objectives = scenario.objectives;

  const chatHistory = [{ role: 'Character', text: scenario.initialMessage }];

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let missionComplete = false;

  while (!missionComplete) {
    clearScreen();
    printAppHeader(`Roleplay: ${scenario.title}`);
    renderMissionBoard(scenario, objectives);

    console.log(chalk.bold.blue(`  🤖 ${scenario.character}:`));
    console.log(`  "${chalk.white(chatHistory[chatHistory.length - 1].text)}"\n`);

    const input = (await ask(rl, chalk.bold.green('  You › '))).trim();
    if (!input) continue;
    if (input === '/quit') break;

    const spinner = ora({ text: 'Evaluating response & objectives...', color: 'yellow', indent: 2 }).start();
    let turnResult;
    try {
      turnResult = roleplayTurn(scenario, chatHistory, input, objectives);
      spinner.stop();
    } catch (err) {
      spinner.fail('Evaluation error');
      console.error(err.message);
      break;
    }

    if (!turnResult.grammar?.isCorrect) {
      console.log();
      printError(turnResult.grammar);
      updateStreak(false);
      stats.recordIncorrect(turnResult.grammar?.corrections?.[0] ?? 'roleplay grammar error');
      turnResult.grammar?.corrections?.forEach((c) => recordError(c, input, turnResult.grammar.correctedText));
      await ask(rl, chalk.dim('  Press [ENTER] to retry your answer › '));
      continue;
    }

    // Grammar passed!
    updateStreak(true);
    stats.recordCorrect();

    // Update completed objectives
    if (turnResult.newlyCompletedIds && turnResult.newlyCompletedIds.length > 0) {
      for (const id of turnResult.newlyCompletedIds) {
        const target = objectives.find((o) => o.id === id);
        if (target) target.completed = true;
      }
    }

    chatHistory.push({ role: 'User', text: input });
    if (turnResult.characterReply) {
      chatHistory.push({ role: 'Character', text: turnResult.characterReply });
    }

    // Check if all objectives met
    const allDone = objectives.every((o) => o.completed);
    if (allDone) {
      missionComplete = true;
      break;
    }
  }

  rl.close();

  if (missionComplete) {
    clearScreen();
    printAppHeader(`Mission Success: ${scenario.title}`);
    console.log(
      boxen(
        `${chalk.bold.green('🎉 MISSION ACCOMPLISHED!')}\n\n` +
        `${chalk.white('You achieved 100% of the conversation goals in natural English!')}\n` +
        `${chalk.yellow('Reward: +75 XP ⚡')}`,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'green'
        }
      )
    );
  }
}
