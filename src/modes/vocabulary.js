import chalk from 'chalk';
import boxen from 'boxen';
import { loadVocabulary, generateVocabQuestion, recordWordQuizResult } from '../services/vocabulary.js';
import { updateStreak } from '../services/history.js';
import { clearScreen, printAppHeader, printDivider } from '../ui/display.js';
import { safeSelect, safeConfirm } from '../ui/prompt.js';
import { promptAudioFollowup } from './shared/exercises.js';

export async function runVocabularyVault(stats) {
  while (true) {
    clearScreen();
    printAppHeader('Vocabulary Vault & Daily Quiz');

    const vocab = loadVocabulary();
    const totalWords = vocab.words.length;
    const masteredCount = vocab.words.filter((w) => w.mastered).length;

    console.log(
      boxen(
        `${chalk.bold.white('Your Personal Vocabulary Bank:')}\n\n` +
        `  ${chalk.dim('• Saved Words:')}    ${chalk.cyan(totalWords)}\n` +
        `  ${chalk.dim('• Mastered Words:')} ${chalk.green(`${masteredCount} ⭐`)}\n` +
        `  ${chalk.dim('• In Progress:')}    ${chalk.yellow(totalWords - masteredCount)}`,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'magenta',
          dimBorder: true
        }
      )
    );

    const action = await safeSelect({
      message: 'Choose an action (Esc to return):',
      choices: [
        { name: '🔙 Back to Main Menu (or press Esc)', value: 'BACK' },
        { name: '⚡ Quick 5-Word Vocabulary Quiz', value: 'QUIZ' },
        { name: '📖 Browse Saved Words & Pronunciation', value: 'BROWSE' }
      ]
    });

    if (!action || action === 'BACK') break;

    if (action === 'QUIZ') {
      await runVocabQuiz(stats, vocab.words);
    }

    if (action === 'BROWSE') {
      await browseVocabBank(vocab.words);
    }
  }
}

async function runVocabQuiz(stats, words) {
  if (words.length < 4) {
    console.log(chalk.yellow('\n  Need at least 4 words in the vault to generate a quiz.\n'));
    await safeConfirm({ message: 'Press Enter to continue', default: true });
    return;
  }

  const pool = [...words].sort(() => Math.random() - 0.5).slice(0, 5);

  for (let i = 0; i < pool.length; i++) {
    const target = pool[i];
    const quiz = generateVocabQuestion(target, words);

    clearScreen();
    printAppHeader(`Vocabulary Quiz • Word [${i + 1}/${pool.length}]`);

    const card =
      `${chalk.bold.magenta(target.word.toUpperCase())}  ${chalk.dim(`(${target.partOfSpeech})`)}\n\n` +
      `${chalk.dim('Example Context:')}\n` +
      `"${chalk.italic.white(target.example || 'N/A')}"`;

    console.log(
      boxen(card, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'magenta'
      })
    );

    const choices = [
      ...quiz.choices.map((c, idx) => ({
        name: `${idx + 1}. ${c.name}`,
        value: c.isCorrect
      })),
      { name: '🔙 Exit Quiz', value: 'EXIT' }
    ];

    const answer = await safeSelect({
      message: 'Select the correct definition:',
      choices
    });

    if (answer === 'EXIT' || answer === null) break;

    console.log();
    if (answer === true) {
      console.log(chalk.bold.green(`  ✔ Correct! "${target.word}" means: ${target.definition}\n`));
      updateStreak(true);
      stats.recordCorrect();
      recordWordQuizResult(target.word, true);
    } else {
      console.log(chalk.bold.red(`  ✖ Incorrect. The correct definition is:\n  ${chalk.yellow(target.definition)}\n`));
      updateStreak(false);
      stats.recordIncorrect(`Vocabulary: ${target.word}`);
      recordWordQuizResult(target.word, false);
    }

    // Audio follow up
    await promptAudioFollowup(`${target.word}. ${target.example}`);

    if (i < pool.length - 1) {
      printDivider();
      const next = await safeConfirm({ message: 'Next word?', default: true });
      if (!next) break;
    }
  }
}

async function browseVocabBank(words) {
  while (true) {
    clearScreen();
    printAppHeader('Vocabulary Vault • Word List');

    const choices = [
      { name: '🔙 Back to Vault Menu (or press Esc)', value: 'BACK' },
      ...words.map((w) => ({
        name: `${w.mastered ? '⭐' : '📖'} ${chalk.bold(w.word)} (${w.partOfSpeech}) — ${w.definition.slice(0, 45)}...`,
        value: w
      }))
    ];

    const selected = await safeSelect({
      message: 'Select a word to view full card & audio:',
      choices
    });

    if (!selected || selected === 'BACK') break;

    clearScreen();
    printAppHeader(`Word Detail: ${selected.word}`);

    const card =
      `${chalk.bold.cyan(selected.word.toUpperCase())}  ${chalk.dim(`(${selected.partOfSpeech})`)}\n\n` +
      `${chalk.bold.white('Definition:')} ${selected.definition}\n\n` +
      `${chalk.bold.white('Example:')}    "${chalk.italic.yellow(selected.example)}"\n\n` +
      `${chalk.dim('Status:')}     ${selected.mastered ? chalk.green('Mastered ⭐') : chalk.yellow('Learning 📖')} (Reviewed: ${selected.timesReviewed || 0} times)`;

    console.log(
      boxen(card, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      })
    );

    await promptAudioFollowup(`${selected.word}. ${selected.example}`);
  }
}
