import chalk from 'chalk';
import boxen from 'boxen';
import { exportToAnkiCsv, exportToMarkdownNotebook } from '../services/exporter.js';
import { clearScreen, printAppHeader } from '../ui/display.js';
import { safeSelect, safeConfirm } from '../ui/prompt.js';

export async function runExportMode() {
  clearScreen();
  printAppHeader('Study Deck & Notebook Exporter');

  const choice = await safeSelect({
    message: 'What would you like to export? (Esc to go back):',
    choices: [
      { name: '🔙 Back to Main Menu (or press Esc)', value: 'BACK' },
      { name: '📦 Export to Anki / Quizlet (.csv)', value: 'ANKI' },
      { name: '📖 Export Personal Study Notebook (.md)', value: 'NOTEBOOK' },
      { name: '🚀 Export ALL (Anki Deck + Notebook)', value: 'ALL' }
    ]
  });

  if (!choice || choice === 'BACK') return;

  clearScreen();
  printAppHeader('Export Results');

  let outputText = '';

  if (choice === 'ANKI' || choice === 'ALL') {
    const { filePath, count } = exportToAnkiCsv();
    outputText += `${chalk.bold.green('✔ Anki Deck (.csv) generated successfully!')}\n` +
      `  ${chalk.dim('Cards exported:')} ${chalk.bold.yellow(count)}\n` +
      `  ${chalk.dim('File path:')}      ${chalk.cyan(filePath)}\n\n`;
  }

  if (choice === 'NOTEBOOK' || choice === 'ALL') {
    const { filePath } = exportToMarkdownNotebook();
    outputText += `${chalk.bold.green('✔ Personal Grammar Notebook (.md) generated!')}\n` +
      `  ${chalk.dim('File path:')}      ${chalk.cyan(filePath)}\n\n`;
  }

  outputText += `${chalk.bold.white('How to import into Anki Mobile / Desktop:')}\n` +
    `1. Open Anki ➔ File ➔ Import (or ${chalk.cyan('Ctrl+I')})\n` +
    `2. Select ${chalk.yellow('export/anki_deck.csv')}\n` +
    `3. Choose Deck: ${chalk.green('LinguaGate English')} and click Import!`;

  console.log(
    boxen(outputText, {
      title: chalk.bold.cyan(' 📦 Export Complete '),
      titleAlignment: 'left',
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green'
    })
  );

  await safeConfirm({ message: 'Return to Main Menu?', default: true });
}
